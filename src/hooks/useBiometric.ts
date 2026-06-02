import { useCallback, useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = 'fc_biometric_enabled';
const CREDENTIALS_EMAIL_KEY = 'fc_bio_email';
const CREDENTIALS_PASS_KEY = 'fc_bio_password';
// Bumped when the security shape of saved creds changes. On first launch
// after a bump, any pre-existing creds are wiped (since we can't be sure
// they were saved with the new SecureStore options).
const BIOMETRIC_MIGRATION_KEY = 'fc_biometric_migration_v2';
// Shown by the OS biometric prompt when reading the password.
const AUTH_PROMPT = 'Connexion à FlowContent';

/**
 * Standalone helper — used by AuthContext.logout() to wipe biometric creds
 * without needing a React hook context. Safe to call when not enabled.
 */
export async function clearBiometricCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(CREDENTIALS_EMAIL_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(CREDENTIALS_PASS_KEY).catch(() => {});
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false').catch(() => {});
}

export function useBiometric() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometric');

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setIsAvailable(compatible && enrolled);

      if (compatible && enrolled) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Touch ID');
        }
      }

      // One-time migration: pre-v2 saves stored the password in SecureStore
      // without `requireAuthentication`. We can't retroactively add the flag
      // (it's set at write time), so wipe + force re-enroll. Users will
      // re-enable biometric from Profile after their next login.
      const migrated = await AsyncStorage.getItem(BIOMETRIC_MIGRATION_KEY);
      if (!migrated) {
        await clearBiometricCredentials();
        await AsyncStorage.setItem(BIOMETRIC_MIGRATION_KEY, 'done');
        setIsEnabled(false);
        setHasSavedCredentials(false);
        return;
      }

      const stored = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      setIsEnabled(stored === 'true');
      const savedEmail = await SecureStore.getItemAsync(CREDENTIALS_EMAIL_KEY);
      setHasSavedCredentials(!!savedEmail);
    })();
  }, []);

  /**
   * Standalone biometric prompt — useful for "verify identity" flows
   * (e.g. resume-after-background lock) where we don't need to read creds.
   */
  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: AUTH_PROMPT,
        fallbackLabel: 'Utiliser le mot de passe',
        cancelLabel: 'Annuler',
        disableDeviceFallback: false,
      });
      return result.success;
    } catch {
      return false;
    }
  }, [isAvailable]);

  const saveCredentials = useCallback(async (email: string, password: string) => {
    await SecureStore.setItemAsync(CREDENTIALS_EMAIL_KEY, email);
    // requireAuthentication: reading the password requires a fresh OS biometric
    // (or device passcode) prompt — defends against on-device extraction.
    await SecureStore.setItemAsync(CREDENTIALS_PASS_KEY, password, {
      requireAuthentication: true,
      authenticationPrompt: AUTH_PROMPT,
    });
    setHasSavedCredentials(true);
  }, []);

  /**
   * Reading the password triggers the OS biometric prompt (because of
   * `requireAuthentication: true` set at save time). No separate authenticate()
   * call is needed before this — that would double-prompt.
   */
  const getSavedCredentials = useCallback(async (): Promise<{ email: string; password: string } | null> => {
    try {
      const email = await SecureStore.getItemAsync(CREDENTIALS_EMAIL_KEY);
      const password = await SecureStore.getItemAsync(CREDENTIALS_PASS_KEY, {
        requireAuthentication: true,
        authenticationPrompt: AUTH_PROMPT,
      });
      if (email && password) return { email, password };
      return null;
    } catch {
      // User cancelled biometric or read failed.
      return null;
    }
  }, []);

  const clearCredentials = useCallback(async () => {
    await clearBiometricCredentials();
    setHasSavedCredentials(false);
  }, []);

  const toggleEnabled = useCallback(async () => {
    const newVal = !isEnabled;
    if (newVal) {
      const ok = await authenticate();
      if (!ok) return;
    } else {
      // Disabling biometric — clear saved credentials
      await clearCredentials();
    }
    setIsEnabled(newVal);
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, newVal ? 'true' : 'false');
  }, [isEnabled, authenticate, clearCredentials]);

  return {
    isAvailable,
    isEnabled,
    hasSavedCredentials,
    biometricType,
    authenticate,
    saveCredentials,
    getSavedCredentials,
    clearCredentials,
    toggleEnabled,
  };
}
