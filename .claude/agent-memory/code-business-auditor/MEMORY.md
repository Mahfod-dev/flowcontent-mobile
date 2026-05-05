# FlowContent Mobile - Audit Memory

## Project Structure
- React Native / Expo SDK 55, iOS-focused
- 32 source files, ~4500 LOC
- Pattern: `createStyles(colors: ColorPalette)` for dynamic theming
- Auth: JWT + refresh tokens in expo-secure-store (Keychain)
- Socket: socket.io-client to `/fc-agent-chat` namespace
- i18n: `i18n-js` with fr/en, 209 keys each, auto-detect locale

## Key Patterns
- Services are singletons (apiService, socketService, notificationService)
- `authFetch()` wraps all API calls with proactive token refresh + 401 retry
- `fetchWithTimeout()` with exponential backoff on 429/5xx (max 3 retries)
- Stream buffer: 22ms flush interval, first token flushes immediately
- Safety net: 8s timeout after POST, force socket reconnect if no stream event
- Stream timeout: 2 min, then polling recovery via API

## Known Issues (Audit 5 May 2026)
- Sentry installed but NEVER initialized - zero crash reporting
- `notificationMarkdownTheme` is static dark-only export (breaks light mode)
- `cardUnread` in NotificationsScreen has hardcoded dark color `#1E1E1E`
- StatusBar always `style="light"` (invisible in light mode)
- ~15 hardcoded French strings outside i18n (useBiometric, useSpeech, suggestions, timeAgo)
- OAuth Client ID mismatch: app.json scheme uses `124777433323-*`, env uses `323350263219-*`
- .env.example has real production Google Client ID (should be placeholder)
- Sidebar mounts/unmounts on drawer open/close, triggering redundant API calls each time
- `commonStyles` is static dark palette (overridden inline but fragile)

## Architecture Strengths
- Solid token refresh flow with anti-concurrent `_refreshPromise` singleton
- `safeOpenURL()` validates scheme before Linking.openURL
- Session timeout 30 min background + auto-logout
- Deep link validation against whitelist
- FlatList properly configured with virtualization params
- MessageBubble wrapped in memo()
