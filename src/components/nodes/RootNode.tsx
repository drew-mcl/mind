import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { MindNode } from "@/types";
import { cn } from "@/lib/cn";
import { useStore } from "@/store";
import { addButtonSideClass } from "./addButtonSide";

export function RootNode({ id, data, selected }: NodeProps<MindNode>) {
  const addChildNode = useStore((s) => s.addChildNode);
  const addSide = data.uiAddSide ?? "bottom";

  return (
    <div
      className={cn(
        "mind-node group relative transition-all duration-500 ease-out",
        selected ? "scale-[1.05] z-10" : "hover:scale-[1.02]",
        data.isFiltered && "node-filtered"
      )}
    >
      <div
        className={cn(
          "rounded-[2rem] px-12 py-7 text-center",
          "bg-white/90 backdrop-blur-xl border-2 border-accent/20",
          "transition-all duration-300 shadow-lg",
          selected ? "shadow-2xl border-accent/40 ring-4 ring-accent/10" : "group-hover:shadow-xl",
        )}
      >
        <span className="text-2xl font-black tracking-tight text-text-primary bg-gradient-to-br from-text-primary to-text-secondary bg-clip-text">
          {data.label}
        </span>
        {data.description && (
          <div className="mt-1 text-xs font-mono uppercase tracking-[0.2em] text-text-tertiary opacity-70">
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
          "node-add-btn absolute flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[18px] font-bold leading-none text-white shadow-xl ring-4 ring-white hover:bg-accent-hover hover:scale-110 transition-all",
          addButtonSideClass[addSide],
        )}
      >
        +
      </button>

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

