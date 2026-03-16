import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { apiCall } from '../api/client';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotifications(token: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) {
    console.log('[PUSH] Not a physical device, skipping push registration');
    return null;
  }

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
}

export function usePushNotifications(authToken: string | null) {
  const router = useRouter();
  const responseListener = useRef<Notifications.Subscription>();
  const receivedListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    if (!authToken) return;

    // Register for push
    registerForPushNotifications(authToken);

    // Listen for notifications received while app is in foreground
    receivedListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[PUSH] Received:', notification.request.content.title);
    });

    // Listen for notification taps (user taps notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
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
