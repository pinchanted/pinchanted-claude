// ============================================================
// PINCHANTED — Claude API Helper
// src/lib/claude.ts
// Calls Claude Vision directly from the app
// ============================================================

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
}

export interface IdentifyPinResult {
  is_disney_pin: boolean;
  general_description: string;
  matches: PinMatch[];
}

// Detect image type from base64
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

export const identifyPinWithClaude = async (
  imageBase64: string
): Promise<IdentifyPinResult> => {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  // Clean base64 — remove data URL prefix if present
  const base64Data = imageBase64.includes(',')
    ? imageBase64.split(',')[1]
    : imageBase64;

  const mediaType = detectImageType(base64Data);

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
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
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: `You are an expert Disney pin collector and identifier with encyclopedic knowledge of Disney trading pins.

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
- Prices should be in USD`,
            },
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