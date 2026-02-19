package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/drewbolles/mind/internal/data"
	"github.com/spf13/cobra"
)

var (
	flagGitHub bool
	flagGitLab bool
)

var vaultCmd = &cobra.Command{
	Use:   "vault",
	Short: "Manage the mind vault (~/.mind)",
}

var vaultInitCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize vault as a git repo",
	Long:  "Initialize ~/.mind as a git repository. Use --github or --gitlab to create a private remote.",
	RunE:  runVaultInit,
}

var vaultSyncCmd = &cobra.Command{
	Use:   "sync",
	Short: "Sync vault to remote (commit + pull + push)",
	RunE:  runVaultSync,
}

var vaultStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show vault git status",
	RunE:  runVaultStatus,
}

func init() {
	vaultInitCmd.Flags().BoolVar(&flagGitHub, "github", false, "Create private GitHub repo via gh CLI")
	vaultInitCmd.Flags().BoolVar(&flagGitLab, "gitlab", false, "Create private GitLab repo via glab CLI")

	vaultCmd.AddCommand(vaultInitCmd)
	vaultCmd.AddCommand(vaultSyncCmd)
	vaultCmd.AddCommand(vaultStatusCmd)
}

func vaultDir() (string, error) {
	return data.VaultDir()
}

func git(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

func gitQuiet(dir string, args ...string) error {
	_, err := git(dir, args...)
	return err
}

func isGitRepo(dir string) bool {
	err := gitQuiet(dir, "rev-parse", "--git-dir")
	return err == nil
}

func hasRemote(dir string) bool {
	out, err := git(dir, "remote")
	return err == nil && strings.TrimSpace(out) != ""
}

func hasStagedOrUntracked(dir string) bool {
	out, _ := git(dir, "status", "--porcelain")
	return out != ""
}

func runVaultInit(cmd *cobra.Command, args []string) error {
	dir, err := vaultDir()
	if err != nil {
		return err
	}

	if isGitRepo(dir) {
		fmt.Printf("vault already initialized at %s\n", dir)
	} else {
		if err := gitQuiet(dir, "init"); err != nil {
			return fmt.Errorf("git init: %w", err)
		}
		fmt.Printf("initialized vault at %s\n", dir)
	}

	// Create .gitignore if missing
	gitignorePath := dir + "/.gitignore"
	if _, err := os.Stat(gitignorePath); os.IsNotExist(err) {
		os.WriteFile(gitignorePath, []byte(".DS_Store\n*.tmp\n"), 0o644)
	}

	// Initial commit if repo is empty
	if _, err := git(dir, "rev-parse", "HEAD"); err != nil {
		gitQuiet(dir, "add", "-A")
		gitQuiet(dir, "commit", "-m", "init: mind vault")
		fmt.Println("created initial commit")
	}

	if flagGitHub {
		return initGitHubRemote(dir)
	}
	if flagGitLab {
		return initGitLabRemote(dir)
	}

	return nil
}

func initGitHubRemote(dir string) error {
	if _, err := exec.LookPath("gh"); err != nil {
		return fmt.Errorf("gh CLI not found — install it: https://cli.github.com")
	}

	if hasRemote(dir) {
		fmt.Println("remote already configured")
		return pushVault(dir)
	}

	cmd := exec.Command("gh", "repo", "create", "mind-vault", "--private", "--source=.", "--remote=origin", "--push")
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("gh repo create: %w", err)
	}

	fmt.Println("pushed to GitHub")
	return nil
}

func initGitLabRemote(dir string) error {
	if _, err := exec.LookPath("glab"); err != nil {
		return fmt.Errorf("glab CLI not found — install it: https://gitlab.com/gitlab-org/cli")
	}

	if hasRemote(dir) {
		fmt.Println("remote already configured")
		return pushVault(dir)
	}

	// Create project
	cmd := exec.Command("glab", "repo", "create", "mind-vault", "--private", "-y")
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("glab repo create: %w", err)
	}

	return pushVault(dir)
}

func pushVault(dir string) error {
	if err := gitQuiet(dir, "push", "-u", "origin", "main"); err != nil {
		// Try master if main doesn't exist
		if err2 := gitQuiet(dir, "push", "-u", "origin", "master"); err2 != nil {
			return fmt.Errorf("push failed: %w", err)
		}
	}
	return nil
}

func runVaultSync(cmd *cobra.Command, args []string) error {
	dir, err := vaultDir()
	if err != nil {
		return err
	}

	if !isGitRepo(dir) {
		return fmt.Errorf("vault not initialized — run: mind vault init")
	}

	// Stage and commit if there are changes
	if hasStagedOrUntracked(dir) {
		gitQuiet(dir, "add", "-A")
		msg := fmt.Sprintf("sync: %s", time.Now().Format("2006-01-02 15:04"))
		if err := gitQuiet(dir, "commit", "-m", msg); err != nil {
			return fmt.Errorf("commit: %w", err)
		}
		fmt.Println("committed changes")
	} else {
		fmt.Println("no changes to commit")
	}

	// Pull + push if remote exists
	if hasRemote(dir) {
		fmt.Println("pulling...")
		if err := gitQuiet(dir, "pull", "--rebase"); err != nil {
			return fmt.Errorf("pull: %w", err)
		}
		fmt.Println("pushing...")
		if err := gitQuiet(dir, "push"); err != nil {
			return fmt.Errorf("push: %w", err)
		}
		fmt.Println("synced")
	} else {
		fmt.Println("no remote configured — run: mind vault init --github")
	}

	return nil
}

func runVaultStatus(cmd *cobra.Command, args []string) error {
	dir, err := vaultDir()
	if err != nil {
		return err
	}

	fmt.Printf("vault: %s\n", dir)

	if !isGitRepo(dir) {
		fmt.Println("status: not initialized")
		return nil
	}

	// Show remote
	if remote, err := git(dir, "remote", "get-url", "origin"); err == nil {
		fmt.Printf("remote: %s\n", remote)
	} else {
		fmt.Println("remote: none")
	}

	// Show status
	out, _ := git(dir, "status", "--short")
	if out == "" {
		fmt.Println("status: clean")
	} else {
		fmt.Printf("status:\n%s\n", out)
	}

	// File count
	files, _ := os.ReadDir(dir)
	jsonCount := 0
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".json") {
			jsonCount++
		}
	}
	fmt.Printf("projects: %d\n", jsonCount)

	return nil
}
