import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { MindNode } from "@/types";
import { cn } from "@/lib/cn";
import { useStore } from "@/store";

export function RootNode({ id, data, selected }: NodeProps<MindNode>) {
  const addChildNode = useStore((s) => s.addChildNode);

  return (
    <div className="mind-node relative">
      <div
        className={cn(
          "rounded-2xl px-10 py-5 text-center",
          "bg-surface border-2 border-accent/30",
          "shadow-[0_2px_8px_rgba(99,102,241,0.06),0_8px_28px_rgba(99,102,241,0.05)]",
          selected && "border-accent shadow-[0_0_0_3px_rgba(99,102,241,0.15),0_8px_28px_rgba(99,102,241,0.08)]",
        )}
      >
        <span className="text-lg font-bold tracking-tight text-text-primary">
          {data.label}
        </span>
        {data.description && (
          <div className="mt-0.5 text-xs text-text-tertiary">
            {data.description}
          </div>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          addChildNode(id);
        }}
        className="node-add-btn absolute -bottom-4 left-1/2 flex items-center justify-center w-6 h-6 rounded-full bg-accent text-[15px] font-medium leading-none text-white shadow-sm hover:bg-accent-hover transition-colors"
      >
        +
      </button>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
