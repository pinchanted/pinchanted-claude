// ============================================================
// PINCHANTED — Identify Pin Edge Function
// supabase/functions/identify-pin/index.ts
// ============================================================

import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PinMatch {
  name: string;
  series_name: string | null;
  edition: string | null;
  origin: string | null;
  original_price: number | null;
  release_date: string | null;
  confidence: number;
  description: string;
}

interface IdentifyPinResponse {
  matches: PinMatch[];
  is_disney_pin: boolean;
  general_description: string;
}

// Detect image type from base64 data
const detectImageType = (base64: string): string => {
  // Check the first few bytes of the base64 data
  const header = base64.substring(0, 16);
  const decoded = atob(header);
  const bytes = decoded.split('').map(c => c.charCodeAt(0));

  // WebP: starts with RIFF and WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 &&
      bytes[2] === 0x46 && bytes[3] === 0x46) {
    return 'image/webp';
  }
  // JPEG: starts with FFD8
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    return 'image/jpeg';
  }
  // PNG: starts with 89504E47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 &&
      bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }
  // GIF: starts with GIF8
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'image/gif';
  }
  // Default to jpeg
  return 'image/jpeg';
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY not set");
    }

    const { image_base64, image_type } = await req.json();
    if (!image_base64) {
      throw new Error("No image provided");
    }

    // Auto-detect image type from actual data
    const detectedType = detectImageType(image_base64);
    const mediaType = detectedType as
      "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    console.log(`Image type provided: ${image_type}, detected: ${detectedType}`);

    const client = new Anthropic({ apiKey: anthropicApiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: image_base64,
              },
            },
            {
              type: "text",
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
- If the image is unclear or could be multiple pins, provide multiple matches with lower confidence
- If it is not a Disney pin at all, set is_disney_pin to false and matches to empty array
- Be specific about the pin name - include character names, year, event if visible
- For edition: only use "Limited Edition", "Open Edition", or "Limited Release"
- Prices should be in USD`,
            },
          ],
        },
      ],
    });

    const responseText = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block as any).text)
      .join("");

    const cleanJson = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const result: IdentifyPinResponse = JSON.parse(cleanJson);

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error identifying pin:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        matches: [],
        is_disney_pin: false,
        general_description: "",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});