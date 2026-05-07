export const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";
export const API_BASE = "https://discord.com/api/v10";
export const CDN_BASE = "https://cdn.discordapp.com";

export const OP = {
  DISPATCH: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  PRESENCE_UPDATE: 3,
  VOICE_STATE_UPDATE: 4,
  RESUME: 6,
  RECONNECT: 7,
  REQUEST_GUILD_MEMBERS: 8,
  INVALID_SESSION: 9,
  HELLO: 10,
  HEARTBEAT_ACK: 11,
} as const;

export const INTENTS = {
  GUILDS: 1 << 0,
  GUILD_MEMBERS: 1 << 1,
  GUILD_MODERATION: 1 << 2,
  GUILD_EXPRESSIONS: 1 << 3,
  GUILD_INTEGRATIONS: 1 << 4,
  GUILD_WEBHOOKS: 1 << 5,
  GUILD_INVITES: 1 << 6,
  GUILD_VOICE_STATES: 1 << 7,
  GUILD_PRESENCES: 1 << 8,
  GUILD_MESSAGES: 1 << 9,
  GUILD_MESSAGE_REACTIONS: 1 << 10,
  GUILD_MESSAGE_TYPING: 1 << 11,
  DIRECT_MESSAGES: 1 << 12,
  DIRECT_MESSAGE_REACTIONS: 1 << 13,
  DIRECT_MESSAGE_TYPING: 1 << 14,
  MESSAGE_CONTENT: 1 << 15,
  GUILD_SCHEDULED_EVENTS: 1 << 16,
  AUTO_MODERATION_CONFIGURATION: 1 << 20,
  AUTO_MODERATION_EXECUTION: 1 << 21,
} as const;

export const PRIVILEGED_INTENTS =
  INTENTS.GUILD_MEMBERS | INTENTS.GUILD_PRESENCES | INTENTS.MESSAGE_CONTENT;

export const NON_PRIVILEGED_INTENTS =
  INTENTS.GUILDS |
  INTENTS.GUILD_MESSAGES |
  INTENTS.GUILD_MESSAGE_REACTIONS |
  INTENTS.GUILD_MESSAGE_TYPING |
  INTENTS.DIRECT_MESSAGES |
  INTENTS.GUILD_MODERATION |
  INTENTS.GUILD_EXPRESSIONS |
  INTENTS.GUILD_INVITES;

export const DEFAULT_INTENTS = PRIVILEGED_INTENTS | NON_PRIVILEGED_INTENTS;

export const CHANNEL_TYPE = {
  GUILD_TEXT: 0,
  DM: 1,
  GUILD_VOICE: 2,
  GROUP_DM: 3,
  GUILD_CATEGORY: 4,
  GUILD_ANNOUNCEMENT: 5,
  ANNOUNCEMENT_THREAD: 10,
  PUBLIC_THREAD: 11,
  PRIVATE_THREAD: 12,
  GUILD_STAGE_VOICE: 13,
  GUILD_DIRECTORY: 14,
  GUILD_FORUM: 15,
  GUILD_MEDIA: 16,
} as const;

export const PERMISSIONS: Record<string, bigint> = {
  Administrator: 1n << 3n,
  "Manage Server": 1n << 5n,
  "Manage Roles": 1n << 28n,
  "Manage Channels": 1n << 4n,
  "Ban Members": 1n << 2n,
  "Kick Members": 1n << 1n,
  "Manage Webhooks": 1n << 29n,
  "Manage Events": 1n << 33n,
  "Manage Threads": 1n << 34n,
  "Manage Guild Expressions": 1n << 30n,
  "Create Guild Expressions": 1n << 43n,
  "Create Events": 1n << 44n,
  "Manage Nicknames": 1n << 27n,
  "Change Nickname": 1n << 26n,
  "Moderate Members": 1n << 40n,
  "View Audit Log": 1n << 7n,
  "View Guild Insights": 1n << 19n,
  "View Channel": 1n << 10n,
  "Send Messages": 1n << 11n,
  "Send TTS Messages": 1n << 12n,
  "Manage Messages": 1n << 13n,
  "Embed Links": 1n << 14n,
  "Attach Files": 1n << 15n,
  "Read Message History": 1n << 16n,
  "Mention Everyone": 1n << 17n,
  "Send Messages in Threads": 1n << 38n,
  "Send Voice Messages": 1n << 46n,
  "Send Polls": 1n << 49n,
  "Pin Messages": 1n << 51n,
  "Add Reactions": 1n << 6n,
  "Use External Emojis": 1n << 18n,
  "Use External Stickers": 1n << 37n,
  "Use Application Commands": 1n << 31n,
  Connect: 1n << 20n,
  Speak: 1n << 21n,
  "Mute Members": 1n << 22n,
  "Deafen Members": 1n << 23n,
  "Move Members": 1n << 24n,
  "Use VAD": 1n << 25n,
  "Priority Speaker": 1n << 8n,
  Stream: 1n << 9n,
  "Request to Speak": 1n << 32n,
  "Create Instant Invite": 1n << 0n,
  "Create Public Threads": 1n << 35n,
  "Create Private Threads": 1n << 36n,
  "Use Soundboard": 1n << 42n,
};

export const STATUS_COLOR: Record<string, string> = {
  online: "bg-green-500",
  idle: "bg-yellow-500",
  dnd: "bg-red-500",
  offline: "bg-zinc-500",
  invisible: "bg-zinc-500",
};
