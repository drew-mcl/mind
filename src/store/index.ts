import { useMemo } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/shallow";
import { applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import type { MindStore, MindNode, MindEdge, ProjectData } from "@/types";
import { applyRadialLayout } from "@/lib/layout";

let nodeCounter = 0;

const NODE_SIZE_FALLBACK: Record<string, { w: number; h: number }> = {
  root: { w: 160, h: 56 },
  domain: { w: 170, h: 50 },
  feature: { w: 180, h: 70 },
  task: { w: 180, h: 70 },
};

function nodeCenter(node: MindNode) {
  const fallback = NODE_SIZE_FALLBACK[node.data.type] ?? NODE_SIZE_FALLBACK.task;
  const width = node.measured?.width ?? fallback.w;
  const height = node.measured?.height ?? fallback.h;
  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  };
}

function nodeDims(node: MindNode) {
  const fallback = NODE_SIZE_FALLBACK[node.data.type] ?? NODE_SIZE_FALLBACK.task;
  return {
    w: node.measured?.width ?? fallback.w,
    h: node.measured?.height ?? fallback.h,
  };
}

function rectClearance(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
  if (dx === 0 && dy === 0) {
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return -Math.min(overlapX, overlapY);
  }
  return Math.hypot(dx, dy);
}

function normalizeAngle(angle: number) {
  const full = Math.PI * 2;
  let next = angle % full;
  if (next < 0) next += full;
  return next;
}

function angleDistance(a: number, b: number) {
  let diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff;
}

function largestGapMidAngle(angles: number[]) {
  if (angles.length === 0) return null;
  if (angles.length === 1) return normalizeAngle(angles[0] + Math.PI);

  const sorted = [...angles].map(normalizeAngle).sort((x, y) => x - y);
  let bestGap = -1;
  let bestMid = sorted[0];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = i === sorted.length - 1 ? sorted[0] + Math.PI * 2 : sorted[i + 1];
    const gap = next - current;
    if (gap > bestGap) {
      bestGap = gap;
      bestMid = current + gap / 2;
    }
  }

  return normalizeAngle(bestMid);
}

// Stable hooks for derived data — avoids infinite re-renders with React 19
export function useActiveProject() {
  const projects = useStore(useShallow((s) => s.projects));
  const activeProjectId = useStore((s) => s.activeProjectId);
  return useMemo(
    () => projects.find((p) => p.id === activeProjectId),
    [projects, activeProjectId],
  );
}

export function useSelectedNode() {
  const project = useActiveProject();
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  return useMemo(
    () => project?.nodes.find((n) => n.id === selectedNodeId),
    [project, selectedNodeId],
  );
}

export function useActiveEdges() {
  const project = useActiveProject();
  return project?.edges ?? emptyEdges;
}

const emptyEdges: MindEdge[] = [];

export const useStore = create<MindStore>((set, get) => ({
  projects: [],
  activeProjectId: null,
  selectedNodeId: null,
  editingNodeId: null,
  layoutVersion: 0,
  saveStatus: "saved",
  saveError: null,
  connectMode: "off",
  connectSourceId: null,

  activeProject: () => {
    const { projects, activeProjectId } = get();
    return projects.find((p) => p.id === activeProjectId);
  },

  selectedNode: () => {
    const project = get().activeProject();
    const { selectedNodeId } = get();
    if (!project || !selectedNodeId) return undefined;
    return project.nodes.find((n) => n.id === selectedNodeId);
  },

  setProjects: (projects) => {
    set({ projects });
    if (!get().activeProjectId && projects.length > 0) {
      set({ activeProjectId: projects[0].id });
    }
  },

  setActiveProject: (id) => set({ activeProjectId: id, selectedNodeId: null, editingNodeId: null }),

  setSelectedNode: (id) => set({ selectedNodeId: id }),

  setEditingNode: (id) => set({ editingNodeId: id }),

  setConnectMode: (mode) => set({ connectMode: mode, connectSourceId: null }),

  setConnectSource: (id) => set({ connectSourceId: id }),

  setSaveStatus: (status, error = null) =>
    set({ saveStatus: status, saveError: error }),

  onNodesChange: (changes) => {
    const project = get().activeProject();
    if (!project) return;

    const updatedNodes = applyNodeChanges(changes, project.nodes) as MindNode[];
    set({
      projects: get().projects.map((p) =>
        p.id === project.id ? { ...p, nodes: updatedNodes } : p,
      ),
    });
  },

  onEdgesChange: (changes) => {
    const project = get().activeProject();
    if (!project) return;

    const updatedEdges = applyEdgeChanges(changes, project.edges);
    set({
      projects: get().projects.map((p) =>
        p.id === project.id
          ? { ...p, edges: updatedEdges as ProjectData["edges"] }
          : p,
      ),
    });
  },

  updateNodeData: (nodeId, data) => {
    const project = get().activeProject();
    if (!project) return;

    set({
      projects: get().projects.map((p) =>
        p.id === project.id
          ? {
              ...p,
              nodes: p.nodes.map((n) =>
                n.id === nodeId
                  ? { ...n, data: { ...n.data, ...data } }
                  : n,
              ),
            }
          : p,
      ),
    });
  },

  addChildNode: (parentId) => {
    const project = get().activeProject();
    if (!project) return;

    const parent = project.nodes.find((n) => n.id === parentId);
    if (!parent) return;

    const childTypeMap: Record<string, "domain" | "feature" | "task"> = {
      root: "domain",
      domain: "feature",
      feature: "task",
      task: "task",
    };
    const childType = childTypeMap[parent.data.type] ?? "task";
    const newId = `node-${Date.now()}-${++nodeCounter}`;

    const hierarchyEdges = project.edges.filter(
      (e) => e.data?.edgeType === "hierarchy",
    );
    const nodeById = new Map(project.nodes.map((node) => [node.id, node]));
    const children = hierarchyEdges
      .filter((edge) => edge.source === parentId)
      .map((edge) => nodeById.get(edge.target))
      .filter((node): node is MindNode => Boolean(node));

    const parentCenter = nodeCenter(parent);
    const root = project.nodes.find((node) => node.data.type === "root") ?? parent;
    const rootCenter = nodeCenter(root);

    let preferredAngle: number;
    if (parent.id === root.id) {
      const childAngles = children.map((child) => {
        const c = nodeCenter(child);
        return Math.atan2(c.y - parentCenter.y, c.x - parentCenter.x);
      });
      preferredAngle = largestGapMidAngle(childAngles) ?? -Math.PI / 2;
    } else {
      const outwardX = parentCenter.x - rootCenter.x;
      const outwardY = parentCenter.y - rootCenter.y;
      if (Math.hypot(outwardX, outwardY) > 1) {
        preferredAngle = Math.atan2(outwardY, outwardX);
      } else {
        const incomingEdge = hierarchyEdges.find((edge) => edge.target === parentId);
        const incoming = incomingEdge ? nodeById.get(incomingEdge.source) : undefined;
        if (incoming) {
          const incomingCenter = nodeCenter(incoming);
          preferredAngle = Math.atan2(
            parentCenter.y - incomingCenter.y,
            parentCenter.x - incomingCenter.x,
          );
        } else {
          preferredAngle = -Math.PI / 2;
        }
      }
    }

    const childAngles = children.map((child) => {
      const c = nodeCenter(child);
      return Math.atan2(c.y - parentCenter.y, c.x - parentCenter.x);
    });
    const candidateOffsets = [
      0,
      0.3,
      -0.3,
      0.56,
      -0.56,
      0.84,
      -0.84,
      1.12,
      -1.12,
      1.42,
      -1.42,
      1.74,
      -1.74,
    ];

    const baseDistByParentType: Record<string, number> = {
      root: 208,
      domain: 172,
      feature: 148,
      task: 142,
    };
    const baseDist = baseDistByParentType[parent.data.type] ?? 150;
    const childDims = NODE_SIZE_FALLBACK[childType] ?? NODE_SIZE_FALLBACK.task;

    type PlacementCandidate = {
      x: number;
      y: number;
      overlapCount: number;
      minClearance: number;
      dist: number;
      siblingAnglePenalty: number;
    };

    const candidateDistances = [1, 1.16, 1.34, 1.54, 1.78, 2.04, 2.32].map(
      (scale) => (baseDist + Math.min(40, children.length * 7)) * scale,
    );
    const placementPad = 14;
    const existingRects = project.nodes.map((node) => {
      const dims = nodeDims(node);
      return {
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        w: dims.w,
        h: dims.h,
      };
    });

    const evaluateCandidate = (angle: number, dist: number): PlacementCandidate => {
      const center = {
        x: parentCenter.x + Math.cos(angle) * dist,
        y: parentCenter.y + Math.sin(angle) * dist,
      };
      const rect = {
        x: center.x - childDims.w / 2,
        y: center.y - childDims.h / 2,
        w: childDims.w,
        h: childDims.h,
      };

      let overlapCount = 0;
      let minClearance = Number.POSITIVE_INFINITY;
      for (const existing of existingRects) {
        const clearance = rectClearance(rect, existing);
        minClearance = Math.min(minClearance, clearance);
        if (clearance < placementPad) overlapCount++;
      }

      const nearestSiblingAngle = childAngles.reduce(
        (best, existing) => Math.min(best, angleDistance(existing, angle)),
        Math.PI,
      );

      return {
        x: rect.x,
        y: rect.y,
        overlapCount,
        minClearance,
        dist,
        siblingAnglePenalty: Math.max(0, 0.34 - nearestSiblingAngle),
      };
    };

    let bestPlacement: PlacementCandidate | null = null;
    for (const dist of candidateDistances) {
      for (const offset of candidateOffsets) {
        const angle = preferredAngle + offset;
        const candidate = evaluateCandidate(angle, dist);
        const candidateScore =
          candidate.overlapCount * 10000
          + candidate.siblingAnglePenalty * 620
          + candidate.dist * 0.18
          - Math.min(candidate.minClearance, 220) * 2.1;
        const bestScore = !bestPlacement
          ? Number.POSITIVE_INFINITY
          : bestPlacement.overlapCount * 10000
            + bestPlacement.siblingAnglePenalty * 620
            + bestPlacement.dist * 0.18
            - Math.min(bestPlacement.minClearance, 220) * 2.1;

        if (candidateScore < bestScore) {
          bestPlacement = candidate;
        }
      }

      if (
        bestPlacement
        && bestPlacement.overlapCount === 0
        && bestPlacement.minClearance >= placementPad
      ) {
        break;
      }
    }

    const childCenter = bestPlacement
      ? {
          x: bestPlacement.x + childDims.w / 2,
          y: bestPlacement.y + childDims.h / 2,
        }
      : {
          x: parentCenter.x + Math.cos(preferredAngle) * baseDist,
          y: parentCenter.y + Math.sin(preferredAngle) * baseDist,
        };

    const newNode: MindNode = {
      id: newId,
      type: childType,
      position: {
        x: childCenter.x - childDims.w / 2,
        y: childCenter.y - childDims.h / 2,
      },
      data: {
        label: "",
        type: childType,
        ...(childType === "task" || childType === "feature"
          ? { status: "pending" as const }
          : {}),
      },
    };

    const newEdge: MindEdge = {
      id: `e-${parentId}-${newId}`,
      source: parentId,
      target: newId,
      data: { edgeType: "hierarchy" },
    };

    set({
      selectedNodeId: newId,
      editingNodeId: newId,
      projects: get().projects.map((p) =>
        p.id === project.id
          ? {
              ...p,
              nodes: [...p.nodes, newNode],
              edges: [...p.edges, newEdge],
            }
          : p,
      ),
    });
  },

  addBlockingEdge: (sourceId, targetId) => {
    const project = get().activeProject();
    if (!project) return;
    if (sourceId === targetId) return;

    // Don't add duplicate blocking edges
    const exists = project.edges.some(
      (e) =>
        e.data?.edgeType === "blocks" &&
        e.source === sourceId &&
        e.target === targetId,
    );
    if (exists) return;

    const newEdge: MindEdge = {
      id: `e-blocks-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      data: { edgeType: "blocks" },
    };

    set({
      connectMode: "off",
      connectSourceId: null,
      projects: get().projects.map((p) =>
        p.id === project.id
          ? { ...p, edges: [...p.edges, newEdge] }
          : p,
      ),
    });
  },

  deleteNode: (nodeId) => {
    const project = get().activeProject();
    if (!project) return;

    // Collect all descendant node IDs recursively via hierarchy edges
    const idsToDelete = new Set<string>();
    const collect = (id: string) => {
      idsToDelete.add(id);
      for (const edge of project.edges) {
        if (edge.source === id && edge.data?.edgeType === "hierarchy" && !idsToDelete.has(edge.target)) {
          collect(edge.target);
        }
      }
    };
    collect(nodeId);

    set({
      selectedNodeId: null,
      editingNodeId: null,
      projects: get().projects.map((p) =>
        p.id === project.id
          ? {
              ...p,
              nodes: p.nodes.filter((n) => !idsToDelete.has(n.id)),
              edges: p.edges.filter(
                (e) => !idsToDelete.has(e.source) && !idsToDelete.has(e.target),
              ),
            }
          : p,
      ),
    });
  },

  createProject: (name) => {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const rootId = `${id}-root`;

    const newProject: ProjectData = {
      id,
      name,
      nodes: [
        {
          id: rootId,
          type: "root",
          position: { x: 0, y: 0 },
          data: { label: name, type: "root" },
        },
      ],
      edges: [],
    };

    set({
      projects: [...get().projects, newProject],
      activeProjectId: id,
      selectedNodeId: null,
      editingNodeId: null,
    });
  },

  applyLayout: () => {
    const project = get().activeProject();
    if (!project) return;

    const { nodes, edges } = applyRadialLayout(project.nodes, project.edges);
    set({
      layoutVersion: get().layoutVersion + 1,
      projects: get().projects.map((p) =>
        p.id === project.id ? { ...p, nodes, edges } : p,
      ),
    });
  },
}));
