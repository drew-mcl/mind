package main

import (
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/drewbolles/mind/internal/data"
)

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	if max <= 3 {
		return s[:max]
	}
	return s[:max-3] + "..."
}

// runTree loads projects and prints trees.
func runTree(projectID string) error {
	dataDir, err := data.VaultDir()
	if err != nil {
		return err
	}

	projects, err := data.LoadAllProjects(dataDir)
	if err != nil {
		return err
	}

	if projectID != "" {
		p := data.FindProject(projects, projectID)
		if p == nil {
			return fmt.Errorf("project %q not found", projectID)
		}
		RenderProject(os.Stdout, p)
		return nil
	}

	for i, p := range projects {
		if i > 0 {
			fmt.Println()
		}
		RenderProject(os.Stdout, p)
	}

	return nil
}

// RenderProject renders a single project as a tree to the provided writer.
func RenderProject(w io.Writer, p *data.Project) {
	// Build lookup maps
	nodeMap := make(map[string]*data.Node)
	for i := range p.Nodes {
		nodeMap[p.Nodes[i].ID] = &p.Nodes[i]
	}

	// Build parent→children from hierarchy edges
	children := make(map[string][]string)
	hasParent := make(map[string]bool)
	// Build blocker map: target → list of source labels
	blockers := make(map[string][]string)

	for _, e := range p.Edges {
		switch e.Data.EdgeType {
		case "hierarchy":
			children[e.Source] = append(children[e.Source], e.Target)
			hasParent[e.Target] = true
		case "blocks":
			if src, ok := nodeMap[e.Source]; ok {
				label := src.Data.Label
				if label == "" {
					label = src.ID
				}
				blockers[e.Target] = append(blockers[e.Target], label)
			}
		}
	}

	// Find root nodes (no incoming hierarchy edge)
	var roots []string
	for _, n := range p.Nodes {
		if !hasParent[n.ID] {
			roots = append(roots, n.ID)
		}
	}

	// If there's a single root node, use it as the tree header
	if len(roots) == 1 {
		root := nodeMap[roots[0]]
		label := root.Data.Label
		if label == "" {
			label = p.Name
		}
		fmt.Fprintf(w, "%s%s%s\n", bold, label, reset)
		kids := children[roots[0]]
		for i, childID := range kids {
			renderTreeNode(w, childID, nodeMap, children, blockers, "", i == len(kids)-1)
		}
	} else {
		// Multiple roots — print project name as header
		fmt.Fprintf(w, "%s%s%s\n", bold, p.Name, reset)
		for i, rootID := range roots {
			renderTreeNode(w, rootID, nodeMap, children, blockers, "", i == len(roots)-1)
		}
	}
}

// renderTreeNode recursively prints a node and its children.
func renderTreeNode(w io.Writer, id string, nodeMap map[string]*data.Node, children map[string][]string, blockers map[string][]string, prefix string, isLast bool) {
	node, ok := nodeMap[id]
	if !ok {
		return
	}

	// Skip nodes with empty labels (draft/placeholder nodes)
	if node.Data.Label == "" {
		return
	}

	// Determine shape and color
	shape, shapeColor := nodeShape(node)
	labelStyle := white
	if node.Data.Status == "done" {
		shapeColor = gray
		labelStyle = gray
	}
	if node.Data.Status == "blocked" {
		shapeColor = red
	}

	// Tree connector
	connector := treeBranch
	if isLast {
		connector = treeLastBranch
	}

	// Build the line: connector + shape + label + metadata
	var meta []string

	// Status (for feature/task, skip pending — it's the default)
	if node.Data.Status != "" && node.Data.Status != "pending" {
		statusColor := statusToColor(node.Data.Status)
		meta = append(meta, fmt.Sprintf("%s%s%s", statusColor, node.Data.Status, reset))
	}

	// Assignee
	if node.Data.Assignee != "" {
		meta = append(meta, fmt.Sprintf("%s@%s%s", cyan, node.Data.Assignee, reset))
	}

	// Blockers
	if bs, ok := blockers[id]; ok && len(bs) > 0 {
		meta = append(meta, fmt.Sprintf("%s⊘ blocked by: %s%s", red, strings.Join(bs, ", "), reset))
	}

	// Description (only for domain and goal nodes, shown inline dimmed)
	descStr := ""
	if (node.Type == "domain" || node.Type == "goal") && node.Data.Description != "" {
		descStr = fmt.Sprintf(" %s— %s%s", dim, node.Data.Description, reset)
	}

	metaStr := ""
	if len(meta) > 0 {
		metaStr = "  " + strings.Join(meta, "  ")
	}

	label := truncate(node.Data.Label, 60)

	fmt.Fprintf(w, "%s%s%s%s%s %s%s%s%s%s\n",
		gray, prefix, connector, reset,
		shapeColor, shape, reset,
		labelStyle, " "+label, reset+descStr+metaStr)

	// Recurse into children
	kids := children[id]
	// Filter out empty-label children for counting
	var visibleKids []string
	for _, kid := range kids {
		if n, ok := nodeMap[kid]; ok && n.Data.Label != "" {
			visibleKids = append(visibleKids, kid)
		}
	}

	childPrefix := prefix
	if isLast {
		childPrefix += treeSpace
	} else {
		childPrefix += treeVertical
	}

	for i, childID := range visibleKids {
		renderTreeNode(w, childID, nodeMap, children, blockers, childPrefix, i == len(visibleKids)-1)
	}
}

// nodeShape returns the shape character and its color for a node.
func nodeShape(n *data.Node) (string, string) {
	switch n.Type {
	case "root":
		if n.Data.Status == "in_progress" || n.Data.Status == "done" {
			return shapeRootFilled, blue
		}
		return shapeRootOpen, blue
	case "domain":
		return shapeDomainFill, blue
	case "goal":
		switch n.Data.Status {
		case "done":
			return shapeGoalFilled, gray
		case "in_progress":
			return shapeGoalFilled, blue
		case "blocked":
			return shapeGoalOpen, red
		default:
			return shapeGoalOpen, gray
		}
	case "feature", "task":
		switch n.Data.Status {
		case "done":
			return shapeItemFilled, gray
		case "in_progress":
			return shapeItemFilled, blue
		case "blocked":
			return shapeItemOpen, red
		default: // pending or empty
			return shapeItemOpen, gray
		}
	default:
		return shapeItemOpen, gray
	}
}

// statusToColor returns the ANSI color for a status string.
func statusToColor(status string) string {
	switch status {
	case "done":
		return green
	case "in_progress":
		return blue
	case "blocked":
		return red
	default:
		return gray
	}
}
