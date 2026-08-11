import type { Channel } from "./types";

/**
 * Discord gives bots no endpoint that lists their open DMs: `/users/@me/channels`
 * only creates them. So the client remembers every DM it has seen, and that
 * memory is the DM list. There is no database here, so it lives in
 * localStorage keyed by nothing in particular. Clearing it loses the list, not
 * the conversation.
 */
const KEY = "bot-client:dms";
const MAX_STORED = 50;

export function loadStoredDms(): Channel[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
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

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pending: Channel[] | null = null;
let hydrated = false;

function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const list = pending;
  pending = null;
  if (!list) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

/**
 * Marks the stored list as merged into the store. Until this happens a write
 * would persist an in-memory map that is missing everything on disk, which
 * would delete the user's DM list instead of adding to it.
 */
export function markDmsHydrated() {
  hydrated = true;
  if (typeof window === "undefined") return;
  // A reload inside the debounce window would otherwise drop the last write.
  window.addEventListener("pagehide", flush);
}

/**
 * Persists the DM list. Every inbound DM touches its channel, so this is
 * coalesced: a burst of messages costs one write, not one per message.
 */
export function storeDms(dms: Iterable<Channel>) {
  if (typeof window === "undefined" || !hydrated) return;
  // Newest last in the Map, so the tail is what a user is most likely to
  // come back to.
  pending = Array.from(dms).slice(-MAX_STORED);
  if (flushTimer) return;
  flushTimer = setTimeout(flush, 500);
}
