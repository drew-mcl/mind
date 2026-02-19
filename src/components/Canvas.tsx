import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ConnectionLineType,
  MarkerType,
  type NodeMouseHandler,
  type EdgeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import type { AddButtonSide, MindEdge, MindNode } from "@/types";
import "@xyflow/react/dist/style.css";
import { useStore, useActiveProject } from "@/store";
import { nodeTypes } from "@/components/nodes";
import { FloatingEdge } from "@/components/edges/FloatingEdge";

const edgeTypes: EdgeTypes = {
  floating: FloatingEdge,
};

const defaultEdgeOptions = {
  type: "floating",
  animated: false,
  style: { strokeWidth: 1 },
};

const FIT_VIEW_OPTIONS = {
  padding: 0.34,
  duration: 320,
};

const NODE_SIZE_FALLBACK: Record<string, { w: number; h: number }> = {
  root: { w: 160, h: 56 },
  domain: { w: 170, h: 50 },
  goal: { w: 190, h: 76 },
  feature: { w: 180, h: 70 },
  task: { w: 180, h: 70 },
};
const TASK_CARD_MAX_WIDTH = 380;
const TASK_CARD_INNER_MAX_WIDTH = 300;
const TASK_CARD_INNER_MIN_WIDTH = 120;
const TASK_CARD_TEXT_CHAR_WIDTH = 6.15;
const TASK_CARD_EXTRA_LINE_HEIGHT = 16;
const TASK_CARD_MAX_HEIGHT = 220;

function nodeSize(node: MindNode) {
  const fallback = NODE_SIZE_FALLBACK[node.data.type] ?? NODE_SIZE_FALLBACK.task;
  const label = node.data.label?.trim() || "Untitled";
  if (node.data.type === "feature" || node.data.type === "task" || node.data.type === "goal") {
    const rawTextWidth = Math.max(52, label.length * TASK_CARD_TEXT_CHAR_WIDTH);
    const innerWidth = Math.min(
      TASK_CARD_INNER_MAX_WIDTH,
      Math.max(TASK_CARD_INNER_MIN_WIDTH, rawTextWidth),
    );
    const lines = Math.max(1, Math.ceil(rawTextWidth / innerWidth));
    return {
      w: Math.min(TASK_CARD_MAX_WIDTH, Math.max(fallback.w, innerWidth + 38)),
      h: Math.min(
        TASK_CARD_MAX_HEIGHT,
        fallback.h + Math.max(0, lines - 1) * TASK_CARD_EXTRA_LINE_HEIGHT,
      ),
    };
  }
  return {
    w: node.measured?.width ?? fallback.w,
    h: node.measured?.height ?? fallback.h,
  };
}

function nodeCenter(node: MindNode) {
  const size = nodeSize(node);
  return {
    x: node.position.x + size.w / 2,
    y: node.position.y + size.h / 2,
  };
}

function normalizeAngle(angle: number) {
  const full = Math.PI * 2;
  let next = angle % full;
  if (next < 0) next += full;
  return next;
}

function largestGapMidAngle(angles: number[]): number | null {
  if (angles.length === 0) return null;
  if (angles.length === 1) return normalizeAngle(angles[0] + Math.PI);

  const sorted = [...angles].map(normalizeAngle).sort((a, b) => a - b);
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

function vectorToSide(dx: number, dy: number): AddButtonSide {
  // Bias slightly towards vertical (top/bottom) by multiplying dy impact.
  // This feels more "mind-map-y" than horizontal side-buttons everywhere.
  if (Math.abs(dx) > Math.abs(dy) * 1.2) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "bottom" : "top";
}

export function Canvas() {
  const project = useActiveProject();
  const layoutVersion = useStore((s) => s.layoutVersion);
  const onNodesChange = useStore((s) => s.onNodesChange);
  const onEdgesChange = useStore((s) => s.onEdgesChange);
  const setSelectedNode = useStore((s) => s.setSelectedNode);
  const setEditingNode = useStore((s) => s.setEditingNode);
  const connectMode = useStore((s) => s.connectMode);
  const connectSourceId = useStore((s) => s.connectSourceId);
  const setConnectSource = useStore((s) => s.setConnectSource);
  const addBlockingEdge = useStore((s) => s.addBlockingEdge);
  const setConnectMode = useStore((s) => s.setConnectMode);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const editingNodeId = useStore((s) => s.editingNodeId);
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useStore((s) => s.setSidebarCollapsed);
  const searchQuery = useStore((s) => s.searchQuery);
  const focusedNodeId = useStore((s) => s.focusedNodeId);
  const setFocusedNode = useStore((s) => s.setFocusedNode);
  const deleteNode = useStore((s) => s.deleteNode);
  const autoFocusEnabled = useStore((s) => s.autoFocusEnabled);
  const lockedNodeId = useStore((s) => s.lockedNodeId);
  const flowRef = useRef<ReactFlowInstance<MindNode, MindEdge> | null>(null);
  const projectId = project?.id ?? null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle sidebar shortcut: Cmd + \
      if (e.key === "\\" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSidebarCollapsed(!sidebarCollapsed);
        return;
      }

      // Don't trigger shortcuts when typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Backspace" || e.key === "Delete") {
        if (!selectedNodeId || editingNodeId) return;

        const node = project?.nodes.find((n) => n.id === selectedNodeId);
        if (!node || node.data.type === "root") return;

        // Count descendants for confirmation
        const edges = project?.edges ?? [];
        let count = 0;
        const visit = (id: string) => {
          for (const edge of edges) {
            if (edge.source === id && edge.data?.edgeType === "hierarchy") {
              count++;
              visit(edge.target);
            }
          }
        };
        visit(selectedNodeId);

        if (count > 0) {
          const confirmed = window.confirm(
            `Delete "${node.data.label || "Untitled"}" and ${count} ${count === 1 ? "child" : "children"}?`,
          );
          if (!confirmed) return;
        }

        deleteNode(selectedNodeId);
      }

      // Keyboard navigation / Fit View
      if (e.key === "f" && !e.metaKey && !e.ctrlKey) {
        flowRef.current?.fitView(FIT_VIEW_OPTIONS);
      }

      if (e.key === "Escape") {
        if (focusedNodeId) {
          setFocusedNode(null);
        } else {
          setSelectedNode(null);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId, editingNodeId, project, deleteNode, focusedNodeId, setFocusedNode, setSelectedNode, sidebarCollapsed, setSidebarCollapsed]);

  const onNodeClick: NodeMouseHandler = (_event, node) => {
    if (connectMode === "blocking") {
      if (!connectSourceId) {
        setConnectSource(node.id);
      } else {
        addBlockingEdge(connectSourceId, node.id);
      }
      return;
    }
    setSelectedNode(node.id);
  };

  const onPaneClick = () => {
    if (connectMode === "blocking") {
      setConnectMode("off");
      return;
    }
    setSelectedNode(null);
    setEditingNode(null);
  };

  const styledEdges = useMemo(() => {
    if (!project) return [];
    return project.edges.map((edge): MindEdge => {
      const isBlocking = edge.data?.edgeType === "blocks";
      return {
        ...edge,
        type: "floating",
        style: {
          strokeWidth: isBlocking ? 1.5 : 1,
          stroke: isBlocking ? "#e8a0a0" : "#d6d3cd",
        },
        ...(isBlocking
          ? {
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: "#e8a0a0",
                width: 14,
                height: 14,
              },
            }
          : {}),
      };
    });
  }, [project]);

  const displayNodes = useMemo(() => {
    if (!project) return [];

    let filteredNodes = project.nodes;
    let filteredEdges = project.edges;

    // 1. Focus Mode (Hoisting)
    if (focusedNodeId) {
      const visibleIds = new Set<string>();
      const visit = (id: string) => {
        visibleIds.add(id);
        for (const edge of project.edges) {
          if (edge.source === id && edge.data?.edgeType === "hierarchy") {
            visit(edge.target);
          }
        }
      };
      visit(focusedNodeId);

      // Always show the node currently being edited/added if it's the selection,
      // though typically it would already be found via hierarchy.
      if (selectedNodeId) visibleIds.add(selectedNodeId);

      filteredNodes = project.nodes.filter((n) => visibleIds.has(n.id));
      filteredEdges = project.edges.filter(
        (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
      );
    }

    // 2. Search Filtering
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matches = project.nodes.filter((n) => {
        // Always include empty nodes (newly added) in results so they don't disappear
        if (n.data.label === "") return true;

        const labelMatch = n.data.label.toLowerCase().includes(query);
        const descMatch = n.data.description?.toLowerCase().includes(query);
        const assigneeMatch = n.data.assignee?.toLowerCase().includes(query);
        return labelMatch || descMatch || assigneeMatch;
      });

      const matchedIds = new Set(matches.map((n) => n.id));
      const visibleIds = new Set<string>();

      // Keep matched nodes AND their ancestors so the tree structure remains visible
      for (const matchedId of matchedIds) {
        let current: string | undefined = matchedId;
        while (current) {
          visibleIds.add(current);
          const parentEdge = project.edges.find(
            (e) => e.target === current && e.data?.edgeType === "hierarchy",
          );
          current = parentEdge?.source;
        }
      }

      filteredNodes = project.nodes.filter((n) => visibleIds.has(n.id));
      filteredEdges = project.edges.filter(
        (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
      );
    }

    const hierarchyEdges = filteredEdges.filter(
      (edge) => edge.data?.edgeType === "hierarchy",
    );
    const nodeById = new Map(filteredNodes.map((node) => [node.id, node]));
    const childrenById = new Map<string, string[]>();
    const parentById = new Map<string, string>();

    for (const edge of hierarchyEdges) {
      if (!childrenById.has(edge.source)) childrenById.set(edge.source, []);
      childrenById.get(edge.source)!.push(edge.target);
      parentById.set(edge.target, edge.source);
    }

    const root = filteredNodes.find((node) => node.data.type === "root") ?? filteredNodes[0];
    if (!root) return filteredNodes;
    const rootCenter = nodeCenter(root);
    const addSideById = new Map<string, AddButtonSide>();

    const fallbackVector = (node: MindNode) => {
      const parentId = parentById.get(node.id);
      if (parentId) {
        const parent = nodeById.get(parentId);
        if (parent) {
          const c = nodeCenter(node);
          const p = nodeCenter(parent);
          const vx = c.x - p.x;
          const vy = c.y - p.y;
          if (Math.hypot(vx, vy) > 1) return { x: vx, y: vy };
        }
      }

      const c = nodeCenter(node);
      const vx = c.x - rootCenter.x;
      const vy = c.y - rootCenter.y;
      if (Math.hypot(vx, vy) > 1) return { x: vx, y: vy };
      return { x: 0, y: 1 };
    };

    for (const node of filteredNodes) {
      const children = childrenById.get(node.id) ?? [];
      let vector: { x: number; y: number } | undefined;

      if (node.id === root.id && children.length > 0) {
        const childAngles = children
          .map((childId) => {
            const child = nodeById.get(childId);
            if (!child) return null;
            const c = nodeCenter(child);
            return Math.atan2(c.y - rootCenter.y, c.x - rootCenter.x);
          })
          .filter((angle): angle is number => angle !== null);
        const gapAngle = largestGapMidAngle(childAngles);
        if (gapAngle !== null) {
          vector = { x: Math.cos(gapAngle), y: Math.sin(gapAngle) };
        }
      }

      if (!vector && children.length > 0) {
        const c = nodeCenter(node);
        let vx = 0;
        let vy = 0;
        for (const childId of children) {
          const child = nodeById.get(childId);
          if (!child) continue;
          const cc = nodeCenter(child);
          vx += cc.x - c.x;
          vy += cc.y - c.y;
        }
        // Normalize the vector sum
        const mag = Math.hypot(vx, vy);
        if (mag > 1) {
          vector = { x: vx / mag, y: vy / mag };
        }
      }

      if (!vector) vector = fallbackVector(node);
      addSideById.set(node.id, vectorToSide(vector.x, vector.y));
    }

    return filteredNodes.map((node) => {
      const isSearchMatch = searchQuery.trim() && node.data.label.toLowerCase().includes(searchQuery.toLowerCase());
      return {
        ...node,
        data: {
          ...node.data,
          uiAddSide: addSideById.get(node.id) ?? "bottom", // Ensure a fallback
          isFiltered: !isSearchMatch && searchQuery.trim().length > 0,
        },
      };
    });

  }, [project, searchQuery, focusedNodeId]);

  const handleInit = useCallback((instance: ReactFlowInstance<MindNode, MindEdge>) => {
    flowRef.current = instance;
  }, []);

  // Track project ID and layout version to detect changes
  const prevProjectIdRef = useRef<string | null>(null);
  const lastLayoutVersionRef = useRef(layoutVersion);

  useEffect(() => {
    if (!projectId || !flowRef.current || !project) return;

    const isManualRearrange = layoutVersion > lastLayoutVersionRef.current;
    lastLayoutVersionRef.current = layoutVersion;

    if (prevProjectIdRef.current !== projectId || isManualRearrange) {
      if (autoFocusEnabled || isManualRearrange) {
        const rf = flowRef.current;
        const rootNode = project.nodes.find(n => n.data.type === "root");
        
        requestAnimationFrame(() => {
          if (rootNode) {
            const { x, y } = nodeCenter(rootNode);
            rf.setCenter(x, y, { zoom: 0.85, duration: isManualRearrange ? 400 : 0 });
          } else if (prevProjectIdRef.current !== projectId) {
            rf.fitView(FIT_VIEW_OPTIONS);
          }
        });
      }
      prevProjectIdRef.current = projectId;
    }
  }, [projectId, project, autoFocusEnabled, layoutVersion]);

  // Handle viewport locking
  useEffect(() => {
    if (!lockedNodeId || !flowRef.current || !project) return;
    const node = project.nodes.find(n => n.id === lockedNodeId);
    if (!node) return;

    const { x, y } = nodeCenter(node);
    flowRef.current.setCenter(x, y, { duration: 200 });
  }, [lockedNodeId, project?.nodes, project?.edges]);

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-text-tertiary text-sm">
        Select a project to begin
      </div>
    );
  }

  const showGettingStartedTip = project.nodes.length <= 1;

  return (
    <div className="relative h-full">
      {connectMode === "blocking" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-lg border border-status-blocked bg-orange-50 px-4 py-2 text-[12px] font-medium text-status-blocked shadow-sm">
          {connectSourceId
            ? "Click the blocked node to complete the link"
            : "Click the blocking node first"}
        </div>
      )}
      {focusedNodeId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 rounded-lg border border-accent bg-accent-subtle px-4 py-2 text-[12px] font-medium text-accent shadow-sm">
          <span>Focusing on subtree</span>
          <button
            onClick={() => setFocusedNode(null)}
            className="rounded bg-white/50 px-2 py-0.5 text-[10px] hover:bg-white/80"
          >
            Clear (Esc)
          </button>
        </div>
      )}
      {showGettingStartedTip && (
        <div className="absolute top-4 right-4 z-10 max-w-[280px] rounded-lg border border-border bg-surface/95 px-3 py-2 text-[11px] leading-relaxed text-text-secondary shadow-sm">
          <span className="font-semibold text-text-primary">Quick start:</span>{" "}
          click the center node, then use{" "}
          <span className="font-semibold">Add first domain</span> in the left panel.
        </div>
      )}
      <ReactFlow
        nodes={displayNodes}
        edges={styledEdges}
        onInit={handleInit}
        minZoom={0.01}
        maxZoom={2}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineType={ConnectionLineType.Bezier}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={28} size={0.6} color="#dddad4" />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          nodeColor={() => "#d6d3cd"}
          maskColor="rgba(246,244,240,0.75)"
          position="bottom-right"
        />
      </ReactFlow>
    </div>
  );
}
