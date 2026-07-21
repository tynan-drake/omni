import Anthropic from "@anthropic-ai/sdk";
import type { Direction } from "../types";

export interface RawLineageArtist {
  name: string;
  reason: string;
  era: string | null;
  linkedTo: string[];
}

const MODEL = () => process.env.LINEAGE_MODEL || "claude-haiku-4-5";

export const claudeAvailable = () => Boolean(process.env.ANTHROPIC_API_KEY);

const DIRECTION_BRIEF: Record<Direction, (artist: string) => string> = {
  back: (artist) =>
    `List the 10 artists who most directly and significantly influenced ${artist} — the musical roots that shaped their sound, style, songwriting, or approach. Prefer influences ${artist} has acknowledged or that critics widely document.`,
  forward: (artist) =>
    `List 10 notable artists who came after ${artist} and whose sound, style, or approach clearly carries ${artist}'s influence — their musical descendants. Prefer artists who have acknowledged ${artist} or whose debt is widely documented.`,
};

export async function claudeLineage(
  artist: string,
  direction: Direction
): Promise<RawLineageArtist[]> {
  const client = new Anthropic();

  const prompt = `${DIRECTION_BRIEF[direction](artist)}

Rules:
- Real, findable artists only (they should exist on streaming platforms). Never include ${artist} themself. No duplicates.
- "reason": one short concrete sentence naming the musical link (a technique, sound, scene, or acknowledged debt).
- "era": the decade of that artist's most relevant work, like "1970s".
- "linkedTo": names of OTHER artists from your own list this artist has strong direct ties to (collaborators, same scene or movement, direct influence). 0–3 each; keep it sparse and meaningful.

Respond with ONLY this JSON, no prose:
{"artists":[{"name":"...","reason":"...","era":"1990s","linkedTo":["..."]}]}`;

  const response = await client.messages.create({
    model: MODEL(),
    max_tokens: 2000,
    temperature: 0.4,
    system:
      "You are a meticulous music historian with deep knowledge of influence lineages across every genre and era. You answer in strict JSON only.",
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON in lineage response");

  const parsed = JSON.parse(text.slice(start, end + 1)) as {
    artists?: Array<{
      name?: unknown;
      reason?: unknown;
      era?: unknown;
      linkedTo?: unknown;
    }>;
  };

  if (!Array.isArray(parsed.artists)) throw new Error("malformed lineage JSON");

  return parsed.artists
    .filter((a) => typeof a.name === "string" && (a.name as string).trim())
    .map((a) => ({
      name: (a.name as string).trim(),
      reason: typeof a.reason === "string" ? a.reason : "",
      era: typeof a.era === "string" ? a.era : null,
      linkedTo: Array.isArray(a.linkedTo)
        ? (a.linkedTo as unknown[]).filter((n): n is string => typeof n === "string")
        : [],
    }));
}

/** Parse a decade number (e.g. 1990) out of an era string like "1990s". */
export function parseDecade(era: string | null): number | null {
  if (!era) return null;
  const m = era.match(/(\d{4})/);
  if (!m) return null;
  return Math.floor(parseInt(m[1], 10) / 10) * 10;
}
