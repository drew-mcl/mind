import { useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { MindNode, TaskStatus } from "@/types";
import { cn } from "@/lib/cn";
import { StatusDot } from "./StatusDot";
import { useStore } from "@/store";
import { addButtonSideClass } from "./addButtonSide";

const accentBorder: Record<TaskStatus, string> = {
  pending: "border-l-status-pending",
  in_progress: "border-l-status-progress",
  blocked: "border-l-status-blocked",
  done: "border-l-status-done",
};

const statusLabel: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
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

const statusCardStyle: Record<TaskStatus, React.CSSProperties> = {
  pending: {},
  in_progress: {
    borderColor: "color-mix(in srgb, var(--color-status-progress) 28%, var(--color-border))",
  },
  blocked: {
    borderColor: "color-mix(in srgb, var(--color-status-blocked) 36%, var(--color-border))",
  },
  done: {},
};

export function TaskNode({ id, data, selected }: NodeProps<MindNode>) {
  const status = data.status ?? "pending";
  const addSide = data.uiAddSide ?? "bottom";
  const addChildNode = useStore((s) => s.addChildNode);
  const editingNodeId = useStore((s) => s.editingNodeId);
  const setEditingNode = useStore((s) => s.setEditingNode);
  const updateNodeData = useStore((s) => s.updateNodeData);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [editMinWidth, setEditMinWidth] = useState<number | undefined>();

  const isEditing = editingNodeId === id;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitEdit = useCallback(() => {
    if (!inputRef.current) return;
    const val = inputRef.current.value.trim();
    if (val) updateNodeData(id, { label: val });
    setEditingNode(null);
  }, [id, updateNodeData, setEditingNode]);

  return (
    <div className={cn("mind-node relative", selected && "node-selected")}>
      <div
        className={cn(
          "rounded-lg bg-surface px-4 py-3 min-w-[120px]",
          "shadow-[0_1px_3px_rgba(0,0,0,0.03),0_3px_10px_rgba(0,0,0,0.02)]",
          "border border-border border-l-[4px]",
          accentBorder[status],
          selected && "shadow-[0_0_0_2px_var(--color-accent),0_4px_16px_rgba(99,102,241,0.1)]",
        )}
        onDoubleClick={() => {
          if (cardRef.current) setEditMinWidth(cardRef.current.offsetWidth);
          setEditingNode(id);
        }}
        style={{
          ...statusCardStyle[status],
          ...(isEditing && editMinWidth ? { minWidth: editMinWidth } : {}),
        }}
        ref={cardRef}
      >
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          {isEditing ? (
            <input
              ref={inputRef}
              defaultValue={data.label}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setEditingNode(null);
              }}
              className="flex-1 bg-transparent text-[13px] font-medium text-text-primary outline-none"
            />
          ) : (
            <span className="text-[13px] font-medium text-text-primary">
              {data.label || "Untitled"}
            </span>
          )}
        </div>
        {!isEditing && (
          <div className="mt-1.5 flex items-center gap-2 pl-[15px]">
            <span
              className="inline-block rounded-full px-2 py-[1px] text-[10px] font-semibold leading-[16px]"
              style={statusPillStyle[status]}
            >
              {statusLabel[status]}
            </span>
            {data.assignee && (
              <span className="text-[10px] font-mono text-text-tertiary">{data.assignee}</span>
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
          "node-add-btn absolute flex h-7 w-7 items-center justify-center rounded-full bg-text-secondary text-[16px] font-semibold leading-none text-white shadow-sm ring-2 ring-white hover:bg-text-primary transition-colors",
          addButtonSideClass[addSide],
        )}
      >
        +
      </button>

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
