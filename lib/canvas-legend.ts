import type { GraphEdge, GraphNode } from "./types";

export type CanvasLegendRole = "root" | "branch" | "bridge";

export function edgeMatchesLegend(edge: GraphEdge, role: CanvasLegendRole) {
  if (role === "bridge") return edge.origins?.some((origin) => origin.startsWith("bridge:"));
  return edge.kind === (role === "root" ? "back" : "forward");
}

/** Membership is cumulative: a seed or connector can belong to several views. */
export function canvasLegendMembers(nodes: Record<number, GraphNode>, edges: GraphEdge[]) {
  const members = { root: new Set<number>(), branch: new Set<number>(), bridge: new Set<number>() };
  for (const node of Object.values(nodes)) {
    if (node.kind === "root" || node.kind === "branch") members[node.kind].add(node.id);
    if (node.origins?.some((origin) => origin.startsWith("bridge:"))) members.bridge.add(node.id);
  }
  for (const edge of edges) {
    for (const role of ["root", "branch", "bridge"] as const) {
      if (!edgeMatchesLegend(edge, role)) continue;
      if (nodes[edge.from]) members[role].add(edge.from);
      if (nodes[edge.to]) members[role].add(edge.to);
    }
  }
  return members;
}
