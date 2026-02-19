import { useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  useStore,
  useSelectedNode,
  useActiveEdges,
  useActiveProject,
} from "@/store";
import type { TaskStatus, MindEdge, NodeType } from "@/types";
import { cn } from "@/lib/cn";

const statuses: { value: TaskStatus; label: string; color: string }[] = [
  { value: "pending", label: "Pending", color: "bg-status-pending" },
  { value: "in_progress", label: "In Progress", color: "bg-status-progress" },
  { value: "blocked", label: "Blocked", color: "bg-status-blocked" },
  { value: "done", label: "Done", color: "bg-status-done" },
];

const nextChildType: Record<NodeType, string> = {
  root: "domain",
  domain: "feature",
  goal: "feature",
  feature: "task",
  task: "task",
};

function countDescendants(nodeId: string, edges: MindEdge[]): number {
  let count = 0;
  const visit = (id: string) => {
    for (const edge of edges) {
      if (edge.source === id && edge.data?.edgeType === "hierarchy") {
        count++;
        visit(edge.target);
      }
    }
  };
  visit(nodeId);
  return count;
}

export function NodeDetail() {
  const project = useActiveProject();
  const node = useSelectedNode();
  const updateNodeData = useStore((s) => s.updateNodeData);
  const addChildNode = useStore((s) => s.addChildNode);
  const deleteNode = useStore((s) => s.deleteNode);
  const toggleGoal = useStore((s) => s.toggleGoal);
  const focusedNodeId = useStore((s) => s.focusedNodeId);
  const setFocusedNode = useStore((s) => s.setFocusedNode);
  const lockedNodeId = useStore((s) => s.lockedNodeId);
  const setLockedNode = useStore((s) => s.setLockedNode);
  const edges = useActiveEdges();

  const [isPreview, setIsPreview] = useState(false);

  if (!node) {
    if (!project) return null;

    const root = project.nodes.find((n) => n.data.type === "root");
    const canCreateFirstDomain = Boolean(root && project.nodes.length <= 1);

    return (
      <div className="border-t border-border px-4 py-4 space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Node details
        </h3>
        <p className="text-[12px] leading-relaxed text-text-secondary">
          Click a node to edit details, status, and assignee.
        </p>
        {canCreateFirstDomain && root && (
          <button
            onClick={() => addChildNode(root.id)}
            className="w-full rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Add first domain
          </button>
        )}
      </div>
    );
  }

  const { data } = node;
  const childCount = countDescendants(node.id, edges);
  const childLabel = nextChildType[data.type];

  // Logic for promotion button: feature under domain can become goal
  const parentEdge = project?.edges.find(e => e.target === node.id && e.data?.edgeType === "hierarchy");
  const parentNode = project?.nodes.find(n => n.id === parentEdge?.source);
  const canPromote = data.type === "feature" && parentNode?.data.type === "domain";
  const canDemote = data.type === "goal";

  const handleDelete = () => {
    deleteNode(node.id);
  };

  return (
    <div className="border-t border-border px-4 py-4 space-y-4">
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Title
        </label>
        <input
          type="text"
          value={data.label}
          onChange={(e) => updateNodeData(node.id, { label: e.target.value })}
          className="w-full rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary outline-none transition-colors focus:border-accent placeholder:text-text-muted"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Description
          </label>
          <button
            onClick={() => setIsPreview(!isPreview)}
            className="text-[10px] font-medium text-accent hover:underline"
          >
            {isPreview ? "Edit" : "Preview"}
          </button>
        </div>
        {isPreview ? (
          <div className="min-h-[80px] w-full rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-canvas prose-pre:p-2 prose-code:text-accent">
            {data.description ? (
              <ReactMarkdown>{data.description}</ReactMarkdown>
            ) : (
              <em className="text-text-tertiary">No description</em>
            )}
          </div>
        ) : (
          <textarea
            value={data.description ?? ""}
            onChange={(e) =>
              updateNodeData(node.id, { description: e.target.value })
            }
            placeholder="Add details (Markdown supported)..."
            rows={4}
            className="w-full resize-none rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary outline-none transition-colors focus:border-accent placeholder:text-text-muted"
          />
        )}
      </div>

      {(data.type === "task" || data.type === "feature" || data.type === "goal") && (
        <>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Status
            </label>
            <div className="flex flex-wrap gap-1">
              {statuses.map((s) => (
                <button
                  key={s.value}
                  onClick={() =>
                    updateNodeData(node.id, { status: s.value })
                  }
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] whitespace-nowrap transition-colors ${
                    (data.status ?? "pending") === s.value
                      ? "bg-accent-subtle text-accent font-medium"
                      : "text-text-tertiary hover:bg-surface-hover"
                  }`}
                >
                  <span className={`inline-block h-[5px] w-[5px] rounded-full ${s.color}`} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Assignee
            </label>
            <input
              type="text"
              value={data.assignee ?? ""}
              onChange={(e) =>
                updateNodeData(node.id, { assignee: e.target.value })
              }
              placeholder="Unassigned"
              className="w-full rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary outline-none transition-colors focus:border-accent placeholder:text-text-muted"
            />
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <button
          onClick={() => addChildNode(node.id)}
          className="rounded-md border border-accent/30 bg-accent-subtle px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:border-accent/50 hover:bg-accent-subtle/80"
        >
          Add {childLabel}
        </button>

        <button
          onClick={() => setFocusedNode(focusedNodeId === node.id ? null : node.id)}
          className={cn(
            "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
            focusedNodeId === node.id
              ? "border-accent bg-accent text-white hover:bg-accent-hover"
              : "border-border text-text-tertiary hover:bg-surface-hover hover:text-text-secondary"
          )}
        >
          {focusedNodeId === node.id ? "Unfocus" : "Focus"}
        </button>

        <button
          onClick={() => setLockedNode(lockedNodeId === node.id ? null : node.id)}
          className={cn(
            "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
            lockedNodeId === node.id
              ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
              : "border-border text-text-tertiary hover:bg-surface-hover hover:text-text-secondary"
          )}
          title="Lock the camera on this node while you work"
        >
          {lockedNodeId === node.id ? "Unlock View" : "Lock View"}
        </button>

        {canPromote && (
          <button
            onClick={() => toggleGoal(node.id)}
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
          >
            Promote to goal
          </button>
        )}

        {canDemote && (
          <button
            onClick={() => toggleGoal(node.id)}
            className="rounded-md border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
          >
            Demote to feature
          </button>
        )}

        {data.type !== "root" && (
          <button
            onClick={handleDelete}
            className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          >
            {childCount > 0
              ? `Delete (and ${childCount} ${childCount === 1 ? "child" : "children"})`
              : "Delete"}
          </button>
        )}
      </div>
    </div>
  );
}
