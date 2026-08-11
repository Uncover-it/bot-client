import type { Channel } from "./types";

/**
 * Discord gives bots no endpoint that lists their open DMs: `/users/@me/channels`
 * only creates them. So the client remembers every DM it has seen, and that
 * memory is the DM list. There is no database here, so it lives in
 * localStorage keyed by the bot's own id. Clearing it loses the list, not
 * the conversation.
 */
const KEY_PREFIX = "bot-client:dms";
/**
 * Where the list lived before it was keyed per bot. It cannot be attributed to
 * a bot any more, and another bot's DM channel only 403s when opened, so it is
 * dropped on the first scoped read instead of being handed to whoever logs in.
 */
const LEGACY_KEY = "bot-client:dms";
const MAX_STORED = 50;

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pending: Channel[] | null = null;
let hydrated = false;
let listening = false;
/** Bot id the current list belongs to. Null means nothing may be written. */
let scope: string | null = null;

function key(): string | null {
  return scope ? `${KEY_PREFIX}:${scope}` : null;
}

/** Reads the list for one bot and points every later write at that bot. */
export function loadStoredDms(botId: string): Channel[] {
  if (typeof window === "undefined") return [];
  scope = botId;
  try {
    window.localStorage.removeItem(LEGACY_KEY);
    const raw = window.localStorage.getItem(`${KEY_PREFIX}:${botId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is Channel =>
        !!c && typeof c === "object" && typeof (c as Channel).id === "string",
    );
  } catch {
    return [];
  }
}

function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const list = pending;
  const k = key();
  pending = null;
  if (!list || !k) return;
  try {
    window.localStorage.setItem(k, JSON.stringify(list));
  } catch {}
}

/**
 * Marks the stored list as merged into the store. Until this happens a write
 * would persist an in-memory map that is missing everything on disk, which
 * would delete the user's DM list instead of adding to it.
 */
export function markDmsHydrated() {
  hydrated = true;
  if (typeof window === "undefined" || listening) return;
  listening = true;
  // A reload inside the debounce window would otherwise drop the last write.
  window.addEventListener("pagehide", flush);
}

/**
 * Forgets which bot the list belongs to, on logout or a token swap. Any
 * debounced write is dropped rather than flushed: it describes the bot that is
 * on the way out, and the next bot must not inherit it.
 */
export function resetDmStorage() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  pending = null;
  hydrated = false;
  scope = null;
}

/**
 * Persists the DM list. Every inbound DM touches its channel, so this is
 * coalesced: a burst of messages costs one write, not one per message.
 */
export function storeDms(dms: Iterable<Channel>) {
  if (typeof window === "undefined" || !hydrated || !scope) return;
  // Newest last in the Map, so the tail is what a user is most likely to
  // come back to.
  pending = Array.from(dms).slice(-MAX_STORED);
  if (flushTimer) return;
  flushTimer = setTimeout(flush, 500);
}
