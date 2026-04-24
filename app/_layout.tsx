import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import 'react-native-url-polyfill/auto';
import { useAuthStore } from '../src/stores/auth.store';

// Handle notification taps — deep link to the relevant trade
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function RootLayout() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
    // Warm up withoutbg Docker instance on app launch
    fetch('https://bg.pinchanted.ca/api/health').catch(() => {});
  }, []);

  useEffect(() => {
    // Handle notification tap when app is foregrounded or opened from background
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, any>;
      const trade_id = data?.trade_id;

      if (trade_id) {
        // All trade-related notifications deep link to the trade
        router.push(`/trade/${trade_id}` as any);
      }
    });

    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/signup" />
        <Stack.Screen name="(auth)/forgot-password" />
        <Stack.Screen name="(onboarding)/step-1" />
        <Stack.Screen name="(onboarding)/step-2" />
        <Stack.Screen name="(onboarding)/step-3" />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="pin/[id]" />
        <Stack.Screen name="pin/add" />
        <Stack.Screen name="trade/[id]" />
        <Stack.Screen name="trade/new" />
        <Stack.Screen name="profile/index" />
        <Stack.Screen name="profile/[username]" />
        <Stack.Screen name="profile/shipping" />
        <Stack.Screen name="admin/index" />
        <Stack.Screen name="admin/users" />
        <Stack.Screen name="admin/pins" />
        <Stack.Screen name="admin/trades" />
        <Stack.Screen name="notifications" />
      </Stack>
    </>
  );
}