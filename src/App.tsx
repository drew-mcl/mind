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
    <div className="flex h-full">
      <Sidebar />
      <div className="flex-1">
        <Canvas />
      </div>
    </div>
  );
}
