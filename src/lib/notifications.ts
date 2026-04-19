// ============================================================
// PINCHANTED — Push Notification Helpers
// src/lib/notifications.ts
// ============================================================

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { savePushToken } from './supabase';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Request permission and get push token
export const registerForPushNotifications = async (
  userId: string
): Promise<string | null> => {
  // Check existing permissions
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  // Request if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  // User declined — return null
  if (finalStatus !== 'granted') {
    return null;
  }

  // Get the push token
  const token = await Notifications.getExpoPushTokenAsync();

  // Save to database
  const platform = Platform.OS as 'ios' | 'android';
  await savePushToken(userId, token.data, platform);

  return token.data;
};

// ============================================================
// NOTIFICATION TEMPLATES
// These match every notification type in our database schema
// ============================================================

export const NotificationTemplates = {
  // ── Trade notifications ─────────────────────────────────────
  trade_offer_received: (fromUsername: string, pinCount: number) => ({
    title: '🎯 New trade offer!',
    body: `@${fromUsername} wants to trade ${pinCount} pin${pinCount > 1 ? 's' : ''} with you. Tap to review their offer.`,
  }),

  trade_offer_countered: (fromUsername: string) => ({
    title: '🔄 Trade counter offer',
    body: `@${fromUsername} has sent a counter offer on your trade. Tap to review.`,
  }),

  trade_offer_accepted: (fromUsername: string) => ({
    title: '🎉 Trade accepted!',
    body: `@${fromUsername} accepted your trade offer! Time to arrange shipping.`,
  }),

  trade_offer_declined: (fromUsername: string) => ({
    title: 'Trade declined',
    body: `@${fromUsername} declined your trade offer. Your pins are available again.`,
  }),

  trade_offer_expiring: (fromUsername: string, hoursLeft: number) => ({
    title: '⏱ Trade offer expiring soon',
    body: `Your trade with @${fromUsername} expires in ${hoursLeft} hours. Tap to respond.`,
  }),

  trade_offer_expired: (fromUsername: string) => ({
    title: 'Trade offer expired',
    body: `Your trade offer with @${fromUsername} has expired. Your pins are available again.`,
  }),

  trade_package_shipped: (fromUsername: string) => ({
    title: '📦 Package on its way!',
    body: `@${fromUsername} has shipped your pins. Check the trade for tracking details.`,
  }),

  trade_proof_uploaded: (fromUsername: string) => ({
    title: '📸 Shipping proof uploaded',
    body: `@${fromUsername} uploaded proof of postage for your trade.`,
  }),

  trade_package_received: (fromUsername: string) => ({
    title: '✅ Pins received!',
    body: `@${fromUsername} confirmed they received your pins. Please confirm yours too.`,
  }),

  trade_completed: (fromUsername: string, pinName: string) => ({
    title: '✨ Trade complete!',
    body: `Your trade with @${fromUsername} is complete! ${pinName} has been added to your collection.`,
  }),

  trade_disputed: (fromUsername: string) => ({
    title: '⚠️ Trade dispute raised',
    body: `@${fromUsername} has raised a dispute on your trade. Our team will be in touch.`,
  }),

  // ── Marketplace notifications ───────────────────────────────
  wishlist_pin_listed: (pinName: string, sellerUsername: string) => ({
    title: '💫 Wishlist pin available!',
    body: `${pinName} from your wishlist has been listed by @${sellerUsername}.`,
  }),

  theme_pin_listed: (pinName: string, theme: string) => ({
    title: `New ${theme} pin listed`,
    body: `${pinName} was just listed in the Marketplace. Tap to take a look.`,
  }),

  listing_interest: (fromUsername: string, pinName: string) => ({
    title: '👀 Someone is interested!',
    body: `@${fromUsername} is interested in your ${pinName} listing.`,
  }),

  listing_expired: (pinName: string) => ({
    title: 'Listing expired',
    body: `Your ${pinName} listing has expired. Relist it to keep it in the Marketplace.`,
  }),

  // ── Collection notifications ────────────────────────────────
  community_pin_verified: (pinName: string) => ({
    title: '✅ Pin verified!',
    body: `${pinName} that you contributed has been verified and added to the database.`,
  }),

  pin_confirmation_needed: (pinName: string) => ({
    title: 'Can you confirm this pin?',
    body: `Another collector added ${pinName}. Tap to confirm if it looks right.`,
  }),

  // ── Account notifications ───────────────────────────────────
  trial_ending: () => ({
    title: '⏳ Free trial ending soon',
    body: 'Your 48-hour free trial ends in 12 hours. Your subscription will activate automatically.',
  }),

  trial_ended: () => ({
    title: 'Welcome to Pinchanted! ✨',
    body: 'Your free trial has ended and your subscription is now active. Happy collecting!',
  }),

  subscription_renewing: (date: string) => ({
    title: 'Subscription renewing soon',
    body: `Your Pinchanted Collector subscription renews on ${date}.`,
  }),

  subscription_failed: () => ({
    title: '⚠️ Payment failed',
    body: 'We could not process your subscription payment. Please update your payment method.',
  }),

  rating_received: (fromUsername: string, rating: number) => ({
    title: '⭐ New trade rating',
    body: `@${fromUsername} gave you ${rating} star${rating > 1 ? 's' : ''} for your recent trade!`,
  }),

  // ── Admin notifications ─────────────────────────────────────
  admin_pin_submitted: (pinName: string, username: string) => ({
    title: '📌 New pin submitted',
    body: `@${username} submitted "${pinName}" for review.`,
  }),

  admin_dispute_flagged: (tradeId: string) => ({
    title: '🚨 Trade dispute needs review',
    body: `A dispute has been raised on trade ${tradeId.slice(0, 8)}. Tap to review.`,
  }),

  admin_user_flagged: (username: string) => ({
    title: '🚨 User flagged',
    body: `@${username} has been flagged by another user. Tap to review their account.`,
  }),
};