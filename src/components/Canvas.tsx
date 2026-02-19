import { useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ConnectionLineType,
  MarkerType,
  type NodeMouseHandler,
  type EdgeTypes,
} from "@xyflow/react";
import type { MindEdge } from "@/types";
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

export function Canvas() {
  const project = useActiveProject();
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
  const deleteNode = useStore((s) => s.deleteNode);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
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
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId, editingNodeId, project, deleteNode]);

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

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-text-tertiary text-sm">
        Select a project to begin
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {connectMode === "blocking" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-lg border border-status-blocked bg-orange-50 px-4 py-2 text-[12px] font-medium text-status-blocked shadow-sm">
          {connectSourceId
            ? "Click the blocked node to complete the link"
            : "Click the blocking node first"}
        </div>
      )}
      <ReactFlow
        nodes={project.nodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineType={ConnectionLineType.Bezier}
        fitView
        fitViewOptions={{ padding: 0.3 }}
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
