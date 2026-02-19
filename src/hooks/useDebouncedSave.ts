import { useEffect, useRef } from "react";
import { useActiveProject, useStore } from "@/store";
import { saveProject } from "@/lib/api";

export function useDebouncedSave() {
  const project = useActiveProject();
  const setSaveStatus = useStore((s) => s.setSaveStatus);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prevRef = useRef<string>(undefined);
  const currentProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!project) {
      currentProjectIdRef.current = null;
      return;
    }

    const serialized = JSON.stringify(project);

    // Switching projects should not immediately enqueue a save.
    if (currentProjectIdRef.current !== project.id) {
      currentProjectIdRef.current = project.id;
      prevRef.current = serialized;
      setSaveStatus("saved");
      clearTimeout(timeoutRef.current);
      return;
    }

    if (serialized === prevRef.current) return;
    prevRef.current = serialized;

    setSaveStatus("dirty");
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      try {
        setSaveStatus("saving");
        await saveProject(project);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error", "Save failed");
      }
    }, 1200);

    return () => clearTimeout(timeoutRef.current);
  }, [project, setSaveStatus]);
}
