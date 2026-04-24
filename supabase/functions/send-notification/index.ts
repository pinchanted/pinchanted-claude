// ============================================================
// PINCHANTED — Send Notification Edge Function
// supabase/functions/send-notification/index.ts
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type NotificationPayload = { title: string; body: string };

function buildPayload(type: string, data: Record<string, any>): NotificationPayload | null {
  switch (type) {
    case 'trade_offer_received':
      return { title: '🎯 New trade offer!', body: `@${data.from_username} wants to trade ${data.pin_count} pin${data.pin_count !== 1 ? 's' : ''} with you. Tap to review their offer.` };
    case 'trade_offer_countered':
      return { title: '🔄 Trade counter offer', body: `@${data.from_username} has sent a counter offer on your trade. Tap to review.` };
    case 'trade_offer_accepted':
      return { title: '🎉 Trade accepted!', body: `@${data.from_username} accepted your trade offer! Time to arrange shipping.` };
    case 'trade_offer_declined':
      return { title: 'Trade declined', body: `@${data.from_username} declined your trade offer. Your pins are available again.` };
    case 'trade_offer_expiring':
      return { title: '⏱ Trade offer expiring soon', body: `Your trade with @${data.from_username} expires in ${data.hours_left} hours. Tap to respond.` };
    case 'trade_offer_expired':
      return { title: 'Trade offer expired', body: `Your trade offer with @${data.from_username} has expired. Your pins are available again.` };
    case 'trade_package_shipped':
      return { title: '📦 Package on its way!', body: `@${data.from_username} has shipped your pins. Check the trade for tracking details.` };
    case 'trade_proof_uploaded':
      return { title: '📸 Shipping proof uploaded', body: `@${data.from_username} uploaded proof of postage for your trade.` };
    case 'trade_package_received':
      return { title: '✅ Pins received!', body: `@${data.from_username} confirmed they received your pins. Please confirm yours too.` };
    case 'trade_completed':
      return { title: '✨ Trade complete!', body: `Your trade with @${data.from_username} is complete! ${data.pin_name} has been added to your collection.` };
    case 'trade_disputed':
      return { title: '⚠️ Trade dispute raised', body: `@${data.from_username} has raised a dispute on your trade. Our team will be in touch.` };
    case 'trade_message':
      return { title: `💬 Message from @${data.from_username}`, body: data.message ? `"${data.message}"` : 'Sent you a message in your trade. Tap to reply.' };
    case 'wishlist_pin_listed':
      return { title: '💫 Wishlist pin available!', body: `${data.pin_name} from your wishlist has been listed by @${data.seller_username}.` };
    case 'theme_pin_listed':
      return { title: `New ${data.theme} pin listed`, body: `${data.pin_name} was just listed in the Marketplace. Tap to take a look.` };
    case 'listing_interest':
      return { title: '👀 Someone is interested!', body: `@${data.from_username} is interested in your ${data.pin_name} listing.` };
    case 'listing_expired':
      return { title: 'Listing expired', body: `Your ${data.pin_name} listing has expired. Relist it to keep it in the Marketplace.` };
    case 'community_pin_verified':
      return { title: '✅ Pin verified!', body: `${data.pin_name} that you contributed has been verified and added to the database.` };
    case 'pin_confirmation_needed':
      return { title: 'Can you confirm this pin?', body: `Another collector added ${data.pin_name}. Tap to confirm if it looks right.` };
    case 'trial_ending':
      return { title: '⏳ Free trial ending soon', body: 'Your 48-hour free trial ends in 12 hours. Your subscription will activate automatically.' };
    case 'trial_ended':
      return { title: 'Welcome to Pinchanted! ✨', body: 'Your free trial has ended and your subscription is now active. Happy collecting!' };
    case 'subscription_renewing':
      return { title: 'Subscription renewing soon', body: `Your Pinchanted Collector subscription renews on ${data.date}.` };
    case 'subscription_failed':
      return { title: '⚠️ Payment failed', body: 'We could not process your subscription payment. Please update your payment method.' };
    case 'rating_received':
      return { title: '⭐ New trade rating', body: `@${data.from_username} gave you ${data.rating} star${data.rating !== 1 ? 's' : ''} for your recent trade!` };
    case 'admin_pin_submitted':
      return { title: '📌 New pin submitted', body: `@${data.username} submitted "${data.pin_name}" for review.` };
    case 'admin_dispute_flagged':
      return { title: '🚨 Trade dispute needs review', body: `A dispute has been raised on trade ${data.trade_id?.slice(0, 8)}. Tap to review.` };
    case 'admin_user_flagged':
      return { title: '🚨 User flagged', body: `@${data.username} has been flagged by another user. Tap to review their account.` };
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { type, recipient_id, data } = await req.json();

    if (!type || !recipient_id) {
      return new Response(
        JSON.stringify({ error: 'type and recipient_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = buildPayload(type, data || {});
    if (!payload) {
      return new Response(
        JSON.stringify({ error: `Unknown notification type: ${type}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: tokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', recipient_id);

    if (tokenError) {
      console.error('Error fetching push tokens:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch push tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Write to notifications table (in-app inbox)
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: recipient_id,
        type,
        title: payload.title,
        body: payload.body,
        data: data || {},
        is_read: false,
      });

    if (notifError) {
      console.error('Error writing notification record:', notifError);
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, pushed: 0, reason: 'no_tokens' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build push messages — include trade_id in data for deep linking
    const messages = tokens.map(({ token }: { token: string }) => ({
      to: token,
      title: payload.title,
      body: payload.body,
      data: { type, trade_id: data?.trade_id, ...data },
      sound: 'default',
      badge: 1,
    }));

    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate' },
      body: JSON.stringify(messages),
    });

    const pushResult = await pushResponse.json();

    if (pushResult.data) {
      for (const result of pushResult.data) {
        if (result.status === 'error') {
          console.error('Push error:', result.message, result.details);
          if (result.details?.error === 'DeviceNotRegistered' || result.message?.includes('InvalidCredentials')) {
            const failedToken = messages[pushResult.data.indexOf(result)]?.to;
            if (failedToken) {
              await supabase.from('push_tokens').delete().eq('token', failedToken);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, pushed: messages.length, results: pushResult.data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('send-notification error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});