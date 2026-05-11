"use client";

import {
  GATEWAY_URL,
  OP,
  DEFAULT_INTENTS,
  NON_PRIVILEGED_INTENTS,
  PRIVILEGED_INTENTS,
  INTENTS,
} from "./constants";
import type { GatewayPayload } from "./types";

export type GatewayState =
  | "idle"
  | "connecting"
  | "identifying"
  | "ready"
  | "resuming"
  | "reconnecting"
  | "disconnected";

export interface GatewayOptions {
  token: string;
  intents?: number;
  onDispatch?: (event: string, data: unknown) => void;
  onState?: (state: GatewayState) => void;
  onPing?: (ms: number) => void;
  onIntents?: (active: number) => void;
}

export class DiscordGateway {
  private ws: WebSocket | null = null;
  private heartbeatInterval = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastHeartbeatSent = 0;
  private lastSequence: number | null = null;
  private sessionId: string | null = null;
  private resumeUrl: string | null = null;
  private acked = true;
  private reconnectAttempts = 0;
  private closedByUser = false;
  private state: GatewayState = "idle";
  private intents: number;

  constructor(private opts: GatewayOptions) {
    this.intents = opts.intents ?? DEFAULT_INTENTS;
  }

  connect() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.closedByUser = false;
    this.openSocket(this.resumeUrl ?? GATEWAY_URL, !!this.sessionId);
  }

  reconnectNow() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(4000, "force reconnect");
      }
      return;
    }
    this.connect();
  }

  disconnect() {
    this.closedByUser = true;
    this.clearHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close(1000, "client disconnect");
    this.ws = null;
    this.setState("disconnected");
  }

  send(payload: GatewayPayload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  requestGuildMembers(guildId: string, query = "", limit = 0) {
    if (!(this.intents & INTENTS.GUILD_MEMBERS)) return false;
    this.send({
      op: OP.REQUEST_GUILD_MEMBERS,
      d: { guild_id: guildId, query, limit, presences: !!(this.intents & INTENTS.GUILD_PRESENCES) },
    });
    return true;
  }

  getActiveIntents() {
    return this.intents;
  }

  updatePresence(status: "online" | "idle" | "dnd" | "invisible", activity?: string) {
    this.send({
      op: OP.PRESENCE_UPDATE,
      d: {
        since: null,
        activities: activity ? [{ name: activity, type: 0 }] : [],
        status,
        afk: false,
      },
    });
  }

  private openSocket(url: string, resume: boolean) {
    this.setState(resume ? "resuming" : "connecting");
    const ws = new WebSocket(url);
    this.ws = ws;
    this.acked = true;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    ws.onmessage = (ev) => {
      let payload: GatewayPayload;
      try {
        payload = JSON.parse(ev.data);
      } catch {
        return;
      }
      this.handle(payload, resume);
    };

    ws.onerror = () => {};

    ws.onclose = (ev) => {
      this.clearHeartbeat();
      if (this.closedByUser) return;

      // Disallowed intents — drop privileged, retry once
      if (ev.code === 4014 && this.intents & PRIVILEGED_INTENTS) {
        this.intents = NON_PRIVILEGED_INTENTS;
        this.opts.onIntents?.(this.intents);
        this.sessionId = null;
        this.lastSequence = null;
        this.resumeUrl = null;
        this.scheduleReconnect();
        return;
      }

      const fatal = [4004, 4010, 4011, 4012, 4013, 4014];
      if (fatal.includes(ev.code)) {
        this.setState("disconnected");
        return;
      }
      this.scheduleReconnect();
    };
  }

  private handle(payload: GatewayPayload, isResume: boolean) {
    if (typeof payload.s === "number") this.lastSequence = payload.s;

    switch (payload.op) {
      case OP.HELLO: {
        const d = payload.d as { heartbeat_interval: number };
        this.heartbeatInterval = d.heartbeat_interval;
        this.startHeartbeat();
        if (isResume && this.sessionId) {
          this.send({
            op: OP.RESUME,
            d: {
              token: this.opts.token,
              session_id: this.sessionId,
              seq: this.lastSequence ?? 0,
            },
          });
        } else {
          this.setState("identifying");
          this.opts.onIntents?.(this.intents);
          this.send({
            op: OP.IDENTIFY,
            d: {
              token: this.opts.token,
              intents: this.intents,
              properties: {
                os: "browser",
                browser: "bot-client",
                device: "bot-client",
              },
            },
          });
        }
        break;
      }
      case OP.HEARTBEAT:
        this.sendHeartbeat();
        break;
      case OP.HEARTBEAT_ACK: {
        this.acked = true;
        const ms = Date.now() - this.lastHeartbeatSent;
        this.opts.onPing?.(ms);
        break;
      }
      case OP.RECONNECT:
        this.ws?.close(4000, "server requested reconnect");
        break;
      case OP.INVALID_SESSION: {
        const resumable = payload.d === true;
        if (!resumable) {
          this.sessionId = null;
          this.lastSequence = null;
          this.resumeUrl = null;
        }
        setTimeout(() => this.ws?.close(4000, "invalid session"), 1000 + Math.random() * 4000);
        break;
      }
      case OP.DISPATCH: {
        const t = payload.t as string;
        const d = payload.d;
        if (t === "READY") {
          const data = d as { session_id: string; resume_gateway_url: string };
          this.sessionId = data.session_id;
          this.resumeUrl = `${data.resume_gateway_url}/?v=10&encoding=json`;
          this.setState("ready");
        } else if (t === "RESUMED") {
          this.setState("ready");
        }
        this.opts.onDispatch?.(t, d);
        break;
      }
    }
  }

  private startHeartbeat() {
    this.clearHeartbeat();
    const jitter = Math.random();
    setTimeout(() => {
      this.sendHeartbeat();
      this.heartbeatTimer = setInterval(() => {
        if (!this.acked) {
          this.ws?.close(4009, "zombie connection");
          return;
        }
        this.sendHeartbeat();
      }, this.heartbeatInterval);
    }, this.heartbeatInterval * jitter);
  }

  private sendHeartbeat() {
    this.acked = false;
    this.lastHeartbeatSent = Date.now();
    this.send({ op: OP.HEARTBEAT, d: this.lastSequence });
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    this.setState("reconnecting");
    this.reconnectAttempts++;
    const delay = Math.min(30000, 1000 * 2 ** this.reconnectAttempts) + Math.random() * 1000;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closedByUser) this.connect();
    }, delay);
  }

  private setState(s: GatewayState) {
    this.state = s;
    this.opts.onState?.(s);
  }

  getState() {
    return this.state;
  }
}
