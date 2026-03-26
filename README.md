# FlowContent Mobile

Application mobile FC-Agent — interface chat native pour iOS et Android.

## Stack
- Expo (React Native + TypeScript)
- Socket.IO client — streaming temps réel vers FC-Agent
- AsyncStorage — persistance du token JWT
- Navigation React Navigation (Stack)

## Démarrage rapide

```bash
npm install
npx expo start
```

Scannez le QR code avec **Expo Go** (iOS/Android) pour tester sans build.

## Variables d'environnement

Copiez `.env` et ajustez si besoin :
```
EXPO_PUBLIC_API_URL=https://flowbackendapi.store
```

## Build production

```bash
# iOS
npx eas build --platform ios

# Android
npx eas build --platform android
```

## Architecture

```
src/
├── contexts/AuthContext.tsx   — auth JWT + socket reconnect
├── hooks/useChat.ts           — streaming WebSocket FC-Agent
├── screens/
│   ├── LoginScreen.tsx        — connexion email/password
│   └── ChatScreen.tsx         — interface chat principale
├── components/MessageBubble.tsx
├── services/
│   ├── api.ts                 — REST endpoints
│   └── socket.ts              — Socket.IO /fc-agent-chat
└── types/index.ts
```
