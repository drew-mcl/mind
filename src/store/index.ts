import { useMemo } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/shallow";
import { applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import type { MindStore, MindNode, MindEdge, ProjectData } from "@/types";
import { applyRadialLayout } from "@/lib/layout";

let nodeCounter = 0;

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

    // Count existing children to offset position
    const siblingCount = project.edges.filter(
      (e) => e.source === parentId && e.data?.edgeType === "hierarchy",
    ).length;

    // Place near parent with slight offset based on sibling count
    const angle = (siblingCount * Math.PI) / 4 - Math.PI / 2;
    const dist = 150;

    const newNode: MindNode = {
      id: newId,
      type: childType,
      position: {
        x: parent.position.x + Math.cos(angle) * dist,
        y: parent.position.y + Math.sin(angle) * dist,
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
      projects: get().projects.map((p) =>
        p.id === project.id ? { ...p, nodes, edges } : p,
      ),
    });
  },
}));
