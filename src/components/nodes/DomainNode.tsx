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
        selected ? "scale-[1.04] z-10" : "hover:scale-[1.02]",
        data.isFiltered && "node-filtered"
      )}
    >
      <div
        className={cn(
          "rounded-2xl px-6 py-4 text-center min-w-[150px]",
          "backdrop-blur-md border border-white/20 shadow-md",
          "transition-all duration-300",
          selected ? "shadow-lg ring-2 ring-accent/20" : "group-hover:shadow-lg",
        )}
        style={{
          backgroundColor: color.bg.replace(")", ", 0.92)").replace("rgb", "rgba"),
          boxShadow: selected ? `0 12px 24px -8px ${color.border}44` : undefined,
          borderColor: color.border,
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
            placeholder="Domain name..."
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditingNode(null);
            }}
            className="w-full bg-transparent text-center text-[15px] font-bold tracking-tight outline-none placeholder:text-text-muted/50"
            style={{ color: color.text }}
          />
        ) : (
          <span className="text-[15px] font-bold tracking-tight" style={{ color: color.text }}>
            {data.label || "Untitled"}
          </span>
        )}
        {!isEditing && data.description && (
          <div className="mt-1.5 text-[10px] font-mono uppercase tracking-widest opacity-60 truncate max-w-[180px] mx-auto">
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
          "node-add-btn absolute flex h-7 w-7 items-center justify-center rounded-full text-[16px] font-semibold leading-none text-white shadow-lg ring-4 ring-white transition-all hover:scale-110",
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

