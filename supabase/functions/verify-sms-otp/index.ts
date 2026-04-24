// ============================================================
// PINCHANTED — Verify Email OTP + Reset Password Edge Function
// supabase/functions/verify-sms-otp/index.ts
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, code, new_password } = await req.json();

    const cleanEmail = email?.trim().toLowerCase();
    const cleanCode = code?.trim();

    console.log('Request - email:', cleanEmail, 'code length:', cleanCode?.length, 'has_password:', !!new_password);

    if (!cleanEmail || !cleanCode) {
      return new Response(
        JSON.stringify({ error: 'Email and code required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Look up user id by email
    const { data: userId, error: userError } = await supabase
      .rpc('get_user_id_by_email', { user_email: cleanEmail });

    console.log('User lookup:', userId ? 'found' : 'not found');

    if (userError || !userId) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired code. Please try again.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up reset code on the profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('reset_code, reset_code_expires_at')
      .eq('id', userId)
      .single();

    console.log('Profile lookup:', profileError ? 'error' : 'success');
    console.log('Code match:', profile?.reset_code === cleanCode);
    console.log('Expired:', profile?.reset_code_expires_at
      ? new Date(profile.reset_code_expires_at) < new Date()
      : 'no expiry');

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired code. Please try again.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate code
    if (!profile.reset_code || profile.reset_code !== cleanCode) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired code. Please try again.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiry
    if (!profile.reset_code_expires_at ||
        new Date(profile.reset_code_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'This code has expired. Please request a new one.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Code is valid — if new_password provided, update it now
    if (new_password) {
      if (new_password.length < 8) {
        return new Response(
          JSON.stringify({ error: 'Password must be at least 8 characters.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update password using admin API
      const { error: passwordError } = await supabase.auth.admin
        .updateUserById(userId, { password: new_password });

      console.log('Password update:', passwordError ? 'error' : 'success');

      if (passwordError) {
        return new Response(
          JSON.stringify({ error: 'Could not update password. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Clear the reset code so it can't be reused
      await supabase
        .from('profiles')
        .update({
          reset_code: null,
          reset_code_expires_at: null,
        })
        .eq('id', userId);

      console.log('Password updated and code cleared');

      return new Response(
        JSON.stringify({ success: true, password_updated: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Code valid but no password yet — just confirm code is correct
    return new Response(
      JSON.stringify({ success: true, code_verified: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error:', err?.message, err?.stack);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: err?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
