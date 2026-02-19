import { useEffect, useRef } from "react";
import { useActiveProject } from "@/store";
import { saveProject } from "@/lib/api";

export function useDebouncedSave() {
  const project = useActiveProject();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prevRef = useRef<string>(undefined);

  useEffect(() => {
    if (!project) return;

    const serialized = JSON.stringify(project);
    if (serialized === prevRef.current) return;
    prevRef.current = serialized;

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      saveProject(project);
    }, 2000);

    return () => clearTimeout(timeoutRef.current);
  }, [project]);
}
