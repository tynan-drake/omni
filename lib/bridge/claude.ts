import Anthropic from "@anthropic-ai/sdk";
import type { BridgeMode, RelationshipKind } from "../types";

export interface RawBridgeRelationship {
  from: string;
  to: string;
  type: Exclude<RelationshipKind, "peer">;
  reason: string;
}

export interface RawBridgePath {
  shape: "chain" | "shared-root";
  commonRoot: string | null;
  relationships: RawBridgeRelationship[];
}

export const bridgeModel = () => process.env.LINEAGE_MODEL || "claude-haiku-4-5";
export const curatedBridgeAvailable = () => Boolean(process.env.ANTHROPIC_API_KEY);

const ALLOWED_TYPES = new Set([
  "influence",
  "collaboration",
  "sample",
  "scene",
  "similarity",
]);

export async function claudeBridge(
  artistA: string,
  artistB: string,
  mode: BridgeMode
): Promise<RawBridgePath[]> {
  const client = new Anthropic();
  const relationshipRules =
    mode === "influence"
      ? `Use ONLY historically credible influence edges. Every edge points from the influencing artist in "from" to the influenced artist in "to". Prefer a continuous chain in either direction. If neither artist influenced the other through a credible chain, a shared-root tree is valid when a documented earlier artist influenced both sides.`
      : `You may use influence, collaboration, sample, scene, or similarity relationships. Label every edge accurately with one of those exact types. Influence edges remain directional; other ties may be oriented to make the path readable.`;

  const prompt = `Find the strongest musical bridge between ${artistA} and ${artistB}.

${relationshipRules}

Rules:
- Return 1–3 paths only. Return fewer when fewer are credible; never pad.
- Each path must connect both named endpoint artists and contain at most 4 other artists.
- Use real individual artists or bands that can be found on streaming services.
- Keep paths meaningfully distinct and deduplicate repeated relationships.
- A chain is a continuous path between the endpoints. A shared-root path branches from one earlier common influence toward both endpoints.
- "reason" is one concise, concrete sentence explaining that exact edge.
- If no credible path exists, return an empty paths array.

Respond with ONLY this JSON:
{"paths":[{"shape":"chain","commonRoot":null,"relationships":[{"from":"...","to":"...","type":"${mode === "influence" ? "influence" : "similarity"}","reason":"..."}]}]}`;

  const response = await client.messages.create({
    model: bridgeModel(),
    max_tokens: 3500,
    temperature: 0.25,
    system:
      "You are a cautious music historian. Prefer a smaller defensible result to a speculative one. Return strict JSON only.",
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("bridge response contained no JSON");
  const parsed = JSON.parse(text.slice(start, end + 1)) as { paths?: unknown };
  if (!Array.isArray(parsed.paths)) throw new Error("malformed bridge response");

  return parsed.paths.slice(0, 3).flatMap((value): RawBridgePath[] => {
    if (!value || typeof value !== "object") return [];
    const raw = value as Record<string, unknown>;
    if (!Array.isArray(raw.relationships)) return [];
    const relationships = raw.relationships.flatMap((item): RawBridgeRelationship[] => {
      if (!item || typeof item !== "object") return [];
      const edge = item as Record<string, unknown>;
      if (
        typeof edge.from !== "string" ||
        typeof edge.to !== "string" ||
        typeof edge.reason !== "string"
      ) {
        return [];
      }
      const type =
        mode === "influence"
          ? "influence"
          : typeof edge.type === "string" && ALLOWED_TYPES.has(edge.type)
            ? (edge.type as RawBridgeRelationship["type"])
            : "similarity";
      return [{
        from: edge.from.trim(),
        to: edge.to.trim(),
        type,
        reason: edge.reason.trim(),
      }];
    });
    if (!relationships.length) return [];
    return [{
      shape: raw.shape === "shared-root" ? "shared-root" : "chain",
      commonRoot: typeof raw.commonRoot === "string" ? raw.commonRoot.trim() : null,
      relationships,
    }];
  });
}
