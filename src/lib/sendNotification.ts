// ============================================================
// PINCHANTED — Notification Sender
// src/lib/sendNotification.ts
//
// Client-side helper to trigger push notifications by calling
// the send-notification Supabase Edge Function.
//
// Usage:
//   import { sendNotification } from '../lib/sendNotification';
//
//   await sendNotification('trade_offer_received', trade.recipient_id, {
//     from_username: profile.username,
//     pin_count: offeredPinIds.length,
//     trade_id: trade.id,
//   });
// ============================================================

import { supabase } from './supabase';

export const sendNotification = async (
  type: string,
  recipientId: string,
  data: Record<string, any> = {}
): Promise<void> => {
  try {
    const { error } = await supabase.functions.invoke('send-notification', {
      body: { type, recipient_id: recipientId, data },
    });

    if (error) {
      console.warn('sendNotification error:', error.message);
    }
  } catch (err) {
    // Never throw — notification failure should never block the main action
    console.warn('sendNotification failed silently:', err);
  }
};