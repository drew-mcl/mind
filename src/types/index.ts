import type { Node, Edge, OnNodesChange, OnEdgesChange } from "@xyflow/react";

export type NodeType = "root" | "domain" | "feature" | "task";
export type TaskStatus = "pending" | "in_progress" | "blocked" | "done";
export type EdgeType = "hierarchy" | "blocks";

export type MindNodeData = {
  label: string;
  type: NodeType;
  description?: string;
  assignee?: string;
  status?: TaskStatus;
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

export type MindStore = {
  projects: ProjectData[];
  activeProjectId: string | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;

  // Derived
  activeProject: () => ProjectData | undefined;
  selectedNode: () => MindNode | undefined;

  // Actions
  setProjects: (projects: ProjectData[]) => void;
  setActiveProject: (id: string) => void;
  setSelectedNode: (id: string | null) => void;
  setEditingNode: (id: string | null) => void;

  // Node/edge mutations
  onNodesChange: OnNodesChange<MindNode>;
  onEdgesChange: OnEdgesChange<MindEdge>;
  updateNodeData: (nodeId: string, data: Partial<MindNodeData>) => void;
  addChildNode: (parentId: string) => void;
  addBlockingEdge: (sourceId: string, targetId: string) => void;
  deleteNode: (nodeId: string) => void;
  createProject: (name: string) => void;
  applyLayout: () => void;

  // Connect mode
  connectMode: "off" | "blocking";
  connectSourceId: string | null;
  setConnectMode: (mode: "off" | "blocking") => void;
  setConnectSource: (id: string | null) => void;
};
