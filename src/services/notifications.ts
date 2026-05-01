import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { apiService } from './api';

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
      await AsyncStorage.setItem('fc_expo_push_token', expoPushToken);

      return expoPushToken;
    } catch (err) {
      console.warn('[Push] Init error:', err);
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
};
