import { describe, it, expect } from "vitest";
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
});
