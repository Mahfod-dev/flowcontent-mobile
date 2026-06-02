import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { apiService } from './api';

const PUSH_TOKEN_KEY = 'fc_expo_push_token';

// Show notifications even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let _onNotificationTap: ((sessionId: string) => void) | null = null;

/**
 * AUDIT B5 — Push token persistence moved from AsyncStorage (plaintext) to
 * SecureStore. Includes a one-shot migration: on first access we copy any
 * AsyncStorage value over and remove the legacy key.
 */
async function getSavedPushToken(): Promise<string | null> {
  try {
    const secure = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (secure) return secure;
    const legacy = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (legacy) {
      await SecureStore.setItemAsync(PUSH_TOKEN_KEY, legacy).catch(() => {});
      AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => {});
      return legacy;
    }
  } catch {}
  return null;
}

async function setSavedPushToken(token: string) {
  try {
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  } catch {}
  // Ensure the legacy plaintext copy is gone
  AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => {});
}

async function clearSavedPushToken() {
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY).catch(() => {});
  AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => {});
}

export const notificationService = {
  setOnNotificationTap(cb: (sessionId: string) => void) {
    _onNotificationTap = cb;
  },

  async init(token: string): Promise<string | null> {
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;

      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return null;
      }

      // Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      const pushToken = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '5b21a603-9782-43d0-ab6d-dfeee96622ba',
      });

      const expoPushToken = pushToken.data;

      // Register on backend + persist locally for logout cleanup
      await apiService.registerDeviceToken(token, expoPushToken);
      await setSavedPushToken(expoPushToken);

      return expoPushToken;
    } catch (err) {
      if (__DEV__) console.warn('[Push] Init error:', err);
      return null;
    }
  },

  /** Listen for notification taps (user taps a notification) */
  addTapListener() {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.sessionId && _onNotificationTap) {
        _onNotificationTap(data.sessionId as string);
      }
    });
    return subscription;
  },

  async unregister(token: string, expoPushToken: string) {
    await apiService.unregisterDeviceToken(token, expoPushToken);
  },

  // Exposed for AuthContext to restore the push token on session resume
  // and to clean it up on logout — no plaintext path remains.
  getSavedPushToken,
  clearSavedPushToken,
};
