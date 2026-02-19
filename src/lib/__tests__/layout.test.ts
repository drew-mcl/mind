import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyRadialLayout } from "@/lib/layout";
import type { MindNode, MindEdge } from "@/types";

function makeNode(
  id: string,
  type: "root" | "domain" | "feature" | "task",
): MindNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: id, type },
  };
}

function makeEdge(source: string, target: string): MindEdge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    data: { edgeType: "hierarchy" },
  };
}

const NODE_DIMS: Record<string, { w: number; h: number }> = {
  root: { w: 160, h: 56 },
  domain: { w: 170, h: 50 },
  feature: { w: 180, h: 70 },
  task: { w: 180, h: 70 },
};

function dims(node: MindNode) {
  const fallback = NODE_DIMS[node.data.type] ?? NODE_DIMS.task;
  return {
    w: node.measured?.width ?? fallback.w,
    h: node.measured?.height ?? fallback.h,
  };
}

function center(node: MindNode) {
  const d = dims(node);
  return {
    x: node.position.x + d.w / 2,
    y: node.position.y + d.h / 2,
  };
}

function countOverlaps(nodes: MindNode[], padX = 0, padY = 0) {
  let overlaps = 0;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    const ad = dims(a);
    const ax1 = a.position.x - padX;
    const ay1 = a.position.y - padY;
    const ax2 = a.position.x + ad.w + padX;
    const ay2 = a.position.y + ad.h + padY;

    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      const bd = dims(b);
      const bx1 = b.position.x;
      const by1 = b.position.y;
      const bx2 = b.position.x + bd.w;
      const by2 = b.position.y + bd.h;

      if (ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1) {
        overlaps++;
      }
    }
  }
  return overlaps;
}

function maxRadiusFromRoot(nodes: MindNode[]) {
  const root = nodes.find((node) => node.data.type === "root");
  if (!root) return 0;
  const rootCenter = center(root);
  let maxRadius = 0;
  for (const node of nodes) {
    if (node.id === root.id) continue;
    const c = center(node);
    const radius = Math.hypot(c.x - rootCenter.x, c.y - rootCenter.y);
    maxRadius = Math.max(maxRadius, radius);
  }
  return maxRadius;
}

function readProjectFixture(name: string): { nodes: MindNode[]; edges: MindEdge[] } {
  const raw = readFileSync(resolve(process.cwd(), `data/${name}.json`), "utf8");
  return JSON.parse(raw) as { nodes: MindNode[]; edges: MindEdge[] };
}

function buildDepthMap(rootId: string, edges: MindEdge[]) {
  const depthById = new Map<string, number>([[rootId, 0]]);
  const childrenById = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.data?.edgeType !== "hierarchy") continue;
    if (!childrenById.has(edge.source)) childrenById.set(edge.source, []);
    childrenById.get(edge.source)!.push(edge.target);
  }
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const depth = depthById.get(id) ?? 0;
    for (const childId of childrenById.get(id) ?? []) {
      if (depthById.has(childId)) continue;
      depthById.set(childId, depth + 1);
      queue.push(childId);
    }
  }
  return depthById;
}

function intersectsCoreCircle(
  node: MindNode,
  centerX: number,
  centerY: number,
  radius: number,
) {
  const d = dims(node);
  const minX = node.position.x;
  const maxX = node.position.x + d.w;
  const minY = node.position.y;
  const maxY = node.position.y + d.h;
  const closestX = Math.max(minX, Math.min(centerX, maxX));
  const closestY = Math.max(minY, Math.min(centerY, maxY));
  return Math.hypot(closestX - centerX, closestY - centerY) < radius;
}

describe("applyRadialLayout", () => {
  it("positions all nodes in a simple tree", () => {
    const nodes: MindNode[] = [
      makeNode("root", "root"),
      makeNode("d1", "domain"),
      makeNode("d2", "domain"),
      makeNode("d3", "domain"),
      makeNode("f1", "feature"),
      makeNode("f2", "feature"),
    ];

    const edges: MindEdge[] = [
      makeEdge("root", "d1"),
      makeEdge("root", "d2"),
      makeEdge("root", "d3"),
      makeEdge("d1", "f1"),
      makeEdge("d1", "f2"),
    ];

    const result = applyRadialLayout(nodes, edges);

    // All nodes should be present in the result
    expect(result.nodes).toHaveLength(nodes.length);

    // Every node should have a position
    for (const node of result.nodes) {
      expect(node.position).toBeDefined();
      expect(typeof node.position.x).toBe("number");
      expect(typeof node.position.y).toBe("number");
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    }
  });

  it("places root near the center", () => {
    const nodes: MindNode[] = [
      makeNode("root", "root"),
      makeNode("d1", "domain"),
      makeNode("d2", "domain"),
    ];

    const edges: MindEdge[] = [
      makeEdge("root", "d1"),
      makeEdge("root", "d2"),
    ];

    const result = applyRadialLayout(nodes, edges);
    const root = result.nodes.find((n) => n.id === "root")!;

    // Root should be near center (within a reasonable offset for node dimensions)
    expect(Math.abs(root.position.x)).toBeLessThan(200);
    expect(Math.abs(root.position.y)).toBeLessThan(200);
  });

  it("gives different positions to different nodes", () => {
    const nodes: MindNode[] = [
      makeNode("root", "root"),
      makeNode("d1", "domain"),
      makeNode("d2", "domain"),
      makeNode("d3", "domain"),
    ];

    const edges: MindEdge[] = [
      makeEdge("root", "d1"),
      makeEdge("root", "d2"),
      makeEdge("root", "d3"),
    ];

    const result = applyRadialLayout(nodes, edges);

    // Collect positions as strings for uniqueness check
    const positions = result.nodes.map(
      (n) => `${n.position.x.toFixed(1)},${n.position.y.toFixed(1)}`,
    );
    const uniquePositions = new Set(positions);

    expect(uniquePositions.size).toBe(result.nodes.length);
  });

  it("handles a single root node with no children", () => {
    const nodes: MindNode[] = [makeNode("root", "root")];
    const edges: MindEdge[] = [];

    const result = applyRadialLayout(nodes, edges);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
    // Root should still get a valid position
    expect(Number.isFinite(result.nodes[0].position.x)).toBe(true);
    expect(Number.isFinite(result.nodes[0].position.y)).toBe(true);
  });

  it("preserves all edges in the result", () => {
    const nodes: MindNode[] = [
      makeNode("root", "root"),
      makeNode("d1", "domain"),
    ];
    const edges: MindEdge[] = [makeEdge("root", "d1")];

    const result = applyRadialLayout(nodes, edges);
    expect(result.edges).toHaveLength(edges.length);
    expect(result.edges).toEqual(edges);
  });

  it("keeps the real mind dataset overlap-free", () => {
    const project = readProjectFixture("mind");
    const result = applyRadialLayout(project.nodes, project.edges);
    expect(countOverlaps(result.nodes, 8, 8)).toBe(0);
  });

  it("keeps the real mind dataset compact around the root", () => {
    const project = readProjectFixture("mind");
    const result = applyRadialLayout(project.nodes, project.edges);
    const maxRadius = maxRadiusFromRoot(result.nodes);
    expect(maxRadius).toBeLessThan(930);
  });

  it("keeps depth-2+ cards out of the root inner core on mind", () => {
    const project = readProjectFixture("mind");
    const result = applyRadialLayout(project.nodes, project.edges);
    const root = result.nodes.find((node) => node.data.type === "root");
    expect(root).toBeDefined();
    const rootCenter = center(root!);
    const depthById = buildDepthMap(root!.id, result.edges);
    for (const node of result.nodes) {
      const depth = depthById.get(node.id) ?? 1;
      if (node.id === root!.id || depth < 2) continue;
      expect(intersectsCoreCircle(node, rootCenter.x, rootCenter.y, 58)).toBe(false);
    }
  });

  it("keeps the real sre dataset overlap-free", () => {
    const project = readProjectFixture("sre");
    const result = applyRadialLayout(project.nodes, project.edges);
    expect(countOverlaps(result.nodes, 8, 8)).toBe(0);
  });
});
