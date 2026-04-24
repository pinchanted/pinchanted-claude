// ============================================================
// PINCHANTED — Auth Store
// src/stores/auth.store.ts
// ============================================================

import { create } from 'zustand';
import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';
import { supabase, getProfile } from '../lib/supabase';
import { Profile } from '../types/database.types';
import { registerForPushNotifications } from '../lib/notifications';
import Purchases from 'react-native-purchases';

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '';
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '';

const initRevenueCat = (userId: string) => {
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
  Purchases.configure({ apiKey });
  Purchases.logIn(userId).catch(console.warn);
};

const checkSubscription = async (): Promise<boolean> => {
  try {
    const info = await Purchases.getCustomerInfo();
    return typeof info.entitlements.active['premium'] !== 'undefined';
  } catch {
    return false;
  }
};

interface AuthState {
  user: any | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  hasActiveSubscription: boolean;
  initialize: () => Promise<void>;
  setUser: (user: any | null) => void;
  setProfile: (profile: Profile | null) => void;
  setHasActiveSubscription: (value: boolean) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const handlePostLoginNavigation = async (
  onboarded: boolean,
  isNewSession: boolean,
  hasSubscription: boolean
) => {
  if (onboarded) {
    // Returning onboarded user — check subscription
    if (hasSubscription) {
      router.replace('/(tabs)');
    } else {
      // Onboarded but no active subscription — show paywall
      router.replace('/paywall');
    }
    return;
  }

  if (isNewSession) {
    // Brand new signup — go to onboarding (paywall shown after step 3)
    router.replace('/(onboarding)/step-1');
  } else {
    // Returning user who hasn't finished onboarding — ask them
    Alert.alert(
      'Welcome back! 👋',
      'You haven\'t finished setting up your profile yet. Would you like to complete it now? It only takes a minute!',
      [
        {
          text: 'Maybe later',
          style: 'cancel',
          onPress: () => router.replace('/paywall'),
        },
        {
          text: 'Finish setup',
          onPress: () => router.replace('/(onboarding)/step-1'),
        },
      ]
    );
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  hasCompletedOnboarding: false,
  hasActiveSubscription: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profile } = await getProfile(session.user.id);
        const onboarded = !!profile?.collecting_experience;
        set({
          user: session.user,
          profile,
          isAuthenticated: true,
          hasCompletedOnboarding: onboarded,
          isLoading: false,
        });

        // Register for push notifications for returning session
        if (profile?.id) {
          registerForPushNotifications(profile.id).catch(console.warn);
          initRevenueCat(profile.id);
        }

        // Check subscription status for returning user
        const hasSub = await checkSubscription();
        set({ hasActiveSubscription: hasSub });

        // Returning user from a previous session
        handlePostLoginNavigation(onboarded, false, hasSub);
      } else {
        set({ isLoading: false });
        router.replace('/(auth)/login');
      }

      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const { data: profile } = await getProfile(session.user.id);
          const onboarded = !!profile?.collecting_experience;
          set({
            user: session.user,
            profile,
            isAuthenticated: true,
            hasCompletedOnboarding: onboarded,
          });

          // Register for push notifications on fresh sign in
          if (profile?.id) {
            registerForPushNotifications(profile.id).catch(console.warn);
            initRevenueCat(profile.id);
          }

          // Check subscription status
          const hasSub = await checkSubscription();
          set({ hasActiveSubscription: hasSub });

          // Check if this is a brand new user
          const isNewUser = !profile?.collecting_experience &&
            !profile?.collecting_style?.length;
          handlePostLoginNavigation(onboarded, isNewUser, hasSub);
        } else if (event === 'SIGNED_OUT') {
          set({
            user: null,
            profile: null,
            isAuthenticated: false,
            hasCompletedOnboarding: false,
            hasActiveSubscription: false,
          });
          router.replace('/(auth)/login');
        }
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ isLoading: false });
      router.replace('/(auth)/login');
    }
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setProfile: (profile) => set({
    profile,
    hasCompletedOnboarding: !!profile?.collecting_experience,
  }),

  setHasActiveSubscription: (value) =>
    set({ hasActiveSubscription: value }),

  refreshProfile: async () => {
    const { user } = get();
    if (!user) return;
    const { data: profile } = await getProfile(user.id);
    if (profile) {
      set({
        profile,
        hasCompletedOnboarding: !!profile.collecting_experience,
      });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      user: null,
      profile: null,
      isAuthenticated: false,
      hasCompletedOnboarding: false,
      hasActiveSubscription: false,
    });
    router.replace('/(auth)/login');
  },
}));