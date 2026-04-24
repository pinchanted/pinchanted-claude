// ============================================================
// PINCHANTED — Trade Pin Transfer
// supabase/functions/transfer-trade-pins/index.ts
//
// Transfers pins between users when they confirm receipt.
// Runs with service role key to bypass RLS policies.
//
// Called when a user taps "I received my pins" in a trade.
// ============================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const dbHeaders = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify JWT to get the calling user's ID
    const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': authHeader,
      },
    });

    if (!verifyRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { id: callerUserId } = await verifyRes.json();

    const { trade_id, pin_ids, recipient_user_id } = await req.json();

    if (!trade_id || !pin_ids?.length || !recipient_user_id) {
      return new Response(
        JSON.stringify({ error: 'trade_id, pin_ids, and recipient_user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the caller is actually a party in this trade
    const tradeRes = await fetch(
      `${SUPABASE_URL}/rest/v1/trades?id=eq.${trade_id}&select=initiator_id,recipient_id,status`,
      { headers: dbHeaders }
    );
    const trades = await tradeRes.json();
    const trade = trades?.[0];

    if (!trade) {
      return new Response(
        JSON.stringify({ error: 'Trade not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isParty = trade.initiator_id === callerUserId || trade.recipient_id === callerUserId;
    if (!isParty) {
      return new Response(
        JSON.stringify({ error: 'You are not a party in this trade' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the trade is in a valid state for transfer
    if (!['shipping', 'delivered'].includes(trade.status)) {
      return new Response(
        JSON.stringify({ error: `Trade is in status '${trade.status}' — cannot transfer pins` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transfer pins to the recipient using service role (bypasses RLS)
    const pinIdsList = pin_ids.map((id: string) => `"${id}"`).join(',');
    const transferRes = await fetch(
      `${SUPABASE_URL}/rest/v1/collection_pins?id=in.(${pinIdsList})`,
      {
        method: 'PATCH',
        headers: dbHeaders,
        body: JSON.stringify({
          user_id: recipient_user_id,
          trade_status: 'available',
          trade_id: null,
        }),
      }
    );

    if (!transferRes.ok) {
      const errText = await transferRes.text();
      console.error('Transfer failed:', errText);
      return new Response(
        JSON.stringify({ error: `Pin transfer failed: ${errText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Transferred ${pin_ids.length} pins to user ${recipient_user_id} for trade ${trade_id}`);

    return new Response(
      JSON.stringify({ success: true, transferred: pin_ids.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('transfer-trade-pins error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});