import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { apiCall } from '../api/client';

// Dynamic imports to prevent crash if native module is missing
let Notifications: any = null;
let Device: any = null;
let Constants: any = null;

try {
  Notifications = require('expo-notifications');
  Device = require('expo-device');
  Constants = require('expo-constants');

  // Configure how notifications appear when app is in foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  console.warn('[PUSH] expo-notifications not available (native module missing, needs rebuild):', e);
}

async function registerForPushNotifications(token: string): Promise<string | null> {
  if (!Notifications || !Device || !Constants) return null;
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) {
    console.log('[PUSH] Not a physical device, skipping push registration');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[PUSH] Permission not granted');
      return null;
    }

    // Get the Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const pushToken = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const expoPushToken = pushToken.data;
    console.log('[PUSH] Token:', expoPushToken);

    // Register token with backend
    try {
      await apiCall('/push-token', {
        method: 'POST',
        token,
        body: {
          token: expoPushToken,
          device_type: Platform.OS,
        },
      });
      console.log('[PUSH] Token registered with backend');
    } catch (e) {
      console.warn('[PUSH] Failed to register token:', e);
    }

    // Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'FantaPronostic',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F5A623',
      });
    }

    return expoPushToken;
  } catch (e) {
    console.warn('[PUSH] Registration failed:', e);
    return null;
  }
}

export function usePushNotifications(authToken: string | null) {
  const router = useRouter();
  const responseListener = useRef<any>();
  const receivedListener = useRef<any>();

  useEffect(() => {
    if (!authToken || !Notifications) return;

    // Register for push
    registerForPushNotifications(authToken);

    // Listen for notifications received while app is in foreground
    receivedListener.current = Notifications.addNotificationReceivedListener((notification: any) => {
      console.log('[PUSH] Received:', notification.request.content.title);
    });

    // Listen for notification taps (user taps notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data;
      const link = data?.link as string;
      if (link) {
        router.push(link as any);
      }
    });

    return () => {
      if (receivedListener.current) Notifications.removeNotificationSubscription(receivedListener.current);
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [authToken]);
}
