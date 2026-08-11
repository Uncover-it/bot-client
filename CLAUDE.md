# CLAUDE.md

Notes for future Claude. Keep this short and useful.

## What this is

Unofficial **Discord Bot Client** ([Uncover-it/bot-client](https://github.com/Uncover-it/bot-client)). A Next.js 16 web app that logs in with a Discord **bot token** and acts as a full Discord client for that bot: browse guilds, channels, members, send/edit/delete messages, manage roles/channels/permissions, etc.

- Auth: bot token stored in an HTTP-only `token` cookie. No DB. No user accounts.
- Real-time: direct browser WebSocket to `wss://gateway.discord.gg` (Discord Gateway v10).
- REST: server actions in `src/api/*/actions.ts` proxy to `https://discord.com/api/v10` with `Authorization: Bot <token>`.

## Branch / git

- **Working branch: `rewrite`** (do work here unless told otherwise).
- `main` is the published / deployed branch.
- Recent rewrite history is shallow: `0ed3783 init` is the rewrite baseline.

## Stack

- Next.js 16 (App Router) + React 19, TypeScript strict.
- **React Compiler is on** (`reactCompiler: true` in `next.config.ts`, via
  `babel-plugin-react-compiler`). Components and hooks are auto-memoized, so
  new code does not need `useMemo`/`useCallback` for plain render work. Keep
  them only where the value must be referentially stable for a non-React
  reason. Existing manual memoization is harmless and was left alone.
- Bun runtime (`bun --bun next ...`). Lockfile is `bun.lock`.
- Tailwind v4 (`@tailwindcss/postcss`), `tw-animate-css`.
- shadcn/ui-style primitives in `src/components/ui/` (Radix under the hood via `radix-ui`).
- State: Zustand (`src/lib/store.ts` — `useRealtimeStore`).
- Markdown: `react-markdown` + `remark-gfm`.
- Toasts: `sonner`. Icons: `lucide-react`. Emoji picker: `frimousse`.

## Scripts

- `bun run dev` — dev server (port 3000).
- `bun run build` / `bun run start` — prod.
- `bun run lint` — Biome (`biome check`). `bun run format` writes fixes.
- `bunx tsc --noEmit` — typecheck.

## Path alias

`@/*` → `src/*` (see `tsconfig.json`).

## Directory map

```
src/
  app/                       Next.js App Router
    page.tsx                 Login screen (token entry)
    layout.tsx               Root layout
    dashboard/
      layout.tsx             Auth gate + GatewayProvider + Sidebar shell
      page.tsx               Dashboard landing
      servers/[serverId]/
        settings/page.tsx    Per-guild settings
        channels/[channelId]/page.tsx   Channel view (the main UI)
      dms/[channelId]/page.tsx          DM view
  api/                       "use server" actions (NOT route handlers)
    session/actions.ts       getSessionToken, getCurrentUser
    validate/actions.ts      validateToken
    data/actions.ts          ALL Discord REST: guilds, channels, messages,
                             roles, members, bans, emojis, stickers, reactions,
                             pins, typing, kick/ban/timeout, etc.
  components/
    sidebar.tsx              Guild + channel navigation sidebar
    login.tsx                Token form
    settings.tsx             Bot/app settings
    stickerList.tsx
    contextMenuHandellers.tsx  (sic — typo, kept as-is)
    theme-toggle.tsx, year-footer.tsx
    providers/
      gateway-provider.tsx   Boots gateway + REST ping interval
    discord/                 Feature components (the "chat" UI)
      channel-view.tsx       Channel container (text/voice/forum dispatch)
      dm-view.tsx            DM container (same message stack, no guild)
      dm-sidebar-section.tsx DM list + "new conversation" dialog
      message-list.tsx       Message list + day dividers + jump-to-reply + hover toolbar
      message.tsx            Single message row (avatar, name, content, reply ref)
      message-input.tsx      Composer with reply state, typing, attachments
      message-content.tsx    Markdown + mention rendering
      message-reactions.tsx  Reaction pills (toggle + hover reactor preview)
      reaction-viewer.tsx    Who-reacted tooltip body + per-emoji dialog
      message-embed.tsx, message-attachment.tsx
      member-list.tsx        Right sidebar members
      timeout-banner.tsx     Shown when the bot itself is timed out
      unread-badge.tsx       Per-channel unread count
      session-overview.tsx   Dashboard landing readout
      forum-view.tsx, voice-view.tsx
      channel-settings-dialog.tsx, server-settings.tsx, role-editor.tsx
      user-profile-popover.tsx, status-bar.tsx, emoji-picker-pro.tsx
      intent-warning.tsx     Banner when privileged intents are missing
    ui/                      shadcn primitives (button, dialog, sidebar, ...)
  hooks/
    use-gateway.ts           Connects DiscordGateway, pipes events to store
    use-permissions.ts       Channel/guild permission resolution
    use-self-timeout.ts      Is the bot timed out here, plus countdown
    use-open-dm.ts           Open/create a DM and navigate to it
    use-sidebar-resize.ts, use-mobile.ts, use-hydrated.ts
  lib/
    store.ts                 Zustand realtime store (guilds, messages, members,
                             selfMembers, presences, typing, dms, unread)
    utils.ts                 cn() etc.
    merge-button-refs.ts
    discord/
      gateway.ts             DiscordGateway class (WS, heartbeat, resume, intents)
      constants.ts           OP, INTENTS, PRIVILEGED_INTENTS, CHANNEL_TYPE, PERMISSIONS, DM_PERMISSIONS, GATEWAY_URL, API_BASE, CDN_BASE
      types.ts               Discord API TS types (User, Guild, Channel, Message, ...)
      permissions.ts         Permission bit logic
      emoji.ts               Reaction emoji keys and picker-token parsing
      dm-storage.ts          localStorage persistence for the DM list
      cdn.ts                 avatarUrl, memberAvatarUrl, guildIconUrl, emojiUrl, stickerUrl, ...
  proxy.ts                   Next middleware: redirects "/" <-> "/dashboard" based on token cookie
```

## How data flows

1. User submits token at `/` → `validateToken` → set `token` cookie → redirect `/dashboard`.
2. `dashboard/layout.tsx` reads cookie via `getSessionToken`, fetches `getCurrentUser`, mounts `GatewayProvider`.
3. `GatewayProvider` calls `useGateway(token)` which instantiates `DiscordGateway` and pipes dispatch events into `useRealtimeStore`.
4. UI components read from `useRealtimeStore` (selectors) and call server actions in `src/api/data/actions.ts` for mutations / pagination.
5. REST ping is polled every 30s for the status bar.
6. `MESSAGE_CREATE` also drives unread counts (`bumpUnread`) and, for a DM,
   registers the channel. `openChannel` clears the count and marks the channel
   active; `MessageList` clears `activeChannelId` on unmount.

## Conventions / gotchas

- Server actions live in `src/api/*/actions.ts` (top of file: `"use server"`). No `app/api/.../route.ts` handlers.
- Cookie auth: every authed action calls `await cookies()` then `Authorization: Bot <token>`. Never log the token.
- The store is plain Maps; mutations always copy the Map (`new Map(state.x)`) before `set`. Follow that pattern.
- `message-list.tsx` uses `data-message-id` on each row so jump-to-reply can `querySelector` and scroll/highlight.
- `shouldGroup` in `message.tsx` decides whether a message reuses the previous author's avatar/name (no avatar, tighter padding).
- `contextMenuHandellers.tsx` is intentionally misspelled — don't "fix" the filename without grepping callers.
- Privileged intents (`GUILD_MEMBERS`, `GUILD_PRESENCES`, `MESSAGE_CONTENT`) must be enabled in the Discord developer portal; UI surfaces a warning via `intent-warning.tsx`.
- `serverId` is optional through the whole message stack (`MessageList`,
  `MessageInput`, `MessageItem`, `MessageReactions`, `EmojiPickerPro`).
  Absent means DM. `useChannelPermissions(undefined, id)` returns
  `DM_PERMISSIONS`, and guild-only affordances (moderation, stickers, member
  list, @-mention search) are hidden.
- **Bots cannot list their DMs.** There is no endpoint, and `READY.private_channels`
  is empty for bots. The DM list is client memory: `store.dms`, persisted to
  localStorage by `dm-storage.ts`, fed by `CHANNEL_CREATE`, by `rememberDm` in
  `use-gateway.ts` when a DM message arrives, and by `useOpenDm`. So a fresh
  browser shows no DMs even when the bot has a long history with someone.
  Recovery is by person: `POST /users/@me/channels` returns the *existing*
  channel, and its history then loads normally. `dm-compose-dialog.tsx` is
  that recovery path (search shared-server members, or paste a user ID).
  Do not "fix" the empty list by inventing an enumeration endpoint.
- `storeDms` refuses to write before `markDmsHydrated()`, otherwise the first
  write would persist an in-memory map missing everything on disk and wipe the
  user's list.
- Permission and timeout lookups read `store.selfMembers` (the bot's own
  member per guild), not `store.members`. Scanning the members array in a
  selector re-runs for every member chunk and shows up immediately when
  hundreds of message rows subscribe.
- Resolve permissions once in the list and pass booleans down (`canReact`,
  `canManage`). Do not call `useChannelPermissions` per message row.
- Message rows use `contain: layout style paint`, deliberately not
  `content-visibility: auto`: the latter gives off-screen rows a placeholder
  height and breaks the scroll restore in `loadOlder`.

## Style rules (from global CLAUDE.md)

- No em dashes anywhere (code, commits, PRs, chat). Use periods, commas, colons, parens.
- No emojis unless the user asks in this turn.
- No `Co-Authored-By: Claude` trailers, no "Generated with Claude Code" footers in commits.
- Plain English, short sentences. German if user writes German.

## Useful greps

- Find a Discord REST call: `grep -n "function <name>" src/api/data/actions.ts`
- Find gateway event handling: open `src/hooks/use-gateway.ts` and search for the event name.
- Find a permission check: `grep -rn "can(perms" src/`
- Find store selectors: `grep -rn "useRealtimeStore((s)" src/`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
