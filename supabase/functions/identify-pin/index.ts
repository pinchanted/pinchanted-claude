// ============================================================
// PINCHANTED — Pin Identification via Claude AI
// supabase/functions/identify-pin/index.ts
//
// Flow:
// 1. Claude identifies the pin from the image
// 2. Search reference_pins table using fuzzy text matching
//    on the names Claude returned
// 3. Enrich Claude's matches with reference pin data
//    (verified price, dates, image URLs, source URLs)
// 4. Return enriched results to the app
// ============================================================

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const PROMPT = `You are an expert Disney pin collector and identifier with encyclopedic knowledge of Disney trading pins.

Analyze this image and identify the Disney pin(s) shown.

Respond ONLY with a valid JSON object in this exact format, no other text:
{
  "is_disney_pin": true or false,
  "general_description": "brief description of what you see",
  "matches": [
    {
      "name": "exact pin name",
      "series_name": "series or collection name, or null",
      "edition": "Limited Edition" or "Open Edition" or "Limited Release" or null,
      "origin": "park or store of origin, or null",
      "original_price": estimated original retail price as number or null,
      "release_date": "YYYY" or "YYYY-MM" or null,
      "confidence": confidence score from 0.0 to 1.0,
      "description": "brief description of this specific pin"
    }
  ]
}

Rules:
- Provide up to 3 matches ordered by confidence (highest first)
- If you can clearly identify the pin, confidence should be 0.85 or higher
- If the image is unclear, provide multiple matches with lower confidence
- If it is not a Disney pin, set is_disney_pin to false and matches to empty array
- Be specific — include character names, year, event if visible
- For edition: only use "Limited Edition", "Open Edition", or "Limited Release"
- Prices should be in USD`;

// Search reference_pins using trigram fuzzy matching
async function searchReferencePins(name: string, seriesName: string | null): Promise<any[]> {
  if (!name?.trim()) return [];

  // Build RPC call for fuzzy search using pg_trgm similarity
  const searchName = name.trim();

  let url = `${SUPABASE_URL}/rest/v1/rpc/search_reference_pins`;
  const body: any = { search_name: searchName, result_limit: 3 };
  if (seriesName?.trim()) {
    body.search_series = seriesName.trim();
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.warn('Reference pin search failed:', await response.text());
    return [];
  }

  return await response.json();
}

// Enrich a Claude match with reference pin data if a good match is found
function enrichMatch(claudeMatch: any, referencePin: any | null): any {
  if (!referencePin) return claudeMatch;

  return {
    ...claudeMatch,
    // Prefer reference data for factual fields
    series_name: referencePin.series_name ?? claudeMatch.series_name,
    edition: referencePin.edition ?? claudeMatch.edition,
    origin: referencePin.origin ?? claudeMatch.origin,
    original_price: referencePin.original_price ?? claudeMatch.original_price,
    release_date: referencePin.release_date ?? claudeMatch.release_date,
    // Add reference-only fields
    reference_pin_id: referencePin.id,
    reference_image_url: referencePin.image_url,
    source_url: referencePin.source_url,
    source_site: referencePin.source_site,
    similarity_score: referencePin.similarity_score,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable not set');
    }

    const { image_base64, image_type = 'image/jpeg' } = await req.json();

    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: 'image_base64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Ask Claude to identify the pin
    const claudeResponse = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: image_type,
                  data: image_base64,
                },
              },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      throw new Error(`Claude API error: ${claudeResponse.status} ${errorText}`);
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    const cleanJson = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const claudeResult = JSON.parse(cleanJson);

    // Step 2: If Claude found matches, search reference_pins for each
    if (claudeResult.is_disney_pin && claudeResult.matches?.length > 0) {
      const enrichedMatches = await Promise.all(
        claudeResult.matches.map(async (match: any) => {
          try {
            const referenceResults = await searchReferencePins(
              match.name,
              match.series_name
            );
            // Use the top reference result if similarity is good enough
            const bestRef = referenceResults?.[0] ?? null;
            const similarityThreshold = 0.3;
            if (bestRef && (bestRef.similarity_score ?? 0) >= similarityThreshold) {
              return enrichMatch(match, bestRef);
            }
            return match;
          } catch (err) {
            console.warn('Reference search error for match:', match.name, err);
            return match;
          }
        })
      );

      claudeResult.matches = enrichedMatches;
    }

    return new Response(
      JSON.stringify(claudeResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('identify-pin error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});