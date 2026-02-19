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

const NODE_PAD = 18;
// Long cards need influence, but fully trusting measured width
// causes runaway radial expansion on dense maps.
const SOFT_WIDTH_CAP = 220;
const SOFT_WIDTH_FALLOFF = 0.52;
const MAX_LAYOUT_WIDTH = 340;
const COLLISION_PAD_X = 14;
const COLLISION_PAD_Y = 18;
const COLLISION_ITERS = 72;
const SPRING_BACK = 0.045;
const MAX_RADIAL_DRIFT = 120;
const MIN_RADIAL_DRIFT = 52;
const TARGET_RADIUS_BASE = 260;
const TARGET_RADIUS_PER_SQRT_NODE = 104;
const TARGET_RADIUS_PER_EXTRA_ROOT_BRANCH = 18;
const INNER_CORE_RADIUS = 52;
const INNER_CORE_DEPTH_STEP = 20;

const CHILD_OUTWARD_GAP: Record<string, number> = {
  root: 0,
  domain: 92,
  feature: 74,
  task: 64,
};

type LayoutEntry = { id: string; x: number; y: number };
type NodeDims = { w: number; h: number };

function buildParentMap(edges: MindEdge[]): Map<string, string> {
  const parentById = new Map<string, string>();
  for (const edge of edges) {
    if (edge.data?.edgeType !== "hierarchy") continue;
    parentById.set(edge.target, edge.source);
  }
  return parentById;
}

function buildDepthMap(rootId: string, adj: AdjMap): Map<string, number> {
  const depthById = new Map<string, number>();
  depthById.set(rootId, 0);
  const queue = [rootId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const depth = depthById.get(id) ?? 0;
    const children = adj.get(id) ?? [];
    for (const childId of children) {
      if (depthById.has(childId)) continue;
      depthById.set(childId, depth + 1);
      queue.push(childId);
    }
  }

  return depthById;
}

function nodeDims(node: MindNode): { w: number; h: number } {
  const defaults = NODE_DIMS[node.data.type] ?? NODE_DIMS.task;
  const label = node.data.label?.trim() || "Untitled";
  const charWidth =
    node.data.type === "root"
      ? 7.2
      : node.data.type === "domain"
        ? 6.8
        : 6.2;
  const estWidth = Math.min(
    defaults.w + Math.max(0, label.length - 14) * charWidth,
    420,
  );
  const measuredOrEstimated = node.measured?.width ?? estWidth;
  const softenedWidth =
    measuredOrEstimated <= SOFT_WIDTH_CAP
      ? measuredOrEstimated
      : SOFT_WIDTH_CAP + (measuredOrEstimated - SOFT_WIDTH_CAP) * SOFT_WIDTH_FALLOFF;

  return {
    w: Math.min(softenedWidth, MAX_LAYOUT_WIDTH),
    h: node.measured?.height ?? defaults.h,
  };
}

function visualNodeDims(node: MindNode): NodeDims {
  const defaults = NODE_DIMS[node.data.type] ?? NODE_DIMS.task;
  const label = node.data.label?.trim() || "Untitled";
  const charWidth =
    node.data.type === "root"
      ? 7.2
      : node.data.type === "domain"
        ? 6.8
        : 6.2;
  const estWidth = Math.min(
    defaults.w + Math.max(0, label.length - 14) * charWidth,
    620,
  );
  return {
    w: node.measured?.width ?? estWidth,
    h: node.measured?.height ?? defaults.h,
  };
}

function buildSubtreeDemand(
  nodeMap: Map<string, MindNode>,
  adj: AdjMap,
  layoutDims: Map<string, NodeDims>,
): Map<string, number> {
  const memo = new Map<string, number>();

  const demandFor = (id: string): number => {
    const existing = memo.get(id);
    if (existing !== undefined) return existing;

    const node = nodeMap.get(id);
    if (!node) return 0;

    const dims = layoutDims.get(id) ?? NODE_DIMS.task;
    const selfDemand = dims.w + NODE_PAD;
    const kids = adj.get(id) ?? [];
    if (kids.length === 0) {
      memo.set(id, selfDemand);
      return selfDemand;
    }

    const childDemand = kids.reduce((sum, kid) => sum + demandFor(kid), 0);
    const total = Math.max(selfDemand, childDemand);
    memo.set(id, total);
    return total;
  };

  for (const id of nodeMap.keys()) demandFor(id);
  return memo;
}

// Calculate minimum ring radius so children don't overlap at a given sweep
function minRadiusForChildren(
  childIds: string[],
  layoutDims: Map<string, NodeDims>,
  sweep: number,
): number {
  if (childIds.length === 0) return 0;

  // Total arc length needed = sum of (node width + padding)
  let totalArc = 0;
  for (const id of childIds) {
    const childDims = layoutDims.get(id);
    if (!childDims) continue;
    totalArc += childDims.w + NODE_PAD;
  }

  // Arc length = radius * sweep, so radius = totalArc / sweep
  // But sweep might be < 2π, so we need enough radius for the arc
  return totalArc / Math.max(sweep * 0.96, 0.1);
}

// Base ring gaps — minimum distance between rings.
// Kept small so single-child subtrees stay tight; minRadiusForChildren
// will push busier subtrees outward only when they actually need space.
const BASE_RING_GAP: Record<string, number> = {
  root: 0,
  domain: 150,
  feature: 102,
  task: 84,
};

function enforceSweepFloors(
  desiredSweeps: number[],
  minSweeps: number[],
  totalSweep: number,
): number[] {
  if (desiredSweeps.length === 0) return [];

  const totalMin = minSweeps.reduce((sum, value) => sum + value, 0);
  if (totalMin >= totalSweep) {
    if (totalMin <= 0) {
      return desiredSweeps.map(() => totalSweep / desiredSweeps.length);
    }
    return minSweeps.map((value) => (value / totalMin) * totalSweep);
  }

  const sweeps = [...desiredSweeps];
  let deficit = 0;
  for (let i = 0; i < sweeps.length; i++) {
    if (sweeps[i] < minSweeps[i]) {
      deficit += minSweeps[i] - sweeps[i];
      sweeps[i] = minSweeps[i];
    }
  }

  if (deficit > 0) {
    let donorTotal = 0;
    for (let i = 0; i < sweeps.length; i++) {
      donorTotal += Math.max(0, sweeps[i] - minSweeps[i]);
    }

    if (donorTotal > 0) {
      for (let i = 0; i < sweeps.length; i++) {
        const spare = Math.max(0, sweeps[i] - minSweeps[i]);
        sweeps[i] -= (spare / donorTotal) * deficit;
      }
    }
  }

  const normalizedTotal = sweeps.reduce((sum, value) => sum + value, 0);
  if (normalizedTotal <= 0) {
    return sweeps.map(() => totalSweep / sweeps.length);
  }

  return sweeps.map((value) => (value / normalizedTotal) * totalSweep);
}

function layoutRadial(
  nodeId: string,
  nodeMap: Map<string, MindNode>,
  adj: AdjMap,
  cx: number,
  cy: number,
  parentRadius: number,
  startAngle: number,
  sweep: number,
  layoutDims: Map<string, NodeDims>,
  demand: Map<string, number>,
  results: LayoutEntry[],
) {
  const node = nodeMap.get(nodeId);
  if (!node) return;

  const dims = layoutDims.get(nodeId) ?? nodeDims(node);
  results.push({ id: nodeId, x: cx - dims.w / 2, y: cy - dims.h / 2 });

  const children = adj.get(nodeId) ?? [];
  if (children.length === 0) return;

  const childType = nodeMap.get(children[0])?.data.type ?? "task";
  const baseGap = BASE_RING_GAP[childType] ?? 250;

  // Calculate minimum radius to fit all children without overlap.
  // Allow dense branches to expand farther, but keep tight subtrees near root.
  const minRadius = minRadiusForChildren(children, layoutDims, sweep);
  const branchDemand = children.map((id) => demand.get(id) ?? 1);
  const totalDemand = branchDemand.reduce((a, b) => a + b, 0);
  const avgDemand = totalDemand / Math.max(1, children.length);
  const sampleDims = layoutDims.get(children[0]) ?? dims;
  const demandScale = avgDemand / Math.max(1, sampleDims.w);
  const demandBoost = Math.min(baseGap * 0.9, Math.log2(1 + demandScale) * 22);
  const maxRadius = parentRadius + baseGap * 1.65 + demandBoost + children.length * 4;
  const ringRadius = Math.min(Math.max(parentRadius + baseGap, minRadius), maxRadius);

  // Reserve a small constant angular gap between siblings.
  const gapAngle = Math.min(0.08, 20 / Math.max(1, ringRadius));
  const totalGap = gapAngle * Math.max(0, children.length - 1);
  const usableSweep = Math.max(sweep - totalGap, sweep * 0.7);

  // Weight sweep allocation by subtree demand so dense branches get
  // more angular space than shallow sibling groups.

  // Also factor in the child's own width for minimum angle
  const minAngles = children.map((childId) => {
    const childDims = layoutDims.get(childId);
    if (!childDims) return 0;
    const w = childDims.w + NODE_PAD;
    const ratio = Math.min(w / (2 * ringRadius), 1);
    return 2 * Math.asin(ratio);
  });

  // Blend: mostly even spacing with demand shaping.
  const totalMinAngle = minAngles.reduce((a, b) => a + b, 0);
  const desiredSweeps = children.map((_, i) => {
    const evenWeight = 1 / children.length;
    const demandWeight = totalDemand > 0 ? branchDemand[i] / totalDemand : 1 / children.length;
    const widthWeight = totalMinAngle > 0 ? minAngles[i] / totalMinAngle : 1 / children.length;
    return (0.5 * evenWeight + 0.35 * demandWeight + 0.15 * widthWeight) * usableSweep;
  });
  const minSweeps = minAngles.map((angle) => angle * 1.08);
  const childSweeps = enforceSweepFloors(desiredSweeps, minSweeps, usableSweep);

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
      layoutDims,
      demand,
      results,
    );

    angleOffset += childSweep + gapAngle;
  });
}

export function applyRadialLayout(
  nodes: MindNode[],
  edges: MindEdge[],
): { nodes: MindNode[]; edges: MindEdge[] } {
  const adj = buildAdjacency(edges);
  const parentById = buildParentMap(edges);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const rootId = findRoot(nodes, adj);

  if (!rootId) return { nodes, edges };
  const depthById = buildDepthMap(rootId, adj);

  const results: LayoutEntry[] = [];
  const layoutDims = new Map<string, NodeDims>(
    nodes.map((node) => [node.id, nodeDims(node)]),
  );
  const demand = buildSubtreeDemand(nodeMap, adj, layoutDims);
  layoutRadial(
    rootId,
    nodeMap,
    adj,
    0,
    0,
    0,
    -Math.PI / 2,
    Math.PI * 2,
    layoutDims,
    demand,
    results,
  );

  const posMap = new Map(results.map((r) => [r.id, { x: r.x, y: r.y }]));
  const visualDimsMap = new Map<string, NodeDims>(nodes.map((node) => [node.id, visualNodeDims(node)]));
  const centers = new Map<string, { x: number; y: number }>();
  const anchors = new Map<string, { x: number; y: number }>();
  const ids = nodes.map((node) => node.id);

  for (const node of nodes) {
    const pos = posMap.get(node.id) ?? node.position;
    const dims = visualDimsMap.get(node.id) ?? NODE_DIMS.task;
    const center = { x: pos.x + dims.w / 2, y: pos.y + dims.h / 2 };
    centers.set(node.id, center);
    anchors.set(node.id, { ...center });
  }

  const rootAnchor = centers.get(rootId);
  if (rootAnchor) {
    const rootKids = adj.get(rootId) ?? [];
    const targetMaxRadius =
      TARGET_RADIUS_BASE
      + Math.sqrt(nodes.length) * TARGET_RADIUS_PER_SQRT_NODE
      + Math.max(0, rootKids.length - 6) * TARGET_RADIUS_PER_EXTRA_ROOT_BRANCH;

    let currentMaxRadius = 0;
    for (const id of ids) {
      if (id === rootId) continue;
      const c = centers.get(id);
      if (!c) continue;
      const r = Math.hypot(c.x - rootAnchor.x, c.y - rootAnchor.y);
      if (r > currentMaxRadius) currentMaxRadius = r;
    }

    if (currentMaxRadius > targetMaxRadius) {
      const scale = targetMaxRadius / currentMaxRadius;
      for (const id of ids) {
        if (id === rootId) continue;
        const c = centers.get(id);
        const a = anchors.get(id);
        if (!c || !a) continue;
        c.x = rootAnchor.x + (c.x - rootAnchor.x) * scale;
        c.y = rootAnchor.y + (c.y - rootAnchor.y) * scale;
        a.x = rootAnchor.x + (a.x - rootAnchor.x) * scale;
        a.y = rootAnchor.y + (a.y - rootAnchor.y) * scale;
      }
    }
  }

  const rootFrame = centers.get(rootId) ?? { x: 0, y: 0 };

  const moveNode = (id: string, dx: number, dy: number) => {
    const c = centers.get(id);
    if (!c) return;
    c.x += dx;
    c.y += dy;
  };

  const clampToAnchorShell = (id: string, extraDrift = 0) => {
    if (id === rootId) return;
    const current = centers.get(id);
    const anchor = anchors.get(id);
    const node = nodeMap.get(id);
    if (!current || !anchor || !node) return;

    const anchorDx = anchor.x - rootFrame.x;
    const anchorDy = anchor.y - rootFrame.y;
    const currentDx = current.x - rootFrame.x;
    const currentDy = current.y - rootFrame.y;
    const anchorRadius = Math.hypot(anchorDx, anchorDy);
    const currentRadius = Math.hypot(currentDx, currentDy);

    // Keep descendants outward from their parent branch direction.
    let branchFloor = 0;
    const parentId = parentById.get(id);
    if (parentId) {
      const parentCenter = centers.get(parentId);
      if (parentCenter) {
        const parentRadius = Math.hypot(
          parentCenter.x - rootFrame.x,
          parentCenter.y - rootFrame.y,
        );
        const outwardGap = CHILD_OUTWARD_GAP[node.data.type] ?? CHILD_OUTWARD_GAP.task;
        branchFloor = parentRadius + outwardGap;
      }
    }

    // Keep deeper, wide cards from cutting through the root's inner cluster.
    const depth = depthById.get(id) ?? 1;
    let coreFloor = 0;
    if (depth >= 2) {
      const dims = visualDimsMap.get(id) ?? NODE_DIMS.task;
      const angle = Math.atan2(
        Math.abs(currentDy) > 0.001 ? currentDy : anchorDy,
        Math.abs(currentDx) > 0.001 ? currentDx : anchorDx,
      );
      const radialHalfExtent =
        Math.abs(Math.cos(angle)) * (dims.w / 2)
        + Math.abs(Math.sin(angle)) * (dims.h / 2);
      coreFloor =
        INNER_CORE_RADIUS
        + (depth - 2) * INNER_CORE_DEPTH_STEP
        + radialHalfExtent;
    }

    const minRadius = Math.max(0, anchorRadius - MIN_RADIAL_DRIFT, branchFloor, coreFloor);
    const shellMax = Math.max(
      anchorRadius + MAX_RADIAL_DRIFT + extraDrift,
      minRadius + 18,
    );

    if (currentRadius > shellMax && currentRadius > 0) {
      const scale = shellMax / currentRadius;
      current.x = rootFrame.x + currentDx * scale;
      current.y = rootFrame.y + currentDy * scale;
    } else if (currentRadius < minRadius && currentRadius > 0) {
      const scale = minRadius / currentRadius;
      current.x = rootFrame.x + currentDx * scale;
      current.y = rootFrame.y + currentDy * scale;
    }
  };

  for (let iter = 0; iter < COLLISION_ITERS; iter++) {
    let moved = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i];
        const idB = ids[j];
        const a = centers.get(idA);
        const b = centers.get(idB);
        const da = visualDimsMap.get(idA);
        const db = visualDimsMap.get(idB);
        if (!a || !b || !da || !db) continue;

        const needX = (da.w + db.w) / 2 + COLLISION_PAD_X;
        const needY = (da.h + db.h) / 2 + COLLISION_PAD_Y;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = needX - Math.abs(dx);
        const overlapY = needY - Math.abs(dy);

        if (overlapX <= 0 || overlapY <= 0) continue;

        if (overlapX < overlapY) {
          const dir = dx === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dx);
          const push = overlapX / 2 + 0.02;
          if (idA !== rootId) moveNode(idA, -dir * push, 0);
          if (idB !== rootId) moveNode(idB, dir * push, 0);
          moved += overlapX;
        } else {
          const dir = dy === 0 ? (j % 2 === 0 ? 1 : -1) : Math.sign(dy);
          const push = overlapY / 2 + 0.02;
          if (idA !== rootId) moveNode(idA, 0, -dir * push);
          if (idB !== rootId) moveNode(idB, 0, dir * push);
          moved += overlapY;
        }
      }
    }

    for (const id of ids) {
      if (id === rootId) continue;
      const current = centers.get(id);
      const anchor = anchors.get(id);
      if (!current || !anchor) continue;
      current.x += (anchor.x - current.x) * SPRING_BACK;
      current.y += (anchor.y - current.y) * SPRING_BACK;
      clampToAnchorShell(id);
    }

    if (moved < 0.5) break;
  }

  // Final pass: resolve any residual collisions with looser radial bounds.
  for (let iter = 0; iter < 24; iter++) {
    let moved = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i];
        const idB = ids[j];
        const a = centers.get(idA);
        const b = centers.get(idB);
        const da = visualDimsMap.get(idA);
        const db = visualDimsMap.get(idB);
        if (!a || !b || !da || !db) continue;

        const needX = (da.w + db.w) / 2 + COLLISION_PAD_X;
        const needY = (da.h + db.h) / 2 + COLLISION_PAD_Y;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = needX - Math.abs(dx);
        const overlapY = needY - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        if (overlapX < overlapY) {
          const dir = dx === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dx);
          const push = overlapX / 2 + 0.02;
          if (idA !== rootId) moveNode(idA, -dir * push, 0);
          if (idB !== rootId) moveNode(idB, dir * push, 0);
          moved += overlapX;
        } else {
          const dir = dy === 0 ? (j % 2 === 0 ? 1 : -1) : Math.sign(dy);
          const push = overlapY / 2 + 0.02;
          if (idA !== rootId) moveNode(idA, 0, -dir * push);
          if (idB !== rootId) moveNode(idB, 0, dir * push);
          moved += overlapY;
        }
      }
    }

    for (const id of ids) clampToAnchorShell(id, 28);
    if (moved < 0.5) break;
  }

  const rootCenter = centers.get(rootId);
  const rootShift = rootCenter ? { x: rootCenter.x, y: rootCenter.y } : { x: 0, y: 0 };

  const layoutedNodes = nodes.map((node) => {
    const center = centers.get(node.id);
    const dims = visualDimsMap.get(node.id) ?? NODE_DIMS.task;
    if (!center) return node;
    return {
      ...node,
      position: {
        x: center.x - rootShift.x - dims.w / 2,
        y: center.y - rootShift.y - dims.h / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
