import { useEffect } from 'react';
import { Linking } from 'react-native';

type Screen = 'chat' | 'notifications' | 'profile' | 'dashboard' | 'upgrade' | 'media';

interface DeepLinkResult {
  screen: Screen;
  sessionId?: string;
}

const VALID_SCREENS: readonly Screen[] = ['chat', 'notifications', 'profile', 'dashboard', 'upgrade', 'media'];
// Only HTTPS, only these hosts. http:// is rejected (MITM vector) — see AUDIT P0-2.
const ALLOWED_HOSTS = new Set(['flowcontent.io', 'app.flowcontent.io']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse a deeplink URL into a navigation target.
 *
 * Accepts:
 *   - Custom scheme:  `flowcontent://<screen>[/<sessionId>]`
 *   - Web (HTTPS only) on a whitelisted host: `https://flowcontent.io/app/<screen>[/<sessionId>]`
 *
 * Returns null on any deviation — unknown screen, non-UUID sessionId, plain
 * http://, foreign host, malformed URL. The strictness is intentional: a
 * deeplink can navigate the user into a session, so it must be trusted.
 */
function parseURL(url: string): DeepLinkResult | null {
  if (typeof url !== 'string' || !url) return null;

  let path: string;
  if (url.startsWith('flowcontent://')) {
    path = url.slice('flowcontent://'.length);
  } else {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (parsed.protocol !== 'https:') return null;
    if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) return null;
    if (!parsed.pathname.startsWith('/app/')) return null;
    path = parsed.pathname.slice('/app/'.length);
  }

  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  const route = parts[0] as Screen;
  if (!VALID_SCREENS.includes(route)) return null;

  let sessionId: string | undefined;
  if (route === 'chat' && parts[1]) {
    if (!UUID_RE.test(parts[1])) return null; // reject anything not a UUID
    sessionId = parts[1];
  }

  return { screen: route, sessionId };
}

export function useDeepLink(
  onNavigate: (screen: Screen, sessionId?: string) => void,
) {
  useEffect(() => {
    // Handle URL that launched the app
    Linking.getInitialURL().then((url) => {
      if (url) {
        const result = parseURL(url);
        if (result) onNavigate(result.screen, result.sessionId);
      }
    });

    // Handle URLs while app is running
    const sub = Linking.addEventListener('url', ({ url }) => {
      const result = parseURL(url);
      if (result) onNavigate(result.screen, result.sessionId);
    });

    return () => sub.remove();
  }, [onNavigate]);
}
