import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "@/store";
import type { MindNode, MindEdge } from "@/types";

const NODE_DIMS: Record<string, { w: number; h: number }> = {
  root: { w: 160, h: 56 },
  domain: { w: 170, h: 50 },
  feature: { w: 180, h: 70 },
  task: { w: 180, h: 70 },
};
const TASK_CARD_MAX_WIDTH = 380;
const TASK_CARD_INNER_MAX_WIDTH = 300;
const TASK_CARD_INNER_MIN_WIDTH = 120;
const TASK_CARD_TEXT_CHAR_WIDTH = 6.15;
const TASK_CARD_EXTRA_LINE_HEIGHT = 16;
const TASK_CARD_MAX_HEIGHT = 220;

function nodeRect(node: MindNode) {
  const dims = NODE_DIMS[node.data.type] ?? NODE_DIMS.task;
  if (node.data.type === "feature" || node.data.type === "task") {
    const label = node.data.label?.trim() || "Untitled";
    const rawTextWidth = Math.max(52, label.length * TASK_CARD_TEXT_CHAR_WIDTH);
    const innerWidth = Math.min(
      TASK_CARD_INNER_MAX_WIDTH,
      Math.max(TASK_CARD_INNER_MIN_WIDTH, rawTextWidth),
    );
    const lines = Math.max(1, Math.ceil(rawTextWidth / innerWidth));
    return {
      x: node.position.x,
      y: node.position.y,
      w: Math.min(TASK_CARD_MAX_WIDTH, Math.max(dims.w, innerWidth + 38)),
      h: Math.min(
        TASK_CARD_MAX_HEIGHT,
        dims.h + Math.max(0, lines - 1) * TASK_CARD_EXTRA_LINE_HEIGHT,
      ),
    };
  }
  return {
    x: node.position.x,
    y: node.position.y,
    w: node.measured?.width ?? dims.w,
    h: node.measured?.height ?? dims.h,
  };
}

function overlaps(a: MindNode, b: MindNode, pad = 8) {
  const ar = nodeRect(a);
  const br = nodeRect(b);
  return (
    ar.x - pad < br.x + br.w + pad
    && ar.x + ar.w + pad > br.x - pad
    && ar.y - pad < br.y + br.h + pad
    && ar.y + ar.h + pad > br.y - pad
  );
}

function makeNode(
  id: string,
  type: "root" | "domain" | "feature" | "task",
  x: number,
  y: number,
  label = id,
  measured?: { width: number; height: number },
): MindNode {
  return {
    id,
    type,
    position: { x, y },
    data: {
      label,
      type,
      ...(type === "feature" || type === "task" ? { status: "pending" as const } : {}),
    },
    ...(measured ? { measured } : {}),
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

function depthMap(rootId: string, edges: MindEdge[]) {
  const depths = new Map<string, number>([[rootId, 0]]);
  const childrenById = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.data?.edgeType !== "hierarchy") continue;
    if (!childrenById.has(edge.source)) childrenById.set(edge.source, []);
    childrenById.get(edge.source)!.push(edge.target);
  }
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const depth = depths.get(id) ?? 0;
    for (const childId of childrenById.get(id) ?? []) {
      if (depths.has(childId)) continue;
      depths.set(childId, depth + 1);
      queue.push(childId);
    }
  }
  return depths;
}

describe("useStore", () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    useStore.setState({
      projects: [],
      activeProjectId: null,
      selectedNodeId: null,
      editingNodeId: null,
      layoutVersion: 0,
      saveStatus: "saved",
      saveError: null,
      connectMode: "off",
      connectSourceId: null,
    });
  });

  describe("createProject", () => {
    it("creates a project with a root node", () => {
      useStore.getState().createProject("My Project");

      const state = useStore.getState();
      expect(state.projects).toHaveLength(1);

      const project = state.projects[0];
      expect(project.name).toBe("My Project");
      expect(project.nodes).toHaveLength(1);
      expect(project.nodes[0].data.type).toBe("root");
      expect(project.nodes[0].data.label).toBe("My Project");
      expect(project.edges).toHaveLength(0);
    });

    it("sets the new project as active", () => {
      useStore.getState().createProject("Test");

      const state = useStore.getState();
      expect(state.activeProjectId).toBe(state.projects[0].id);
    });

    it("generates a slug-based ID from the name", () => {
      useStore.getState().createProject("My Cool Project");

      const project = useStore.getState().projects[0];
      expect(project.id).toBe("my-cool-project");
    });
  });

  describe("addChildNode", () => {
    beforeEach(() => {
      useStore.getState().createProject("Test");
    });

    it("adds a domain child to a root node", () => {
      const project = useStore.getState().activeProject()!;
      const rootId = project.nodes[0].id;

      useStore.getState().addChildNode(rootId);

      const updated = useStore.getState().activeProject()!;
      expect(updated.nodes).toHaveLength(2);
      expect(updated.edges).toHaveLength(1);

      const child = updated.nodes[1];
      expect(child.data.type).toBe("domain");

      const edge = updated.edges[0];
      expect(edge.source).toBe(rootId);
      expect(edge.target).toBe(child.id);
      expect(edge.data?.edgeType).toBe("hierarchy");
    });

    it("adds a feature child to a domain node", () => {
      const rootId = useStore.getState().activeProject()!.nodes[0].id;
      useStore.getState().addChildNode(rootId);

      const domainId = useStore.getState().activeProject()!.nodes[1].id;
      useStore.getState().addChildNode(domainId);

      const updated = useStore.getState().activeProject()!;
      expect(updated.nodes).toHaveLength(3);
      const feature = updated.nodes[2];
      expect(feature.data.type).toBe("feature");
    });

    it("adds a task child to a feature node", () => {
      const rootId = useStore.getState().activeProject()!.nodes[0].id;
      useStore.getState().addChildNode(rootId);

      const domainId = useStore.getState().activeProject()!.nodes[1].id;
      useStore.getState().addChildNode(domainId);

      const featureId = useStore.getState().activeProject()!.nodes[2].id;
      useStore.getState().addChildNode(featureId);

      const updated = useStore.getState().activeProject()!;
      expect(updated.nodes).toHaveLength(4);
      const task = updated.nodes[3];
      expect(task.data.type).toBe("task");
    });

    it("selects the new child node and sets it to editing", () => {
      const rootId = useStore.getState().activeProject()!.nodes[0].id;
      useStore.getState().addChildNode(rootId);

      const state = useStore.getState();
      const child = state.activeProject()!.nodes[1];
      expect(state.selectedNodeId).toBe(child.id);
      expect(state.editingNodeId).toBe(child.id);
    });

    it("places sibling children at distinct positions", () => {
      const rootId = useStore.getState().activeProject()!.nodes[0].id;
      useStore.getState().addChildNode(rootId);
      useStore.getState().addChildNode(rootId);

      const nodes = useStore.getState().activeProject()!.nodes;
      const first = nodes[1].position;
      const second = nodes[2].position;
      expect(first.x === second.x && first.y === second.y).toBe(false);
    });

    it("avoids overlap when adding many children to the same parent", () => {
      const rootId = useStore.getState().activeProject()!.nodes[0].id;
      useStore.getState().addChildNode(rootId);
      const domainId = useStore.getState().activeProject()!.nodes[1].id;

      for (let i = 0; i < 6; i++) {
        useStore.getState().addChildNode(domainId);
      }

      const nodes = useStore.getState().activeProject()!.nodes;
      const features = nodes.filter((n) => n.data.type === "feature");
      for (let i = 0; i < features.length; i++) {
        for (let j = i + 1; j < features.length; j++) {
          expect(overlaps(features[i], features[j], 4)).toBe(false);
        }
      }
    });

    it("biases grandchildren outward from the root branch direction", () => {
      const projectBefore = useStore.getState().activeProject()!;
      const root = projectBefore.nodes[0];
      const rootCenter = { x: root.position.x + 80, y: root.position.y + 28 };

      useStore.getState().addChildNode(root.id);
      const domain = useStore.getState().activeProject()!.nodes[1];
      useStore.getState().addChildNode(domain.id);
      const feature = useStore.getState().activeProject()!.nodes[2];

      const domainCenter = { x: domain.position.x + 85, y: domain.position.y + 25 };
      const featureCenter = { x: feature.position.x + 90, y: feature.position.y + 35 };

      const domainDist = Math.hypot(
        domainCenter.x - rootCenter.x,
        domainCenter.y - rootCenter.y,
      );
      const featureDist = Math.hypot(
        featureCenter.x - rootCenter.x,
        featureCenter.y - rootCenter.y,
      );

      expect(featureDist).toBeGreaterThan(domainDist);
    });

    it("finds a non-overlapping spawn in crowded local neighborhoods", () => {
      const root = makeNode("root", "root", -80, -28, "Test");
      const domain = makeNode("domain", "domain", 120, -25, "domain");
      const parentCenter = { x: domain.position.x + 85, y: domain.position.y + 25 };
      const existingChildren: MindNode[] = [];
      const edges: MindEdge[] = [makeEdge(root.id, domain.id)];

      // Fill most close angles around the domain to force the placer
      // to search wider angles/distances.
      const obstacleAngles = [
        -2.3, -1.95, -1.58, -1.18, -0.8, -0.38, 0.03, 0.48, 0.93, 1.37, 1.78, 2.15,
      ];
      obstacleAngles.forEach((angle, i) => {
        const dist = 168 + (i % 3) * 24;
        const c = {
          x: parentCenter.x + Math.cos(angle) * dist,
          y: parentCenter.y + Math.sin(angle) * dist,
        };
        const feature = makeNode(
          `f-${i}`,
          "feature",
          c.x - 90,
          c.y - 35,
          `feature-${i}`,
          { width: 180, height: 70 },
        );
        existingChildren.push(feature);
        edges.push(makeEdge(domain.id, feature.id));
      });

      useStore.setState({
        projects: [
          {
            id: "test",
            name: "Test",
            nodes: [root, domain, ...existingChildren],
            edges,
          },
        ],
        activeProjectId: "test",
        selectedNodeId: null,
        editingNodeId: null,
      });

      useStore.getState().addChildNode(domain.id);
      const updated = useStore.getState().activeProject()!;
      const newNodeId = useStore.getState().selectedNodeId;
      expect(newNodeId).toBeTruthy();
      const newNode = updated.nodes.find((n) => n.id === newNodeId)!;

      for (const existing of updated.nodes) {
        if (existing.id === newNode.id) continue;
        expect(overlaps(newNode, existing, 6)).toBe(false);
      }
    });
  });

  describe("applyLayout integration", () => {
    it("keeps deep long cards from crossing the root/domain core cluster", () => {
      const root = makeNode("root", "root", -80, -28, "mind", {
        width: 160,
        height: 56,
      });
      const d1 = makeNode("d1", "domain", -30, -190, "d1", { width: 170, height: 50 });
      const d2 = makeNode("d2", "domain", 130, -120, "d2", { width: 170, height: 50 });
      const d3 = makeNode("d3", "domain", 165, 30, "d3", { width: 170, height: 50 });
      const d4 = makeNode("d4", "domain", -10, 125, "d4", { width: 170, height: 50 });
      const d5 = makeNode("d5", "domain", -180, 45, "d5", { width: 170, height: 50 });

      const longLabel =
        "this is a very long task card that used to cut through the central ring after rearrange";
      const fLong = makeNode("f-long", "feature", -40, -70, longLabel, {
        width: 620,
        height: 70,
      });
      const tLong = makeNode("t-long", "task", 20, -24, longLabel, {
        width: 610,
        height: 70,
      });

      const f2 = makeNode("f2", "feature", 260, -150, "f2", { width: 200, height: 70 });
      const f3 = makeNode("f3", "feature", 250, 68, "f3", { width: 200, height: 70 });
      const f4 = makeNode("f4", "feature", -70, 205, "f4", { width: 200, height: 70 });

      const nodes = [root, d1, d2, d3, d4, d5, fLong, tLong, f2, f3, f4];
      const edges: MindEdge[] = [
        makeEdge(root.id, d1.id),
        makeEdge(root.id, d2.id),
        makeEdge(root.id, d3.id),
        makeEdge(root.id, d4.id),
        makeEdge(root.id, d5.id),
        makeEdge(d1.id, fLong.id),
        makeEdge(fLong.id, tLong.id),
        makeEdge(d2.id, f2.id),
        makeEdge(d3.id, f3.id),
        makeEdge(d4.id, f4.id),
      ];

      useStore.setState({
        projects: [{ id: "test", name: "Test", nodes, edges }],
        activeProjectId: "test",
        selectedNodeId: null,
        editingNodeId: null,
      });

      useStore.getState().applyLayout();
      const project = useStore.getState().activeProject()!;
      const depths = depthMap(root.id, project.edges);
      const core = project.nodes.filter((n) => (depths.get(n.id) ?? 0) <= 1);
      const deep = project.nodes.filter((n) => (depths.get(n.id) ?? 2) >= 2);

      for (const dn of deep) {
        for (const cn of core) {
          expect(overlaps(dn, cn, 6)).toBe(false);
        }
      }
    });
  });

  describe("updateNodeData", () => {
    beforeEach(() => {
      useStore.getState().createProject("Test");
    });

    it("updates properties on a node", () => {
      const rootId = useStore.getState().activeProject()!.nodes[0].id;

      useStore.getState().updateNodeData(rootId, { label: "Updated Label" });

      const node = useStore.getState().activeProject()!.nodes[0];
      expect(node.data.label).toBe("Updated Label");
    });

    it("preserves other data fields when updating", () => {
      const rootId = useStore.getState().activeProject()!.nodes[0].id;

      useStore.getState().updateNodeData(rootId, { label: "New" });

      const node = useStore.getState().activeProject()!.nodes[0];
      expect(node.data.type).toBe("root");
      expect(node.data.label).toBe("New");
    });

    it("can add optional fields like description", () => {
      const rootId = useStore.getState().activeProject()!.nodes[0].id;

      useStore.getState().updateNodeData(rootId, { description: "A note" });

      const node = useStore.getState().activeProject()!.nodes[0];
      expect(node.data.description).toBe("A note");
    });
  });

  describe("deleteNode", () => {
    beforeEach(() => {
      useStore.getState().createProject("Test");
      const rootId = useStore.getState().activeProject()!.nodes[0].id;
      useStore.getState().addChildNode(rootId);
    });

    it("removes the node from the project", () => {
      const childId = useStore.getState().activeProject()!.nodes[1].id;

      useStore.getState().deleteNode(childId);

      const updated = useStore.getState().activeProject()!;
      expect(updated.nodes).toHaveLength(1);
      expect(updated.nodes.find((n) => n.id === childId)).toBeUndefined();
    });

    it("removes edges connected to the deleted node", () => {
      const childId = useStore.getState().activeProject()!.nodes[1].id;

      useStore.getState().deleteNode(childId);

      const updated = useStore.getState().activeProject()!;
      expect(updated.edges).toHaveLength(0);
    });

    it("clears selectedNodeId when deleting the selected node", () => {
      const childId = useStore.getState().activeProject()!.nodes[1].id;
      useStore.getState().setSelectedNode(childId);

      useStore.getState().deleteNode(childId);

      expect(useStore.getState().selectedNodeId).toBeNull();
    });
  });
});
