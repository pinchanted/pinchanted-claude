// ============================================================
// PINCHANTED — Auth Store
// src/stores/auth.store.ts
// ============================================================

import { create } from 'zustand';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { supabase, getProfile } from '../lib/supabase';
import { Profile } from '../types/database.types';

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

const handlePostLoginNavigation = (
  onboarded: boolean,
  isNewSession: boolean
) => {
  if (onboarded) {
    router.replace('/(tabs)');
    return;
  }

  if (isNewSession) {
    // Brand new signup — go straight to onboarding
    router.replace('/(onboarding)/step-1');
  } else {
    // Returning user who hasn't finished — ask them
    Alert.alert(
      'Welcome back! 👋',
      'You haven\'t finished setting up your profile yet. Would you like to complete it now? It only takes a minute!',
      [
        {
          text: 'Maybe later',
          style: 'cancel',
          onPress: () => router.replace('/(tabs)'),
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
        // Returning user from a previous session
        handlePostLoginNavigation(onboarded, false);
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
          // Check if this is a brand new user
          const isNewUser = !profile?.collecting_experience &&
            !profile?.collecting_style?.length;
          handlePostLoginNavigation(onboarded, isNewUser);
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