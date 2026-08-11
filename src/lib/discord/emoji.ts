/** A reaction emoji as it travels over the gateway and through the store. */
export interface EmojiRef {
  id?: string | null;
  name?: string | null;
  animated?: boolean;
}

/**
 * Identity of a reaction the way the REST API wants it in a path segment:
 * `name` for unicode, `name:id` for a custom emoji. Callers still have to
 * encodeURIComponent it.
 */
export function reactionApiKey(emoji: EmojiRef): string | null {
  if (emoji.id && emoji.name) return `${emoji.name}:${emoji.id}`;
  if (emoji.name) return emoji.name;
  return null;
}

/** Stable key for a reaction within one message, for React lists and lookups. */
export function reactionKey(emoji: EmojiRef): string {
  return emoji.id ? `c:${emoji.id}` : `u:${emoji.name ?? ""}`;
}

/** True when two emoji refs point at the same reaction. */
export function sameEmoji(a: EmojiRef, b: EmojiRef): boolean {
  return a.id ? a.id === b.id : !b.id && a.name === b.name;
}

const CUSTOM_TOKEN = /^<(a)?:([\w~]+):(\d+)>$/;

/**
 * Parses what the emoji picker hands back. It emits `<:name:id>` for custom
 * emoji and a bare unicode character otherwise.
 */
export function parseEmojiToken(token: string): {
  key: string;
  emoji: EmojiRef;
} {
  const m = token.match(CUSTOM_TOKEN);
  if (!m) return { key: token, emoji: { id: null, name: token } };
  return {
    key: `${m[2]}:${m[3]}`,
    emoji: { id: m[3], name: m[2], animated: !!m[1] },
  };
}
