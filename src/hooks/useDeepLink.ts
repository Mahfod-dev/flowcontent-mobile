import { useEffect } from 'react';
import { Linking } from 'react-native';

type Screen = 'chat' | 'notifications' | 'profile' | 'dashboard' | 'upgrade' | 'media';

interface DeepLinkResult {
  screen: Screen;
  sessionId?: string;
}

function parseURL(url: string): DeepLinkResult | null {
  try {
    // flowcontent://chat/abc-123  or  https://flowcontent.io/app/chat/abc-123
    const cleaned = url
      .replace('flowcontent://', '')
      .replace('https://flowcontent.io/app/', '')
      .replace('http://flowcontent.io/app/', '');

    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length === 0) return null;

    const route = parts[0] as Screen;
    const validScreens: Screen[] = ['chat', 'notifications', 'profile', 'dashboard', 'upgrade', 'media'];
    if (!validScreens.includes(route)) return null;

    return {
      screen: route,
      sessionId: route === 'chat' && parts[1] ? parts[1] : undefined,
    };
  } catch {
    return null;
  }
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
