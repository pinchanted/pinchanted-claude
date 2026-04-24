// ============================================================
// PINCHANTED — Background Removal Proxy
// supabase/functions/remove-background/index.ts
//
// Requests a JPEG from withoutbg (not PNG) — JPEG has no
// alpha channel so the service composites onto white automatically.
// Retries once on failure to handle Docker cold starts.
// ============================================================

const WITHOUTBG_URL = 'https://bg.pinchanted.ca/api/remove-background';
const RETRY_DELAY_MS = 5000;
const MAX_ATTEMPTS = 2;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

async function callWithoutBg(blob: Blob, extension: string): Promise<Response> {
  const formData = new FormData();
  formData.append('file', blob, `pin.${extension}`);
  // Request JPEG output — withoutbg will composite transparent areas
  // onto white automatically since JPEG has no alpha channel
  formData.append('format', 'jpg');
  formData.append('quality', '92');
  return await fetch(WITHOUTBG_URL, { method: 'POST', body: formData });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'imageBase64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert base64 to blob
    const binaryStr = atob(imageBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const extension = mimeType.split('/')[1] ?? 'jpg';

    // Attempt with retry for Docker cold-start handling
    let bgResponse: Response | null = null;
    let lastError = '';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        bgResponse = await callWithoutBg(blob, extension);
        if (bgResponse.ok) break;

        const errText = await bgResponse.text();
        lastError = `withoutbg attempt ${attempt} returned ${bgResponse.status}: ${errText}`;
        console.warn(lastError);

        if (attempt < MAX_ATTEMPTS) {
          console.log(`Retrying in ${RETRY_DELAY_MS}ms...`);
          await sleep(RETRY_DELAY_MS);
        }
      } catch (fetchErr) {
        lastError = `withoutbg attempt ${attempt} threw: ${fetchErr.message}`;
        console.warn(lastError);
        if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
      }
    }

    if (!bgResponse?.ok) {
      return new Response(
        JSON.stringify({ error: lastError }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert response binary to base64
    const arrayBuffer = await bgResponse.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const resultBase64 = btoa(binary);

    // Check what format was actually returned
    const contentType = bgResponse.headers.get('content-type') ?? 'image/jpeg';

    return new Response(
      JSON.stringify({
        resultBase64,
        backgroundRemoved: true,
        mimeType: contentType,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('remove-background error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});