package data

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type NodeData struct {
	Label       string `json:"label"`
	Type        string `json:"type"`
	Description string `json:"description,omitempty"`
	Assignee    string `json:"assignee,omitempty"`
	Status      string `json:"status,omitempty"`
}

type Node struct {
	ID   string   `json:"id"`
	Type string   `json:"type"`
	Data NodeData `json:"data"`
}

type EdgeData struct {
	EdgeType string `json:"edgeType"`
}

type Edge struct {
	ID     string   `json:"id"`
	Source string   `json:"source"`
	Target string   `json:"target"`
	Data   EdgeData `json:"data"`
}

type Project struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}

type ProjectSummary struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// LoadProject reads and parses a single JSON project file.
func LoadProject(path string) (*Project, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", path, err)
	}

	var p Project
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("parsing %s: %w", path, err)
	}

	return &p, nil
}

// SaveProject saves a project to a JSON file using an atomic write.
func SaveProject(dataDir string, p *Project) error {
	body, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return err
	}

	filePath := filepath.Join(dataDir, fmt.Sprintf("%s.json", p.ID))
	tmpPath := filePath + ".tmp"

	if err := os.WriteFile(tmpPath, body, 0644); err != nil {
		return err
	}

	return os.Rename(tmpPath, filePath)
}

// LoadAllProjects loads all JSON files from the given directory.
func LoadAllProjects(dataDir string) ([]*Project, error) {
	matches, err := filepath.Glob(filepath.Join(dataDir, "*.json"))
	if err != nil {
		return nil, err
	}

	var projects []*Project
	for _, path := range matches {
		if strings.HasSuffix(path, ".tmp") {
			continue
		}
		p, err := LoadProject(path)
		if err != nil {
			fmt.Fprintf(os.Stderr, "warning: skipping %s: %v\n", path, err)
			continue
		}
		projects = append(projects, p)
	}

	return projects, nil
}

// LoadProjectSummaries returns a list of project metadata without loading full node data.
func LoadProjectSummaries(dataDir string) ([]ProjectSummary, error) {
	matches, err := filepath.Glob(filepath.Join(dataDir, "*.json"))
	if err != nil {
		return nil, err
	}

	var summaries []ProjectSummary
	for _, path := range matches {
		if strings.HasSuffix(path, ".tmp") {
			continue
		}
		// Still need to parse enough to get the name and id, or we could infer id from filename.
		// For now, let's just parse the full thing since Go is fast, but we return a smaller slice.
		p, err := LoadProject(path)
		if err != nil {
			continue
		}
		summaries = append(summaries, ProjectSummary{ID: p.ID, Name: p.Name})
	}
	return summaries, nil
}

// VaultDir returns the path to ~/.mind/, creating it if needed.
func VaultDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("cannot determine home directory: %w", err)
	}

	vault := filepath.Join(home, ".mind")
	if err := os.MkdirAll(vault, 0o755); err != nil {
		return "", fmt.Errorf("creating vault %s: %w", vault, err)
	}

	return vault, nil
}

// FindProject finds a project by ID (case-insensitive).
func FindProject(projects []*Project, id string) *Project {
	id = strings.ToLower(id)
	for _, p := range projects {
		if strings.ToLower(p.ID) == id || strings.ToLower(p.Name) == id {
			return p
		}
	}
	return nil
}
