package main

// ANSI colors (matching athena cmd/ath/style.go)
var (
	reset = "\033[0m"
	bold  = "\033[1m"
	dim   = "\033[2m"

	red     = "\033[31m"
	green   = "\033[32m"
	yellow  = "\033[33m"
	blue    = "\033[34m"
	magenta = "\033[35m"
	cyan    = "\033[36m"
	white   = "\033[37m"
	gray    = "\033[90m"
)

// Tree connectors (matching athena internal/cli/box.go)
const (
	treeBranch     = "├─"
	treeLastBranch = "└─"
	treeVertical   = "│ "
	treeSpace      = "  "
)

// Shapes by node type (matching athena internal/cli/box.go)
//   root:    ■/□ (goal equivalent)
//   domain:  ◆/◇ (feature equivalent)
//   feature: ●/○ (task equivalent)
//   task:    ●/○
const (
	shapeRootOpen    = "□"
	shapeRootFilled  = "■"
	shapeDomainOpen  = "◇"
	shapeDomainFill  = "◆"
	shapeItemOpen    = "○"
	shapeItemFilled  = "●"
)
