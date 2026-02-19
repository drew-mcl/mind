import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { MindNode } from "@/types";
import { cn } from "@/lib/cn";
import { domainColor } from "@/lib/colors";
import { useStore, useActiveProject } from "@/store";
import { addButtonSideClass } from "./addButtonSide";

export function DomainNode({ id, data, selected }: NodeProps<MindNode>) {
  const addChildNode = useStore((s) => s.addChildNode);
  const editingNodeId = useStore((s) => s.editingNodeId);
  const setEditingNode = useStore((s) => s.setEditingNode);
  const updateNodeData = useStore((s) => s.updateNodeData);
  const project = useActiveProject();
  const colorIndex = useMemo(() => {
    if (!project) return 0;
    const domainIds = project.nodes
      .filter((n) => n.data.type === "domain")
      .map((n) => n.id);
    return Math.max(0, domainIds.indexOf(id));
  }, [project, id]);
  const color = domainColor(colorIndex);
  const addSide = data.uiAddSide ?? "bottom";
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
          "rounded-xl px-6 py-3.5 text-center min-w-[130px]",
          "border-l-4",
          "shadow-[0_1px_4px_rgba(0,0,0,0.04),0_4px_14px_rgba(0,0,0,0.04)]",
          selected && "shadow-[0_0_0_2px_var(--color-accent),0_4px_16px_rgba(99,102,241,0.1)]",
        )}
        style={{
          borderLeftColor: color.border,
          backgroundColor: color.bg,
          ...(isEditing && editMinWidth ? { minWidth: editMinWidth } : {}),
        }}
        onDoubleClick={() => {
          if (cardRef.current) setEditMinWidth(cardRef.current.offsetWidth);
          setEditingNode(id);
        }}
        ref={cardRef}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            defaultValue={data.label}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditingNode(null);
            }}
            className="w-full bg-transparent text-center text-[14px] font-semibold tracking-tight outline-none"
            style={{ color: color.text }}
          />
        ) : (
          <span className="text-[14px] font-semibold tracking-tight" style={{ color: color.text }}>
            {data.label || "Untitled"}
          </span>
        )}
        {!isEditing && data.description && (
          <div className="mt-1 text-[11px] text-text-tertiary truncate max-w-[160px] mx-auto">
            {data.description}
          </div>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          addChildNode(id);
        }}
        className={cn(
          "node-add-btn absolute flex h-7 w-7 items-center justify-center rounded-full text-[16px] font-semibold leading-none text-white shadow-sm ring-2 ring-white transition-colors",
          addButtonSideClass[addSide],
        )}
        style={{ backgroundColor: color.border }}
      >
        +
      </button>

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
