package main

import (
	"bytes"
	"strings"
	"testing"

	"github.com/drewbolles/mind/internal/data"
)

func TestRenderProject(t *testing.T) {
	p := &data.Project{
		ID:   "test-proj",
		Name: "Test Project",
		Nodes: []data.Node{
			{
				ID:   "root",
				Type: "root",
				Data: data.NodeData{Label: "Root Node"},
			},
			{
				ID:   "child",
				Type: "task",
				Data: data.NodeData{Label: "Child Task", Status: "done"},
			},
		},
		Edges: []data.Edge{
			{
				ID:     "e1",
				Source: "root",
				Target: "child",
				Data:   data.EdgeData{EdgeType: "hierarchy"},
			},
		},
	}

	var buf bytes.Buffer
	RenderProject(&buf, p)

	output := buf.String()

	if !strings.Contains(output, "Root Node") {
		t.Errorf("expected output to contain 'Root Node', got: %q", output)
	}
	if !strings.Contains(output, "Child Task") {
		t.Errorf("expected output to contain 'Child Task', got: %q", output)
	}
	// Check for tree branch character
	if !strings.Contains(output, treeLastBranch) {
		t.Errorf("expected output to contain tree branch %q, got: %q", treeLastBranch, output)
	}
}
