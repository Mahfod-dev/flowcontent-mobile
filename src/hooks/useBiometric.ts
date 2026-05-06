import { useCallback, useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = 'fc_biometric_enabled';
const CREDENTIALS_EMAIL_KEY = 'fc_bio_email';
const CREDENTIALS_PASS_KEY = 'fc_bio_password';

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

      const stored = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      setIsEnabled(stored === 'true');

      // Check if we have saved credentials
      const savedEmail = await SecureStore.getItemAsync(CREDENTIALS_EMAIL_KEY);
      setHasSavedCredentials(!!savedEmail);
    })();
  }, []);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Connexion a FlowContent',
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
    await SecureStore.setItemAsync(CREDENTIALS_PASS_KEY, password);
    setHasSavedCredentials(true);
  }, []);

  const getSavedCredentials = useCallback(async (): Promise<{ email: string; password: string } | null> => {
    const email = await SecureStore.getItemAsync(CREDENTIALS_EMAIL_KEY);
    const password = await SecureStore.getItemAsync(CREDENTIALS_PASS_KEY);
    if (email && password) return { email, password };
    return null;
  }, []);

  const clearCredentials = useCallback(async () => {
    await SecureStore.deleteItemAsync(CREDENTIALS_EMAIL_KEY);
    await SecureStore.deleteItemAsync(CREDENTIALS_PASS_KEY);
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
