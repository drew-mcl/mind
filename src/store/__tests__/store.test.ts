import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "@/store";

describe("useStore", () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    useStore.setState({
      projects: [],
      activeProjectId: null,
      selectedNodeId: null,
      editingNodeId: null,
      connectMode: "off",
      connectSourceId: null,
    });
  });

  describe("createProject", () => {
    it("creates a project with a root node", () => {
      useStore.getState().createProject("My Project");

      const state = useStore.getState();
      expect(state.projects).toHaveLength(1);

      const project = state.projects[0];
      expect(project.name).toBe("My Project");
      expect(project.nodes).toHaveLength(1);
      expect(project.nodes[0].data.type).toBe("root");
      expect(project.nodes[0].data.label).toBe("My Project");
      expect(project.edges).toHaveLength(0);
    });

    it("sets the new project as active", () => {
      useStore.getState().createProject("Test");

      const state = useStore.getState();
      expect(state.activeProjectId).toBe(state.projects[0].id);
    });

    it("generates a slug-based ID from the name", () => {
      useStore.getState().createProject("My Cool Project");

      const project = useStore.getState().projects[0];
      expect(project.id).toBe("my-cool-project");
    });
  });

  describe("addChildNode", () => {
    beforeEach(() => {
      useStore.getState().createProject("Test");
    });

    it("adds a domain child to a root node", () => {
      const project = useStore.getState().activeProject()!;
      const rootId = project.nodes[0].id;

      useStore.getState().addChildNode(rootId);

      const updated = useStore.getState().activeProject()!;
      expect(updated.nodes).toHaveLength(2);
      expect(updated.edges).toHaveLength(1);

      const child = updated.nodes[1];
      expect(child.data.type).toBe("domain");

      const edge = updated.edges[0];
      expect(edge.source).toBe(rootId);
      expect(edge.target).toBe(child.id);
      expect(edge.data?.edgeType).toBe("hierarchy");
    });

    it("adds a feature child to a domain node", () => {
      const rootId = useStore.getState().activeProject()!.nodes[0].id;
      useStore.getState().addChildNode(rootId);

      const domainId = useStore.getState().activeProject()!.nodes[1].id;
      useStore.getState().addChildNode(domainId);

      const updated = useStore.getState().activeProject()!;
      expect(updated.nodes).toHaveLength(3);
      const feature = updated.nodes[2];
      expect(feature.data.type).toBe("feature");
    });

    it("adds a task child to a feature node", () => {
      const rootId = useStore.getState().activeProject()!.nodes[0].id;
      useStore.getState().addChildNode(rootId);

      const domainId = useStore.getState().activeProject()!.nodes[1].id;
      useStore.getState().addChildNode(domainId);

      const featureId = useStore.getState().activeProject()!.nodes[2].id;
      useStore.getState().addChildNode(featureId);

      const updated = useStore.getState().activeProject()!;
      expect(updated.nodes).toHaveLength(4);
      const task = updated.nodes[3];
      expect(task.data.type).toBe("task");
    });

    it("selects the new child node and sets it to editing", () => {
      const rootId = useStore.getState().activeProject()!.nodes[0].id;
      useStore.getState().addChildNode(rootId);

      const state = useStore.getState();
      const child = state.activeProject()!.nodes[1];
      expect(state.selectedNodeId).toBe(child.id);
      expect(state.editingNodeId).toBe(child.id);
    });
  });

  describe("updateNodeData", () => {
    beforeEach(() => {
      useStore.getState().createProject("Test");
    });

    it("updates properties on a node", () => {
      const rootId = useStore.getState().activeProject()!.nodes[0].id;

      useStore.getState().updateNodeData(rootId, { label: "Updated Label" });

      const node = useStore.getState().activeProject()!.nodes[0];
      expect(node.data.label).toBe("Updated Label");
    });

    it("preserves other data fields when updating", () => {
      const rootId = useStore.getState().activeProject()!.nodes[0].id;

      useStore.getState().updateNodeData(rootId, { label: "New" });

      const node = useStore.getState().activeProject()!.nodes[0];
      expect(node.data.type).toBe("root");
      expect(node.data.label).toBe("New");
    });

    it("can add optional fields like description", () => {
      const rootId = useStore.getState().activeProject()!.nodes[0].id;

      useStore.getState().updateNodeData(rootId, { description: "A note" });

      const node = useStore.getState().activeProject()!.nodes[0];
      expect(node.data.description).toBe("A note");
    });
  });

  describe("deleteNode", () => {
    beforeEach(() => {
      useStore.getState().createProject("Test");
      const rootId = useStore.getState().activeProject()!.nodes[0].id;
      useStore.getState().addChildNode(rootId);
    });

    it("removes the node from the project", () => {
      const childId = useStore.getState().activeProject()!.nodes[1].id;

      useStore.getState().deleteNode(childId);

      const updated = useStore.getState().activeProject()!;
      expect(updated.nodes).toHaveLength(1);
      expect(updated.nodes.find((n) => n.id === childId)).toBeUndefined();
    });

    it("removes edges connected to the deleted node", () => {
      const childId = useStore.getState().activeProject()!.nodes[1].id;

      useStore.getState().deleteNode(childId);

      const updated = useStore.getState().activeProject()!;
      expect(updated.edges).toHaveLength(0);
    });

    it("clears selectedNodeId when deleting the selected node", () => {
      const childId = useStore.getState().activeProject()!.nodes[1].id;
      useStore.getState().setSelectedNode(childId);

      useStore.getState().deleteNode(childId);

      expect(useStore.getState().selectedNodeId).toBeNull();
    });
  });
});
