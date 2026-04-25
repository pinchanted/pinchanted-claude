// ============================================================
// PINCHANTED — Claude API Helper
// src/lib/claude.ts
// ============================================================
import { Platform } from 'react-native';
import { supabase } from './supabase';

const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

export interface PinMatch {
  name: string;
  series_name: string | null;
  edition: string | null;
  origin: string | null;
  original_price: number | null;
  release_date: string | null;
  confidence: number;
  description: string;
  // Set when matched to a verified database record
  reference_pin_id?: string | null;
  community_pin_id?: string | null;
  // Reference image from the database record (for display in results)
  reference_image_url?: string | null;
  source_url?: string | null;
  source_site?: string | null;
  // Where this match came from
  match_source?: 'reference_pins' | 'collection_pins' | 'ai_only';
}

export interface IdentifyPinResult {
  is_disney_pin: boolean;
  general_description: string;
  matches: PinMatch[];
}

const detectImageType = (
  base64: string
): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' => {
  try {
    const header = base64.substring(0, 16);
    const decoded = atob(header);
    const bytes = decoded.split('').map(c => c.charCodeAt(0));
    if (bytes[0] === 0x52 && bytes[1] === 0x49) return 'image/webp';
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'image/jpeg';
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
    if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
  } catch {
    // ignore
  }
  return 'image/jpeg';
};

// ── Step 2: Search reference_pins for each AI-identified candidate ──────────
// Uses ilike for fuzzy name matching. Returns the best database match per
// candidate, attaching the reference_pin_id so add.tsx can link directly.
const searchReferencePins = async (candidates: PinMatch[]): Promise<PinMatch[]> => {
  const enriched: PinMatch[] = [];

  for (const candidate of candidates) {
    if (!candidate.name) {
      enriched.push({ ...candidate, match_source: 'ai_only' });
      continue;
    }

    // Search reference_pins by name (fuzzy)
    const { data: refMatches } = await supabase
      .from('reference_pins')
      .select('id, name, series_name, edition, origin, original_price, release_date, image_url, stored_image_path, source_url, source_site')
      .ilike('name', `%${candidate.name.replace(/'/g, "''")}%`)
      .limit(3);

    if (refMatches && refMatches.length > 0) {
      // Best reference match — use its metadata as the authoritative source
      const best = refMatches[0];
      enriched.push({
        ...candidate,
        // Override with database metadata where available
        name: best.name,
        series_name: best.series_name ?? candidate.series_name,
        edition: best.edition ?? candidate.edition,
        origin: best.origin ?? candidate.origin,
        original_price: best.original_price ?? candidate.original_price,
        release_date: best.release_date ?? candidate.release_date,
        reference_pin_id: best.id,
        reference_image_url: best.image_url || best.stored_image_path || null,
        source_url: best.source_url ?? null,
        match_source: 'reference_pins',
      });
      continue;
    }

    // No reference_pin match — search other users' collection_pins
    const { data: collectionMatches } = await supabase
      .from('collection_pins')
      .select(`
        id,
        community_pin_id,
        my_image_path,
        override_name,
        override_series_name,
        override_edition,
        override_origin,
        override_original_price,
        override_release_date,
        community_pin:community_pins(
          id, name, series_name, edition, origin, original_price, release_date, image_path
        )
      `)
      .ilike('community_pin.name', `%${candidate.name.replace(/'/g, "''")}%`)
      .not('community_pin_id', 'is', null)
      .eq('is_deleted', false)
      .limit(3);

    if (collectionMatches && collectionMatches.length > 0) {
      const best = collectionMatches[0];
      const cp = best.community_pin as any;
      if (cp) {
        enriched.push({
          ...candidate,
          name: best.override_name ?? cp.name ?? candidate.name,
          series_name: best.override_series_name ?? cp.series_name ?? candidate.series_name,
          edition: best.override_edition ?? cp.edition ?? candidate.edition,
          origin: best.override_origin ?? cp.origin ?? candidate.origin,
          original_price: best.override_original_price ?? cp.original_price ?? candidate.original_price,
          release_date: best.override_release_date ?? cp.release_date ?? candidate.release_date,
          community_pin_id: cp.id,
          reference_image_url: cp.image_path ?? best.my_image_path ?? null,
          match_source: 'collection_pins',
        });
        continue;
      }
    }

    // No database match found — return AI-only result
    enriched.push({ ...candidate, match_source: 'ai_only' });
  }

  return enriched;
};

// ── Call Claude directly from web browser ───────────────────────────────────
const identifyViaDirectAPI = async (
  base64Data: string
): Promise<IdentifyPinResult> => {
  const mediaType = detectImageType(base64Data);
  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
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
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            { type: 'text', text: getPrompt() },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const aiResult = parseClaudeResponse(data);

  // Enrich with database matches
  const enrichedMatches = await searchReferencePins(aiResult.matches);
  return { ...aiResult, matches: enrichedMatches };
};

// ── Call Claude via Supabase Edge Function (native) ─────────────────────────
const identifyViaEdgeFunction = async (
  base64Data: string
): Promise<IdentifyPinResult> => {
  const { data, error } = await supabase.functions.invoke('identify-pin', {
    body: {
      image_base64: base64Data,
      image_type: detectImageType(base64Data),
    },
  });

  if (error) throw error;

  const aiResult = data as IdentifyPinResult;

  // Enrich with database matches after Edge Function returns
  const enrichedMatches = await searchReferencePins(aiResult.matches);
  return { ...aiResult, matches: enrichedMatches };
};

const getPrompt = () =>
  `You are an expert Disney pin collector and identifier with encyclopedic knowledge of Disney trading pins.

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

const parseClaudeResponse = (data: any): IdentifyPinResult => {
  const responseText = data.content
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('');

  const cleanJson = responseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  return JSON.parse(cleanJson);
};

export const identifyPinWithClaude = async (
  imageBase64: string
): Promise<IdentifyPinResult> => {
  const base64Data = imageBase64.includes(',')
    ? imageBase64.split(',')[1]
    : imageBase64;

  // Use Edge Function on native, direct API on web
  if (Platform.OS === 'web') {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }
    return identifyViaDirectAPI(base64Data);
  } else {
    return identifyViaEdgeFunction(base64Data);
  }
};