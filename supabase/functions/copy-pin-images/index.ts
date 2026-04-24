// ============================================================
// PINCHANTED — Reference Pin Image Copier
// supabase/functions/copy-pin-images/index.ts
//
// Downloads images from external source URLs and stores them
// in Supabase Storage under the 'reference-pins' bucket.
// Updates stored_image_path on each reference_pins row.
//
// Run via: POST /functions/v1/copy-pin-images
// Optional body: { batch_size: 50, offset: 0 }
// ============================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const STORAGE_BUCKET = 'reference-pins';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const dbHeaders = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// User agents to rotate through — some sites block default bot UAs
const USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

async function fetchPendingPins(batchSize: number, offset: number) {
  const url = `${SUPABASE_URL}/rest/v1/reference_pins?` +
    `select=id,image_url,source_site` +
    `&stored_image_path=is.null` +
    `&image_url=not.is.null` +
    `&limit=${batchSize}` +
    `&offset=${offset}` +
    `&order=created_at.asc`;

  const response = await fetch(url, { headers: dbHeaders });
  if (!response.ok) throw new Error(`Fetch pins failed: ${await response.text()}`);
  return await response.json();
}

function getExtension(contentType: string, url: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  // Try to infer from URL
  const urlLower = url.toLowerCase();
  if (urlLower.includes('.png')) return 'png';
  if (urlLower.includes('.webp')) return 'webp';
  if (urlLower.includes('.gif')) return 'gif';
  return 'jpg';
}

async function downloadImage(
  imageUrl: string,
  uaIndex: number = 0
): Promise<{ data: Uint8Array; contentType: string; failReason?: string } | null> {
  try {
    const ua = USER_AGENTS[uaIndex % USER_AGENTS.length];
    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(20000),
      redirect: 'follow',
      headers: {
        'User-Agent': ua,
        'Accept': 'image/webp,image/avif,image/jpeg,image/png,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': new URL(imageUrl).origin + '/',
      },
    });

    if (!response.ok) {
      return { data: new Uint8Array(), contentType: '', failReason: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') ?? '';

    // Reject HTML responses (bot detection pages, error pages)
    if (contentType.includes('text/html') || contentType.includes('text/plain')) {
      return { data: new Uint8Array(), contentType: '', failReason: `Non-image content-type: ${contentType}` };
    }

    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    // Reject suspiciously small responses (likely error pages)
    if (data.length < 500) {
      return { data: new Uint8Array(), contentType: '', failReason: `Response too small: ${data.length} bytes` };
    }

    // Validate it's actually an image by checking magic bytes
    const isJpeg = data[0] === 0xFF && data[1] === 0xD8;
    const isPng = data[0] === 0x89 && data[1] === 0x50;
    const isGif = data[0] === 0x47 && data[1] === 0x49;
    const isWebp = data[8] === 0x57 && data[9] === 0x45; // WEBP

    if (!isJpeg && !isPng && !isGif && !isWebp && !contentType.startsWith('image/')) {
      return { data: new Uint8Array(), contentType: '', failReason: `Not a valid image (magic bytes check failed)` };
    }

    const resolvedContentType = contentType.startsWith('image/')
      ? contentType
      : isJpeg ? 'image/jpeg'
      : isPng ? 'image/png'
      : isGif ? 'image/gif'
      : 'image/jpeg';

    return { data, contentType: resolvedContentType };
  } catch (err) {
    return { data: new Uint8Array(), contentType: '', failReason: err.message };
  }
}

async function uploadToStorage(
  pinId: string,
  imageData: Uint8Array,
  contentType: string,
  imageUrl: string
): Promise<string | null> {
  const ext = getExtension(contentType, imageUrl);
  const storagePath = `${pinId}.${ext}`;

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`;
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: imageData,
  });

  if (!response.ok) {
    console.warn(`Upload failed for ${pinId}:`, await response.text());
    return null;
  }
  return storagePath;
}

async function markAsFailed(pinId: string): Promise<void> {
  // Store a sentinel value so we don't retry permanently broken URLs
  const url = `${SUPABASE_URL}/rest/v1/reference_pins?id=eq.${pinId}`;
  await fetch(url, {
    method: 'PATCH',
    headers: dbHeaders,
    body: JSON.stringify({ stored_image_path: 'FAILED' }),
  });
}

async function updateStoredPath(pinId: string, storagePath: string): Promise<boolean> {
  const url = `${SUPABASE_URL}/rest/v1/reference_pins?id=eq.${pinId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: dbHeaders,
    body: JSON.stringify({ stored_image_path: storagePath }),
  });
  return response.ok;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  let body: any = {};
  try { body = await req.json(); } catch { /* no body */ }

  const batchSize = Math.min(body.batch_size ?? 50, 100);
  const offset = body.offset ?? 0;
  // Whether to retry previously failed items
  const retryFailed = body.retry_failed ?? false;

  try {
    // Fetch pending pins — exclude already processed (including FAILED sentinel)
    let url = `${SUPABASE_URL}/rest/v1/reference_pins?` +
      `select=id,image_url,source_site` +
      `&image_url=not.is.null` +
      `&source_site=neq.pinventory` +
      `&limit=${batchSize}` +
      `&offset=${offset}` +
      `&order=created_at.asc`;

    if (retryFailed) {
      // Only retry failed ones
      url += `&stored_image_path=eq.FAILED`;
    } else {
      // Skip both successfully stored and failed
      url += `&stored_image_path=is.null`;
    }

    const response = await fetch(url, { headers: dbHeaders });
    const pins = await response.json();

    console.log(`Processing ${pins.length} pins (offset: ${offset}, retry_failed: ${retryFailed})`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      failure_reasons: {} as Record<string, number>,
    };

    for (const pin of pins) {
      results.processed++;

      // Skip pinventory — their image server blocks non-browser requests
      if (pin.source_site === 'pinventory') {
        results.skipped++;
        continue;
      }

      if (!pin.image_url) {
        results.skipped++;
        continue;
      }

      // Try up to 2 different user agents
      let downloaded = null;
      for (let ua = 0; ua < 2; ua++) {
        downloaded = await downloadImage(pin.image_url, ua);
        if (downloaded && downloaded.data.length > 0) break;
        if (ua === 0) await new Promise(r => setTimeout(r, 500)); // brief pause before retry
      }

      if (!downloaded || downloaded.data.length === 0) {
        const reason = downloaded?.failReason ?? 'unknown';
        results.failed++;
        results.failure_reasons[reason] = (results.failure_reasons[reason] ?? 0) + 1;
        await markAsFailed(pin.id);
        continue;
      }

      const storagePath = await uploadToStorage(
        pin.id,
        downloaded.data,
        downloaded.contentType,
        pin.image_url
      );

      if (!storagePath) {
        results.failed++;
        await markAsFailed(pin.id);
        continue;
      }

      const updated = await updateStoredPath(pin.id, storagePath);
      if (!updated) {
        results.failed++;
        continue;
      }

      results.succeeded++;

      // Stop approaching Edge Function timeout
      if (Date.now() - startTime > 50000) {
        console.log('Approaching timeout, stopping early');
        break;
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);

    return new Response(
      JSON.stringify({
        ...results,
        elapsed_seconds: elapsed,
        batch_size: batchSize,
        offset,
        next_offset: offset + results.processed,
        has_more: pins.length === batchSize,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('copy-pin-images error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});