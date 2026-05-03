import { Alert, Linking } from 'react-native';

const ALLOWED_SCHEMES = ['https:', 'http:'];

/**
 * Validate and open a URL safely.
 * Only allows http/https schemes to prevent scheme injection attacks.
 */
export async function safeOpenURL(url: string | undefined | null): Promise<boolean> {
  if (!url || typeof url !== 'string') {
    Alert.alert('Erreur', 'URL invalide.');
    return false;
  }

  try {
    const parsed = new URL(url);
    if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
      Alert.alert('Erreur', 'URL non autorisee.');
      return false;
    }
  } catch {
    Alert.alert('Erreur', 'URL malformee.');
    return false;
  }

  try {
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert('Erreur', 'Impossible d\'ouvrir le lien.');
    return false;
  }
}
