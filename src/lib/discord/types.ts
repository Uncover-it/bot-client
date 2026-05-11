export type Snowflake = string;

export interface User {
  id: Snowflake;
  username: string;
  discriminator: string;
  global_name?: string | null;
  avatar?: string | null;
  bot?: boolean;
  banner?: string | null;
  accent_color?: number | null;
  banner_color?: string | null;
}

export interface Role {
  id: Snowflake;
  name: string;
  color: number;
  hoist: boolean;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
  icon?: string | null;
}

export interface GuildMember {
  user?: User;
  nick?: string | null;
  avatar?: string | null;
  roles: Snowflake[];
  joined_at: string;
  premium_since?: string | null;
  deaf: boolean;
  mute: boolean;
  pending?: boolean;
  communication_disabled_until?: string | null;
}

export interface Channel {
  id: Snowflake;
  type: number;
  guild_id?: Snowflake;
  position?: number;
  name?: string;
  topic?: string | null;
  nsfw?: boolean;
  parent_id?: Snowflake | null;
  permission_overwrites?: PermissionOverwrite[];
  rate_limit_per_user?: number;
  last_message_id?: Snowflake | null;
  bitrate?: number;
  user_limit?: number;
  default_auto_archive_duration?: number;
  default_thread_rate_limit_per_user?: number;
  available_tags?: ForumTag[];
  message_count?: number;
  member_count?: number;
  thread_metadata?: ThreadMetadata;
  applied_tags?: Snowflake[];
  owner_id?: Snowflake;
}

export interface ForumTag {
  id: Snowflake;
  name: string;
  moderated: boolean;
  emoji_id?: Snowflake | null;
  emoji_name?: string | null;
}

export interface ThreadMetadata {
  archived: boolean;
  auto_archive_duration: number;
  archive_timestamp: string;
  locked: boolean;
  invitable?: boolean;
  create_timestamp?: string | null;
}

export interface Ban {
  user: User;
  reason?: string | null;
}

export interface PermissionOverwrite {
  id: Snowflake;
  type: 0 | 1;
  allow: string;
  deny: string;
}

export interface Guild {
  id: Snowflake;
  name: string;
  icon?: string | null;
  banner?: string | null;
  owner_id?: Snowflake;
  permissions?: string;
  features: string[];
  description?: string | null;
  premium_tier?: number;
  member_count?: number;
  channels?: Channel[];
  roles?: Role[];
  members?: GuildMember[];
  presences?: Presence[];
  emojis?: Emoji[];
}

export interface Emoji {
  id?: Snowflake | null;
  name?: string | null;
  animated?: boolean;
  available?: boolean;
}

export interface Presence {
  user: { id: Snowflake };
  status: "online" | "idle" | "dnd" | "offline" | "invisible";
  activities: Activity[];
  client_status: { desktop?: string; mobile?: string; web?: string };
}

export interface Activity {
  name: string;
  type: number;
  state?: string;
  details?: string;
  url?: string | null;
  application_id?: Snowflake;
  emoji?: { name: string; id?: Snowflake; animated?: boolean };
  timestamps?: { start?: number; end?: number };
  assets?: {
    large_image?: string;
    large_text?: string;
    small_image?: string;
    small_text?: string;
  };
  party?: { id?: string; size?: [number, number] };
  buttons?: string[];
  sync_id?: string;
  session_id?: string;
}

export interface Attachment {
  id: Snowflake;
  filename: string;
  size: number;
  url: string;
  proxy_url: string;
  content_type?: string;
  width?: number;
  height?: number;
}

export interface Embed {
  title?: string;
  type?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: { text: string; icon_url?: string; proxy_icon_url?: string };
  image?: { url: string; proxy_url?: string; width?: number; height?: number };
  thumbnail?: { url: string; proxy_url?: string; width?: number; height?: number };
  author?: { name: string; url?: string; icon_url?: string; proxy_icon_url?: string };
  fields?: { name: string; value: string; inline?: boolean }[];
}

export interface Reaction {
  count: number;
  me: boolean;
  emoji: Emoji;
  __pending?: boolean;
}

export interface StickerItem {
  id: Snowflake;
  name: string;
  format_type: number;
}

export interface MessageReference {
  message_id?: Snowflake;
  channel_id?: Snowflake;
  guild_id?: Snowflake;
}

export interface Message {
  id: Snowflake;
  channel_id: Snowflake;
  guild_id?: Snowflake;
  author: User;
  member?: GuildMember;
  content: string;
  timestamp: string;
  edited_timestamp?: string | null;
  tts: boolean;
  mention_everyone: boolean;
  mentions: User[];
  mention_roles: Snowflake[];
  mention_channels?: { id: Snowflake; name: string; type: number }[];
  attachments: Attachment[];
  embeds: Embed[];
  reactions?: Reaction[];
  sticker_items?: StickerItem[];
  pinned: boolean;
  type: number;
  referenced_message?: Message | null;
  message_reference?: MessageReference;
  flags?: number;
  nonce?: string | number;
  __pending?: boolean;
  __failed?: boolean;
}

export interface GatewayPayload {
  op: number;
  d?: unknown;
  s?: number | null;
  t?: string | null;
}
