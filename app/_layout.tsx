import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import 'react-native-url-polyfill/auto';
import { useAuthStore } from '../src/stores/auth.store';
import { Colors } from '../src/constants/colors';

export default function RootLayout() {
  const { isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  if (isLoading) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: Colors.backgroundDark,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

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
        <Stack.Screen name="paywall" />
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
      </Stack>
    </>
  );
}