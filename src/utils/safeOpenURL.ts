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

/**
 * Open a phone dialer with a sanitized number.
 * Strips everything but digits, +, spaces, dashes and parens to block
 * scheme/argument injection into the tel: URL.
 */
export async function safeOpenTel(phone: string | undefined | null): Promise<boolean> {
  const clean = (phone ?? '').replace(/[^0-9+()\s-]/g, '').trim();
  if (!clean) {
    Alert.alert('Erreur', 'Numéro invalide.');
    return false;
  }
  try {
    await Linking.openURL(`tel:${clean}`);
    return true;
  } catch {
    Alert.alert('Erreur', 'Impossible de lancer l\'appel.');
    return false;
  }
}

/**
 * Open the mail composer for a validated email address.
 */
export async function safeOpenMailto(email: string | undefined | null): Promise<boolean> {
  const clean = (email ?? '').trim();
  if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    Alert.alert('Erreur', 'Adresse e-mail invalide.');
    return false;
  }
  try {
    await Linking.openURL(`mailto:${encodeURIComponent(clean)}`);
    return true;
  } catch {
    Alert.alert('Erreur', 'Impossible d\'ouvrir l\'e-mail.');
    return false;
  }
}
