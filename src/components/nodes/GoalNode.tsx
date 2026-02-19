import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { MindNode, TaskStatus } from "@/types";
import { cn } from "@/lib/cn";
import { StatusDot } from "./StatusDot";
import { useStore, useActiveProject } from "@/store";
import { addButtonSideClass } from "./addButtonSide";
import { domainColor } from "@/lib/colors";

const statusLabel: Record<TaskStatus, string> = {
  pending: "Goal: Pending",
  in_progress: "Goal: Active",
  blocked: "Goal: Blocked",
  done: "Goal: Achieved",
};

const statusPillStyle: Record<TaskStatus, React.CSSProperties> = {
  pending: {
    backgroundColor: "color-mix(in srgb, var(--color-status-pending) 18%, transparent)",
    color: "var(--color-status-pending)",
  },
  in_progress: {
    backgroundColor: "color-mix(in srgb, var(--color-status-progress) 20%, transparent)",
    color: "var(--color-status-progress)",
  },
  blocked: {
    backgroundColor: "color-mix(in srgb, var(--color-status-blocked) 20%, transparent)",
    color: "var(--color-status-blocked)",
  },
  done: {
    backgroundColor: "color-mix(in srgb, var(--color-status-done) 18%, transparent)",
    color: "var(--color-status-done)",
    opacity: 0.85,
  },
};

export function GoalNode({ id, data, selected }: NodeProps<MindNode>) {
  const status = data.status ?? "pending";
  const addSide = data.uiAddSide ?? "bottom";
  const addChildNode = useStore((s) => s.addChildNode);
  const editingNodeId = useStore((s) => s.editingNodeId);
  const setEditingNode = useStore((s) => s.setEditingNode);
  const updateNodeData = useStore((s) => s.updateNodeData);
  const project = useActiveProject();
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [editMinWidth, setEditMinWidth] = useState<number | undefined>();

  const isEditing = editingNodeId === id;

  // Determine domain color for the left accent
  const color = useMemo(() => {
    if (!project) return domainColor(0);
    
    // Find ancestor domain node
    const visitParent = (currentId: string): string | null => {
      const edge = project.edges.find(e => e.target === currentId && e.data?.edgeType === "hierarchy");
      if (!edge) return null;
      const parent = project.nodes.find(n => n.id === edge.source);
      if (!parent) return null;
      if (parent.data.type === "domain") return parent.id;
      return visitParent(parent.id);
    };

    const domainId = visitParent(id);
    if (!domainId) return domainColor(0);

    const domainIds = project.nodes
      .filter((n) => n.data.type === "domain")
      .map((n) => n.id);
    const index = Math.max(0, domainIds.indexOf(domainId));
    return domainColor(index);
  }, [project, id]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      const input = inputRef.current;
      const timer = setTimeout(() => {
        input.focus();
        input.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isEditing]);

  const commitEdit = useCallback(() => {
    if (!inputRef.current) return;
    const val = inputRef.current.value.trim();
    if (val) updateNodeData(id, { label: val });
    setEditingNode(null);
  }, [id, updateNodeData, setEditingNode]);

  return (
    <div
      className={cn(
        "mind-node group relative transition-all duration-300 ease-out",
        selected ? "scale-[1.03] z-10" : "hover:scale-[1.015]",
        data.isFiltered && "node-filtered"
      )}
    >
      <div
        className={cn(
          "rounded-xl px-5 py-4 min-w-[160px] max-w-[400px]",
          "backdrop-blur-md border border-border shadow-md",
          "transition-all duration-300",
          "bg-white/95 border-l-[6px]",
          selected ? "shadow-lg ring-2 ring-accent/30 border-accent/40" : "group-hover:shadow-lg",
        )}
        onDoubleClick={() => {
          if (cardRef.current) setEditMinWidth(cardRef.current.offsetWidth);
          setEditingNode(id);
        }}
        style={{
          borderLeftColor: color.border,
          backgroundColor: `color-mix(in srgb, ${color.bg} 8%, white)`,
          ...(isEditing && editMinWidth ? { minWidth: editMinWidth } : {}),
        }}
        ref={cardRef}
      >
        <div className="flex items-center gap-3">
          <span className="shrink-0 flex items-center justify-center">
            <StatusDot status={status} />
          </span>
          {isEditing ? (
            <input
              ref={inputRef}
              defaultValue={data.label}
              placeholder="Goal title..."
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setEditingNode(null);
              }}
              className="w-full min-w-0 flex-1 bg-transparent text-[15px] font-black tracking-tight text-text-primary outline-none placeholder:text-text-muted/50"
            />
          ) : (
            <span className="min-w-0 text-[15px] font-black leading-tight tracking-tight text-text-primary whitespace-normal break-words">
              {data.label || "Untitled Goal"}
            </span>
          )}
        </div>
        {!isEditing && (
          <div className="mt-2.5 flex items-center gap-2 pl-[23px]">
            <span
              className="inline-block rounded px-1.5 py-[0.5px] font-mono text-[9px] font-bold uppercase tracking-wider"
              style={statusPillStyle[status]}
            >
              {statusLabel[status]}
            </span>
            {data.assignee && (
              <span className="font-mono text-[9px] font-medium uppercase tracking-widest text-text-tertiary">
                {data.assignee}
              </span>
            )}
          </div>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          addChildNode(id);
        }}
        className={cn(
          "node-add-btn absolute flex h-7 w-7 items-center justify-center rounded-full bg-text-primary text-[16px] font-semibold leading-none text-white shadow-lg ring-4 ring-white hover:bg-accent hover:scale-110 transition-all",
          addButtonSideClass[addSide],
        )}
        style={{ backgroundColor: color.border }}
      >
        +
      </button>

      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}
