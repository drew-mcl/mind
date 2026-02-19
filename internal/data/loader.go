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

// LoadAllProjects loads all JSON files from the given directory.
func LoadAllProjects(dataDir string) ([]*Project, error) {
	matches, err := filepath.Glob(filepath.Join(dataDir, "*.json"))
	if err != nil {
		return nil, err
	}

	if len(matches) == 0 {
		return nil, fmt.Errorf("no JSON files found in %s", dataDir)
	}

	var projects []*Project
	for _, path := range matches {
		p, err := LoadProject(path)
		if err != nil {
			fmt.Fprintf(os.Stderr, "warning: skipping %s: %v\n", path, err)
			continue
		}
		projects = append(projects, p)
	}

	return projects, nil
}

// FindDataDir walks up from cwd looking for a data/ directory with JSON files.
func FindDataDir() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}

	for {
		candidate := filepath.Join(dir, "data")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			matches, _ := filepath.Glob(filepath.Join(candidate, "*.json"))
			if len(matches) > 0 {
				return candidate, nil
			}
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return "", fmt.Errorf("no data/ directory with JSON files found")
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
