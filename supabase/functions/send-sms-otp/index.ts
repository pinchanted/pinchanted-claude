// ============================================================
// PINCHANTED — Send Email OTP Edge Function
// supabase/functions/send-sms-otp/index.ts
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    const cleanEmail = email?.trim().toLowerCase();

    if (!cleanEmail) {
      return new Response(
        JSON.stringify({ error: 'Email required' }),
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

    console.log('User lookup:', userId ? 'found' : 'not found', userError);

    if (userError || !userId) {
      // Don't reveal if email exists
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Store code directly on the profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        reset_code: code,
        reset_code_expires_at: expiresAt,
      })
      .eq('id', userId);

    console.log('Code stored:', updateError ? 'error' : 'success', JSON.stringify(updateError));

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Could not store reset code.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email via IONOS SMTP
    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get('SMTP_HOST')!,
        port: Number(Deno.env.get('SMTP_PORT')!),
        tls: true,
        auth: {
          username: Deno.env.get('SMTP_USERNAME')!,
          password: Deno.env.get('SMTP_PASSWORD')!,
        },
      },
    });

    await client.send({
      from: `Pinchanted <${Deno.env.get('SMTP_FROM')!}>`,
      to: cleanEmail,
      subject: 'Your Pinchanted password reset code',
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f1d6e;border-radius:16px;color:#fff;">
          <div style="text-align:center;margin-bottom:24px;">
            <p style="font-size:32px;margin:0;">📌</p>
            <h1 style="font-size:22px;font-weight:500;margin:8px 0 0;color:#fff;">Pinchanted</h1>
          </div>
          <h2 style="font-size:18px;font-weight:500;color:#fff;text-align:center;margin-bottom:8px;">
            Your password reset code
          </h2>
          <p style="color:rgba(255,255,255,0.6);text-align:center;font-size:14px;margin-bottom:24px;">
            Enter this code in the Pinchanted app to reset your password.
          </p>
          <div style="background:rgba(245,197,24,0.15);border:1px solid rgba(245,197,24,0.4);border-radius:12px;padding:28px;text-align:center;margin-bottom:24px;">
            <span style="font-size:42px;font-weight:700;letter-spacing:14px;color:#f5c518;">${code}</span>
          </div>
          <p style="color:rgba(255,255,255,0.4);text-align:center;font-size:13px;line-height:1.6;">
            This code expires in <strong style="color:rgba(255,255,255,0.65);">10 minutes</strong>.<br/>
            If you did not request this, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    await client.close();
    console.log('Email sent successfully');

    return new Response(
      JSON.stringify({ success: true }),
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
