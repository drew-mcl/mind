import type { ProjectData, ProjectSummary } from "@/types";

export async function fetchProjectSummaries(): Promise<ProjectSummary[]> {
  const res = await fetch("/api/projects?summary=true");
  return res.json();
}

export async function fetchProject(id: string): Promise<ProjectData> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error("Failed to fetch project");
  return res.json();
}

export async function fetchProjects(): Promise<ProjectData[]> {
  const res = await fetch("/api/projects");
  return res.json();
}

export async function saveProject(project: ProjectData): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project, null, 2),
  });
  if (!res.ok) {
    throw new Error(`Failed to save project (${res.status})`);
  }
}
