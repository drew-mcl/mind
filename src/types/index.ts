import type { Node, Edge, OnNodesChange, OnEdgesChange } from "@xyflow/react";

export type NodeType = "root" | "domain" | "goal" | "feature" | "task";
export type TaskStatus = "pending" | "in_progress" | "blocked" | "done";
export type EdgeType = "hierarchy" | "blocks";
export type SaveStatus = "saved" | "dirty" | "saving" | "error";
export type AddButtonSide = "top" | "right" | "bottom" | "left";

export type MindNodeData = {
  label: string;
  type: NodeType;
  description?: string;
  assignee?: string;
  status?: TaskStatus;
  // UI-only hint injected at render time; not persisted.
  uiAddSide?: AddButtonSide;
  isFiltered?: boolean;
};

export type MindNode = Node<MindNodeData, string>;

export type MindEdgeData = {
  edgeType: EdgeType;
};

export type MindEdge = Edge<MindEdgeData>;

export type ProjectData = {
  id: string;
  name: string;
  nodes: MindNode[];
  edges: MindEdge[];
};

export type ProjectSummary = {
  id: string;
  name: string;
};

export type MindStore = {
  projects: ProjectData[];
  activeProjectId: string | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  layoutVersion: number;
  saveStatus: SaveStatus;
  saveError: string | null;
  searchQuery: string;
  focusedNodeId: string | null;
  sidebarCollapsed: boolean;
  autoFocusEnabled: boolean;
  lockedNodeId: string | null;

  // Derived
  activeProject: () => ProjectData | undefined;
  selectedNode: () => MindNode | undefined;

  // Actions
  setProjects: (projects: ProjectData[]) => void;
  setActiveProject: (id: string) => void;
  setSelectedNode: (id: string | null) => void;
  setEditingNode: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFocusedNode: (id: string | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setAutoFocusEnabled: (enabled: boolean) => void;
  setLockedNode: (id: string | null) => void;

  // Node/edge mutations
  onNodesChange: OnNodesChange<MindNode>;
  onEdgesChange: OnEdgesChange<MindEdge>;
  updateNodeData: (nodeId: string, data: Partial<MindNodeData>) => void;
  addChildNode: (parentId: string) => void;
  addBlockingEdge: (sourceId: string, targetId: string) => void;
  deleteNode: (nodeId: string) => void;
  toggleGoal: (nodeId: string) => void;
  createProject: (name: string) => void;
  applyLayout: (onComplete?: () => void) => void;

  // Connect mode
  connectMode: "off" | "blocking";
  connectSourceId: string | null;
  setConnectMode: (mode: "off" | "blocking") => void;
  setConnectSource: (id: string | null) => void;
  setSaveStatus: (status: SaveStatus, error?: string | null) => void;
  clearSaveError: () => void;
};
