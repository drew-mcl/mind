import { useEffect } from "react";
import { useStore } from "@/store";
import { fetchProjectSummaries } from "@/lib/api";
import { Canvas } from "@/components/Canvas";
import { Sidebar } from "@/components/Sidebar";
import { useDebouncedSave } from "@/hooks/useDebouncedSave";

export default function App() {
  const setProjects = useStore((s) => s.setProjects);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const applyLayout = useStore((s) => s.applyLayout);
  const isSidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useStore((s) => s.setSidebarCollapsed);

  useEffect(() => {
    fetchProjectSummaries().then((summaries) => {
      // Map summaries to ProjectData with empty arrays for initial list
      const initialProjects = summaries.map((s) => ({
        ...s,
        nodes: [],
        edges: [],
      }));
      setProjects(initialProjects);

      if (initialProjects.length > 0) {
        setActiveProject(initialProjects[0].id);
      }
    });
  }, [setProjects, setActiveProject]);

  // Apply layout whenever a project becomes active and is fully loaded
  const activeProject = useStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId),
  );
  useEffect(() => {
    if (activeProject && activeProject.nodes.length > 0) {
      applyLayout();
    }
  }, [activeProjectId, activeProject?.nodes.length, applyLayout]);

  useDebouncedSave();

  return (
    <div className="flex h-full overflow-hidden">
      <div
        className="transition-all duration-300 ease-in-out shrink-0 border-r border-border"
        style={{
          width: isSidebarCollapsed ? "0px" : "240px",
          opacity: isSidebarCollapsed ? 0 : 1,
          pointerEvents: isSidebarCollapsed ? "none" : "auto",
        }}
      >
        <Sidebar />
      </div>

      <div className="relative flex-1 min-w-0 bg-canvas">
        {isSidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="absolute top-4 left-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary shadow-sm transition-colors hover:bg-surface-hover"
            title="Expand sidebar"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
        <Canvas />
      </div>
    </div>
  );
}
