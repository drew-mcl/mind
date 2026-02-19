import type { ProjectData } from "@/types";

export async function fetchProjects(): Promise<ProjectData[]> {
  const res = await fetch("/api/projects");
  return res.json();
}

export async function saveProject(project: ProjectData): Promise<void> {
  await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project, null, 2),
  });
}
