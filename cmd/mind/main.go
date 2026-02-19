package main

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "mind",
	Short: "Mind map viewer and planner",
	RunE: func(cmd *cobra.Command, args []string) error {
		return runTree("")
	},
}

var treeCmd = &cobra.Command{
	Use:   "tree [project]",
	Short: "Display project tree",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		project := ""
		if len(args) > 0 {
			project = args[0]
		}
		return runTree(project)
	},
}

var uiCmd = &cobra.Command{
	Use:   "ui",
	Short: "Launch web UI",
	RunE: func(cmd *cobra.Command, args []string) error {
		npx, err := exec.LookPath("npx")
		if err != nil {
			return fmt.Errorf("npx not found in PATH: %w", err)
		}
		return syscall.Exec(npx, []string{"npx", "vite", "--open"}, os.Environ())
	},
}

func main() {
	rootCmd.AddCommand(treeCmd)
	rootCmd.AddCommand(uiCmd)

	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
