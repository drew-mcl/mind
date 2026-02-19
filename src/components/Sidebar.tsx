import { useState, useRef, useEffect } from "react";
import { useStore, useActiveProject } from "@/store";
import { NodeDetail } from "./NodeDetail";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const projects = useStore((s) => s.projects);
  const project = useActiveProject();
  const activeProjectId = useStore((s) => s.activeProjectId);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const applyLayout = useStore((s) => s.applyLayout);
  const createProject = useStore((s) => s.createProject);
  const addChildNode = useStore((s) => s.addChildNode);
  const connectMode = useStore((s) => s.connectMode);
  const setConnectMode = useStore((s) => s.setConnectMode);
  const saveStatus = useStore((s) => s.saveStatus);
  const saveError = useStore((s) => s.saveError);
  const clearSaveError = useStore((s) => s.clearSaveError);
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const setSidebarCollapsed = useStore((s) => s.setSidebarCollapsed);
  const autoFocusEnabled = useStore((s) => s.autoFocusEnabled);
  const setAutoFocusEnabled = useStore((s) => s.setAutoFocusEnabled);

  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  const handleCreate = () => {
    const name = inputRef.current?.value.trim();
    if (name) {
      createProject(name);
      setIsCreating(false);
    }
  };

  const rootId = project?.nodes.find((n) => n.data.type === "root")?.id;
  const showFirstNodeCta = Boolean(project && rootId && project.nodes.length <= 1);

  const saveStatusText =
    saveStatus === "saving"
      ? "Saving..."
      : saveStatus === "dirty"
        ? "Unsaved"
        : saveStatus === "error"
          ? saveError ?? "Save failed"
          : "Saved";

  return (
    <aside className="flex h-full w-full flex-col bg-surface">
      <div className="px-5 py-3.5 border-b border-border-subtle">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="group -ml-1 flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:bg-surface-hover hover:text-text-secondary transition-colors"
              title="Collapse sidebar"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <h1 className="text-sm font-bold tracking-tight text-text-primary">mind</h1>
          </div>
          <button
            onClick={() => saveStatus === "error" && clearSaveError()}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium transition-all",
              saveStatus === "saving" && "bg-accent-subtle text-accent",
              saveStatus === "dirty" && "bg-amber-50 text-amber-700",
              saveStatus === "error" && "bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer",
              saveStatus === "saved" && "bg-emerald-50 text-emerald-700",
            )}
            title={saveStatus === "error" ? "Click to clear error" : saveStatusText}
          >
            {saveStatusText}
          </button>
        </div>
      </div>

      <div className="px-3 py-3 border-b border-border-subtle bg-canvas/30">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nodes..."
            className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] text-text-primary outline-none focus:border-accent placeholder:text-text-muted"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-3">
          <h2 className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Projects
          </h2>
          <div className="space-y-px">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveProject(p.id)}
                className={cn(
                  "w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                  p.id === activeProjectId
                    ? "bg-accent-subtle text-accent font-medium"
                    : "text-text-secondary hover:bg-surface-hover",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>

          {isCreating ? (
            <div className="mt-1.5 rounded-lg border border-accent bg-surface p-2 shadow-sm">
              <input
                ref={inputRef}
                placeholder="Project name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setIsCreating(false);
                }}
                className="w-full rounded-md border border-border bg-canvas px-2 py-1 text-[13px] text-text-primary outline-none focus:border-accent placeholder:text-text-muted"
              />
              <div className="mt-1.5 flex gap-1.5">
                <button
                  onClick={handleCreate}
                  className="flex-1 rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-white hover:bg-accent-hover transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => setIsCreating(false)}
                  className="rounded-md px-2 py-1 text-[11px] text-text-tertiary hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] text-text-tertiary hover:bg-surface-hover hover:text-text-secondary transition-colors"
            >
              + New project
            </button>
          )}
        </div>

        <div className="px-3 pb-2 space-y-1.5">
          {showFirstNodeCta && rootId && (
            <button
              onClick={() => addChildNode(rootId)}
              className="w-full rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Add first domain
            </button>
          )}
          <button
            onClick={applyLayout}
            className="w-full rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-text-tertiary hover:bg-surface-hover hover:text-text-secondary transition-colors"
          >
            Re-arrange
          </button>
          <button
            onClick={() =>
              setConnectMode(connectMode === "blocking" ? "off" : "blocking")
            }
            className={cn(
              "w-full rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
              connectMode === "blocking"
                ? "border-status-blocked bg-orange-50 text-status-blocked"
                : "border-border text-text-tertiary hover:bg-surface-hover hover:text-text-secondary",
            )}
          >
            {connectMode === "blocking" ? "Cancel linking" : "Link blocker"}
          </button>
          
          <button
            onClick={() => setAutoFocusEnabled(!autoFocusEnabled)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
              autoFocusEnabled
                ? "bg-accent-subtle/30 text-accent border-accent/20"
                : "text-text-tertiary hover:bg-surface-hover hover:text-text-secondary",
            )}
          >
            <span>Auto-focus camera</span>
            <div className={cn(
              "h-3 w-6 rounded-full relative transition-colors",
              autoFocusEnabled ? "bg-accent" : "bg-border"
            )}>
              <div className={cn(
                "absolute top-0.5 h-2 w-2 rounded-full bg-white transition-all",
                autoFocusEnabled ? "left-3.5" : "left-0.5"
              )} />
            </div>
          </button>
        </div>

        <NodeDetail />
      </div>
    </aside>
  );
}
