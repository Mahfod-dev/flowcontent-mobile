# Audit FlowContent Mobile — 2026-06-02

Audit complet de l'app (Expo SDK 55 / RN 0.83.6) après stabilisation du
streaming chat en SSE. Traitement par batchs, du plus critique au polish.

Convention :
- **P0** = bug visible utilisateur, crash, ou risque sécurité
- **P1** = à corriger pour la qualité prod
- **P2** = polish / dette / micro-perf

---

## P0 — Sécurité & crashs

| ID | Fichier | Problème | Statut |
|----|---------|----------|--------|
| P0-1 | `ErrorBoundary.tsx` | Couleurs hardcodées → écran d'erreur illisible en mode clair | ⏳ |
| P0-2 | `useDeepLink.ts:17` | Fallback `http://` accepté (vecteur MITM) | ⏳ |
| P0-3 | `useDeepLink.ts` | Pas de validation hostname ni format sessionId | ⏳ |
| P0-4 | `app.json` Android | Perms `READ_MEDIA_*` absentes → crash Android 13+ | ⏳ |
| P0-5 | `useBiometric.ts` | Password stocké en clair dans SecureStore | ⏳ |
| P0-6 | `AuthContext.tsx` | `logout()` ne nettoie pas les credentials biométriques | ⏳ |
| P0-7 | `AppState` listeners | 3 listeners indépendants firent à 'active' sans coordination | ⏳ |
| P0-8 | App.tsx animations | `AccessibilityInfo.isReduceMotionEnabled` jamais consulté | ⏳ |
| P0-9 | `ChatScreen.tsx` input | `insets.bottom` manquant → bouton sur home indicator | ⏳ |
| P0-10 | `ChatScreen.tsx` | `keyboardVerticalOffset={0}` cache l'input sous le clavier | ⏳ |

## P1 — Qualité prod

### Chat / réseau
- `useChat.ts` : `lastErrorRef` non reset au changement de session
- `api.ts:81` (`parseSseFrame`) : erreurs JSON silencieuses
- `api.ts:34` (`fetchWithTimeout`) : retry sur AbortError (annulation utilisateur)
- `api.ts:389` : message d'erreur HTTP vide quand body non-JSON
- `socket.ts:10` : heartbeat 5 min trop long → 2-3 min
- `socket.ts:36` : `removeAllListeners` avant `attachListenersToSocket`
- `ChatScreen.tsx:128` : `pendingMessage` ignore `sessionId` dans deps
- `api.ts:118` : refresh token rotation — lock persistant si serveur invalide à l'usage

### Auth / sécurité
- `api.ts:12` : `decodeJwtPayload` — commentaire « info-only, never authz »
- `App.tsx:105` + `notifications.ts` : push registration à chaque token change
- `api.ts:164` : `X-Site-Domain` sans validation côté setter
- `notifications.ts:55` : push token en AsyncStorage → SecureStore

### Build / monitoring
- `package.json` : `punycode` inutilisé
- Sentry référencé mais jamais initialisé
- `console.*` non gardés `__DEV__`
- `EXPO_PUBLIC_EAS_PROJECT_ID` manquant en `.env`

### UI
- `ChatScreen.tsx` FlatList : `onContentSizeChange` manquant pour auto-scroll
- `MessageBubble.tsx:394` : hitSlop trop petit (recommandé Apple ≥ 44pt)
- `SkillsScreen.tsx` (1351 l) : refacto en 3 fichiers
- `Sidebar.tsx` SwipeableRow : flag `isAnimating`
- App.tsx : pas de `BackHandler` Android

## P2 — Polish / perf

- Mémoïsation : `Sidebar` `renderSession`, `MediaScreen` `filteredFiles`,
  `NotificationsScreen` markdown, `App.tsx` `PanResponder` dans `useRef`
- `SkillsScreen.tsx:480` : `ScrollView horizontal` → `FlatList horizontal`
- A11y : `accessibilityHint` Sidebar footer, `Skeleton` role progressbar,
  `lineHeight` code blocks
- `markdown onLinkPress` → `safeOpenURL`
- `expo-speech-recognition` : `^` → `~`
- `api.ts:857` : log au cleanup AsyncStorage legacy

---

## Faux positifs (vérifiés, écartés)

- ❌ « Slicing bug dans `useChat.retry()` » → calcul correct (le dernier
  message user est bien retiré pour être re-envoyé par `sendMessage`).
- ❌ « Double-set après `stream:complete` tardif » → `doneProcessedRef`
  garde proprement les deux chemins.
- ❌ « JWT decode = faille » → décodage informatif uniquement, autorisation
  reste serveur. À documenter, pas à corriger.

---

## Plan d'exécution

| Batch | Contenu | P |
|-------|---------|---|
| 1 | Sécurité (deeplink, biometric, X-Site-Domain) | P0 |
| 2 | Crashs UI (ErrorBoundary, perms Android, safe area, keyboard, reduce motion) | P0 |
| 3 | `useAppForeground` centralisé | P0 |
| 4 | Chat / réseau résiduel | P1 |
| 5 | Auth / push notifications | P1 |
| 6 | Build / monitoring | P1 |
| 7 | UI résiduel | P1 |
| 8 | Perf (mémoïsation, listes) | P2 |
| 9 | A11y polish | P2 |
| 10 | Divers (markdown, deps) | P2 |
