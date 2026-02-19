import { useEffect } from "react";
import { useStore } from "@/store";
import { fetchProjects } from "@/lib/api";
import { Canvas } from "@/components/Canvas";
import { Sidebar } from "@/components/Sidebar";
import { useDebouncedSave } from "@/hooks/useDebouncedSave";

export default function App() {
  const setProjects = useStore((s) => s.setProjects);
  const applyLayout = useStore((s) => s.applyLayout);

  useEffect(() => {
    fetchProjects().then((projects) => {
      setProjects(projects);
      // Apply layout after a tick so the store is settled
      setTimeout(() => applyLayout(), 0);
    });
  }, [setProjects, applyLayout]);

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
