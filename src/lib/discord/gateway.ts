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

// How long a socket may sit in connecting/identifying before we give up on it.
// Discord normally sends HELLO within a second or two.
const CONNECT_TIMEOUT_MS = 20000;

export class DiscordGateway {
  private ws: WebSocket | null = null;
  private heartbeatInterval = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatStartTimer: ReturnType<typeof setTimeout> | null = null;
  private invalidSessionTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
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
    this.closedByUser = false;

    const ws = this.ws;
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      this.connect();
      return;
    }

    // OPEN, CONNECTING and CLOSING all get torn down here. Dropping the
    // reference first means the old socket's onclose is ignored (it checks
    // identity), so we reconnect exactly once from this path.
    this.ws = null;
    this.clearHeartbeat();
    this.clearConnectTimeout();
    try {
      ws.close(4000, "force reconnect");
    } catch {}
    this.connect();
  }

  disconnect() {
    this.closedByUser = true;
    this.clearAllTimers();
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
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
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
    this.armConnectTimeout(ws);

    ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    ws.onmessage = (ev) => {
      if (this.ws !== ws) return;
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
      // A socket we already replaced must not drive reconnect logic.
      if (this.ws !== ws) return;
      this.ws = null;
      this.clearHeartbeat();
      this.clearConnectTimeout();
      if (this.invalidSessionTimer) {
        clearTimeout(this.invalidSessionTimer);
        this.invalidSessionTimer = null;
      }
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
        if (this.invalidSessionTimer) clearTimeout(this.invalidSessionTimer);
        const ws = this.ws;
        this.invalidSessionTimer = setTimeout(
          () => {
            this.invalidSessionTimer = null;
            if (this.ws === ws) ws?.close(4000, "invalid session");
          },
          1000 + Math.random() * 4000,
        );
        break;
      }
      case OP.DISPATCH: {
        const t = payload.t as string;
        const d = payload.d;
        if (t === "READY") {
          const data = d as { session_id: string; resume_gateway_url: string };
          this.sessionId = data.session_id;
          this.resumeUrl = `${data.resume_gateway_url}/?v=10&encoding=json`;
          this.clearConnectTimeout();
          this.setState("ready");
        } else if (t === "RESUMED") {
          this.clearConnectTimeout();
          this.setState("ready");
        }
        this.opts.onDispatch?.(t, d);
        break;
      }
    }
  }

  private startHeartbeat() {
    this.clearHeartbeat();
    // The initial beat is jittered across a full interval (~41s), so this
    // handle has to be cancellable: a reconnect inside that window would
    // otherwise leave a second heartbeat loop running against a dead socket.
    const ws = this.ws;
    const jitter = Math.random();
    this.heartbeatStartTimer = setTimeout(() => {
      this.heartbeatStartTimer = null;
      if (this.ws !== ws) return;
      this.sendHeartbeat();
      this.heartbeatTimer = setInterval(() => {
        if (this.ws !== ws) {
          this.clearHeartbeat();
          return;
        }
        if (!this.acked) {
          ws?.close(4009, "zombie connection");
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
    if (this.heartbeatStartTimer) {
      clearTimeout(this.heartbeatStartTimer);
      this.heartbeatStartTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private armConnectTimeout(ws: WebSocket) {
    this.clearConnectTimeout();
    this.connectTimer = setTimeout(() => {
      this.connectTimer = null;
      if (this.ws !== ws) return;
      // Never reached READY. Drop the reference so the late onclose is
      // ignored, then back off and try again.
      this.ws = null;
      this.clearHeartbeat();
      try {
        ws.close(4000, "connect timeout");
      } catch {}
      if (!this.closedByUser) this.scheduleReconnect();
    }, CONNECT_TIMEOUT_MS);
  }

  private clearConnectTimeout() {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private clearAllTimers() {
    this.clearHeartbeat();
    this.clearConnectTimeout();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.invalidSessionTimer) {
      clearTimeout(this.invalidSessionTimer);
      this.invalidSessionTimer = null;
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
