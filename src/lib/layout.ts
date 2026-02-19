import type { MindNode, MindEdge } from "@/types";

type AdjMap = Map<string, string[]>;

function buildAdjacency(edges: MindEdge[]): AdjMap {
  const adj: AdjMap = new Map();
  for (const e of edges) {
    if (e.data?.edgeType !== "hierarchy") continue;
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }
  return adj;
}

function findRoot(nodes: MindNode[], adj: AdjMap): string | undefined {
  const children = new Set<string>();
  for (const kids of adj.values()) kids.forEach((k) => children.add(k));
  const root = nodes.find((n) => !children.has(n.id));
  return root?.id;
}

const NODE_DIMS: Record<string, { w: number; h: number }> = {
  root: { w: 160, h: 56 },
  domain: { w: 170, h: 50 },
  feature: { w: 180, h: 70 },
  task: { w: 180, h: 70 },
};

const NODE_PAD = 20;
// Cap layout width so very long labels don't blow out the radial spread.
// Nodes still render at full width — this only affects positioning.
const MAX_LAYOUT_WIDTH = 200;

type LayoutEntry = { id: string; x: number; y: number };

function nodeDims(node: MindNode): { w: number; h: number } {
  const defaults = NODE_DIMS[node.data.type] ?? NODE_DIMS.task;
  return {
    w: Math.min(node.measured?.width ?? defaults.w, MAX_LAYOUT_WIDTH),
    h: node.measured?.height ?? defaults.h,
  };
}

// Count all descendants (including self) for weighting sweep allocation
function countDescendants(nodeId: string, adj: AdjMap): number {
  const kids = adj.get(nodeId) ?? [];
  let count = 1; // self
  for (const kid of kids) {
    count += countDescendants(kid, adj);
  }
  return count;
}

// Calculate minimum ring radius so children don't overlap at a given sweep
function minRadiusForChildren(
  childIds: string[],
  nodeMap: Map<string, MindNode>,
  sweep: number,
): number {
  if (childIds.length === 0) return 0;

  // Total arc length needed = sum of (node width + padding)
  let totalArc = 0;
  for (const id of childIds) {
    const child = nodeMap.get(id);
    if (!child) continue;
    totalArc += nodeDims(child).w + NODE_PAD;
  }

  // Arc length = radius * sweep, so radius = totalArc / sweep
  // But sweep might be < 2π, so we need enough radius for the arc
  return totalArc / Math.max(sweep, 0.1);
}

// Base ring gaps — minimum distance between rings.
// Kept small so single-child subtrees stay tight; minRadiusForChildren
// will push busier subtrees outward only when they actually need space.
const BASE_RING_GAP: Record<string, number> = {
  root: 0,
  domain: 200,
  feature: 140,
  task: 120,
};

function layoutRadial(
  nodeId: string,
  nodeMap: Map<string, MindNode>,
  adj: AdjMap,
  cx: number,
  cy: number,
  parentRadius: number,
  startAngle: number,
  sweep: number,
  results: LayoutEntry[],
) {
  const node = nodeMap.get(nodeId);
  if (!node) return;

  const dims = nodeDims(node);
  results.push({ id: nodeId, x: cx - dims.w / 2, y: cy - dims.h / 2 });

  const children = adj.get(nodeId) ?? [];
  if (children.length === 0) return;

  const childType = nodeMap.get(children[0])?.data.type ?? "task";
  const baseGap = BASE_RING_GAP[childType] ?? 250;

  // Calculate minimum radius to fit all children without overlap.
  // Cap at 2× base gap so long labels don't push rings to infinity —
  // subtrees with fewer children stay close, busier ones expand moderately.
  const minRadius = minRadiusForChildren(children, nodeMap, sweep);
  const maxRadius = parentRadius + baseGap * 2.5;
  const ringRadius = Math.min(Math.max(parentRadius + baseGap, minRadius), maxRadius);

  // Weight sweep allocation by descendant count so subtrees with more
  // children get proportionally more angular space
  const descCounts = children.map((id) => countDescendants(id, adj));
  const totalDesc = descCounts.reduce((a, b) => a + b, 0);

  // Also factor in the child's own width for minimum angle
  const minAngles = children.map((childId) => {
    const child = nodeMap.get(childId);
    if (!child) return 0;
    const w = nodeDims(child).w + NODE_PAD;
    const ratio = Math.min(w / (2 * ringRadius), 1);
    return 2 * Math.asin(ratio);
  });

  // Blend: 70% descendant-weighted, 30% width-weighted
  const totalMinAngle = minAngles.reduce((a, b) => a + b, 0);
  const childSweeps = children.map((_, i) => {
    const descWeight = totalDesc > 0 ? descCounts[i] / totalDesc : 1 / children.length;
    const widthWeight = totalMinAngle > 0 ? minAngles[i] / totalMinAngle : 1 / children.length;
    return (0.7 * descWeight + 0.3 * widthWeight) * sweep;
  });

  let angleOffset = startAngle;
  children.forEach((childId, i) => {
    const childSweep = childSweeps[i];
    const angle = angleOffset + childSweep / 2;
    const childX = cx + ringRadius * Math.cos(angle);
    const childY = cy + ringRadius * Math.sin(angle);

    layoutRadial(
      childId,
      nodeMap,
      adj,
      childX,
      childY,
      ringRadius,
      angle - childSweep / 2,
      childSweep,
      results,
    );

    angleOffset += childSweep;
  });
}

export function applyRadialLayout(
  nodes: MindNode[],
  edges: MindEdge[],
): { nodes: MindNode[]; edges: MindEdge[] } {
  const adj = buildAdjacency(edges);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const rootId = findRoot(nodes, adj);

  if (!rootId) return { nodes, edges };

  const results: LayoutEntry[] = [];
  layoutRadial(
    rootId,
    nodeMap,
    adj,
    0,
    0,
    0,
    -Math.PI / 2,
    Math.PI * 2,
    results,
  );

  const posMap = new Map(results.map((r) => [r.id, { x: r.x, y: r.y }]));
  const layoutedNodes = nodes.map((node) => ({
    ...node,
    position: posMap.get(node.id) ?? node.position,
  }));

  return { nodes: layoutedNodes, edges };
}
