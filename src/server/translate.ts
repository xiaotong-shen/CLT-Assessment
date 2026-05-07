import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";

const client = new Anthropic();

// ---------------------------------------------------------------------------
// In-process translation cache (process-level; survives across requests in
// the same worker but is cleared on cold starts / redeploys)
// ---------------------------------------------------------------------------

const cache = new Map<string, string>();

function cacheKey(targetLang: string, text: string): string {
  return `${targetLang}:${createHash("sha256").update(text).digest("hex").slice(0, 16)}`;
}

// ---------------------------------------------------------------------------
// Core: translate a batch of EN strings to targetLang in one call
// ---------------------------------------------------------------------------

const TRANSLATE_MODEL = "claude-haiku-4-5";

/**
 * Translates an array of English strings to the target language.
 * Results are cached by content hash — translating the same strings twice
 * costs 0 API calls.
 *
 * @param texts - Array of English strings to translate
 * @param targetLang - BCP-47 tag e.g. "zh-Hans", "fr", "ar"
 * @returns Array of translated strings in the same order as input
 */
export async function translateBatch(
  texts: string[],
  targetLang: string
): Promise<string[]> {
  if (texts.length === 0) return [];

  // Separate cached from uncached
  const keys = texts.map((t) => cacheKey(targetLang, t));
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    if (!cache.has(keys[i]!)) {
      uncachedIndices.push(i);
      uncachedTexts.push(texts[i]!);
    }
  }

  // All cached
  if (uncachedIndices.length === 0) {
    return texts.map((_, i) => cache.get(keys[i]!)!);
  }

  // Build numbered list for the model
  const inputList = uncachedTexts
    .map((t, i) => `${i + 1}. ${t}`)
    .join("\n");

  const systemPrompt = `You are a professional translator specializing in educational documents for ESL/ELD programs.
Translate the following numbered English phrases to ${targetLang}. Preserve the meaning and tone faithfully.
Respond ONLY with a JSON array of translated strings in the same order as the input — no extra keys, no markdown.
Example: ["翻译1", "翻译2"]`;

  const response = await client.messages.create({
    model: TRANSLATE_MODEL,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: systemPrompt,
        // Cache the stable system prompt — it won't change between calls
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Translate these ${uncachedTexts.length} phrase(s) to ${targetLang}:\n${inputList}`,
      },
    ],
  });

  const textBlock = response.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Translation API returned no text content");
  }

  const raw = textBlock.text.trim();
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Could not parse translation JSON from: ${raw.slice(0, 200)}`);
  }

  const translated = JSON.parse(jsonMatch[0]) as string[];
  if (!Array.isArray(translated) || translated.length !== uncachedTexts.length) {
    throw new Error(
      `Translation returned ${translated.length} items, expected ${uncachedTexts.length}`
    );
  }

  // Populate cache
  for (let i = 0; i < uncachedIndices.length; i++) {
    const idx = uncachedIndices[i]!;
    cache.set(keys[idx]!, translated[i]!);
  }

  // Assemble final result (mix cached + freshly translated)
  return texts.map((_, i) => {
    const cached = cache.get(keys[i]!);
    return cached!;
  });
}

/**
 * Translate a single string. Convenience wrapper around translateBatch.
 */
export async function translateOne(
  text: string,
  targetLang: string
): Promise<string> {
  const [result] = await translateBatch([text], targetLang);
  return result!;
}

/** How many entries are currently in the in-process cache (for logging) */
export function getCacheSize(): number {
  return cache.size;
}
