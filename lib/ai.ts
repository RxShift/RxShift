import "server-only";
import OpenAI from "openai";

// All in-product AI goes through here: OpenAI, server-side only, key never
// leaves the server (scoping §5 AI layer). AI proposes and explains —
// the deterministic engine owns compliance truth and a human confirms
// anything compliance-affecting.

const MODEL = "gpt-4o-mini";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export function aiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/** Plain-text completion. */
export async function aiText(
  system: string,
  user: string,
  maxTokens = 700
): Promise<string> {
  const res = await client().chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return res.choices[0]?.message?.content ?? "";
}

/** JSON-mode completion, parsed. Returns null on any failure. */
export async function aiJson<T>(
  system: string,
  user: string,
  maxTokens = 700
): Promise<T | null> {
  try {
    const res = await client().chat.completions.create({
      model: MODEL,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const content = res.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as T;
  } catch (e) {
    console.error("aiJson failed:", e);
    return null;
  }
}
