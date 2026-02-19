import { useStore, useSelectedNode, useActiveEdges } from "@/store";
import type { TaskStatus, MindEdge } from "@/types";

const statuses: { value: TaskStatus; label: string; color: string }[] = [
  { value: "pending", label: "Pending", color: "bg-status-pending" },
  { value: "in_progress", label: "In Progress", color: "bg-status-progress" },
  { value: "blocked", label: "Blocked", color: "bg-status-blocked" },
  { value: "done", label: "Done", color: "bg-status-done" },
];

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
  const node = useSelectedNode();
  const updateNodeData = useStore((s) => s.updateNodeData);
  const deleteNode = useStore((s) => s.deleteNode);
  const edges = useActiveEdges();

  if (!node) return null;

  const { data } = node;
  const childCount = countDescendants(node.id, edges);

  const handleDelete = () => {
    if (childCount > 0) {
      const confirmed = window.confirm(
        `Delete "${data.label || "Untitled"}" and ${childCount} ${childCount === 1 ? "child" : "children"}?`,
      );
      if (!confirmed) return;
    }
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
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Description
        </label>
        <textarea
          value={data.description ?? ""}
          onChange={(e) =>
            updateNodeData(node.id, { description: e.target.value })
          }
          rows={3}
          className="w-full resize-none rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary outline-none transition-colors focus:border-accent placeholder:text-text-muted"
        />
      </div>

      {(data.type === "task" || data.type === "feature") && (
        <>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Status
            </label>
            <div className="flex gap-1">
              {statuses.map((s) => (
                <button
                  key={s.value}
                  onClick={() =>
                    updateNodeData(node.id, { status: s.value })
                  }
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors ${
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

      {data.type !== "root" && (
        <div className="pt-2">
          <button
            onClick={handleDelete}
            className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          >
            {childCount > 0
              ? `Delete (and ${childCount} ${childCount === 1 ? "child" : "children"})`
              : "Delete"}
          </button>
        </div>
      )}
    </div>
  );
}
