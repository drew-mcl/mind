import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "@/store";
import type { MindNode, MindEdge } from "@/types";

function makeNode(id: string, label: string, type: any = "task"): MindNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label, type, description: `Desc for ${id}`, assignee: `user-${id}` },
  };
}

function makeEdge(source: string, target: string): MindEdge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    data: { edgeType: "hierarchy" },
  };
}

describe("Search and Focus state", () => {
  beforeEach(() => {
    useStore.setState({
      projects: [
        {
          id: "p1",
          name: "Project 1",
          nodes: [
            makeNode("root", "Root", "root"),
            makeNode("d1", "Domain 1", "domain"),
            makeNode("f1", "Feature 1", "feature"),
            makeNode("t1", "Task 1", "task"),
          ],
          edges: [
            makeEdge("root", "d1"),
            makeEdge("d1", "f1"),
            makeEdge("f1", "t1"),
          ],
        },
      ],
      activeProjectId: "p1",
      searchQuery: "",
      focusedNodeId: null,
    });
  });

  it("sets and clears search query", () => {
    useStore.getState().setSearchQuery("find me");
    expect(useStore.getState().searchQuery).toBe("find me");
    
    useStore.getState().setSearchQuery("");
    expect(useStore.getState().searchQuery).toBe("");
  });

  it("sets and clears focused node", () => {
    useStore.getState().setFocusedNode("f1");
    expect(useStore.getState().focusedNodeId).toBe("f1");
    
    useStore.getState().setFocusedNode(null);
    expect(useStore.getState().focusedNodeId).toBeNull();
  });

  it("clears search and focus when switching projects", async () => {
    // Add a second project summary
    useStore.setState({
      projects: [
        ...useStore.getState().projects,
        { id: "p2", name: "Project 2", nodes: [], edges: [] }
      ]
    });

    useStore.getState().setSearchQuery("test");
    useStore.getState().setFocusedNode("f1");
    
    await useStore.getState().setActiveProject("p2");
    
    expect(useStore.getState().searchQuery).toBe("");
    expect(useStore.getState().focusedNodeId).toBeNull();
  });
});
