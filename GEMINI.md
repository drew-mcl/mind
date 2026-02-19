# Mind

"Mind" is a hybrid mind map viewer and project planner that provides both a high-fidelity web interface and a lightweight terminal-based tree view. It is designed for structured project breakdown using hierarchical nodes and dependency tracking.

## Project Overview

- **Purpose:** Visualize and plan project structures, breaking down goals into domains, features, and tasks.
- **Backend/CLI:** Written in Go, providing a terminal UI and a bridge to the web interface.
- **Frontend:** A React-based single-page application (SPA) using React Flow for interactive mind map visualization.
- **Data Model:** Projects are defined by nodes and edges stored in JSON format.

### Tech Stack

- **Core:** Go 1.25.7, React 19, TypeScript
- **CLI Framework:** [Cobra](https://github.com/spf13/cobra)
- **Web UI:** [Vite](https://vite.dev/), [Tailwind CSS 4](https://tailwindcss.com/), [Zustand](https://zustand-demo.pmnd.rs/)
- **Graph Visualization:** [@xyflow/react](https://reactflow.dev/) (React Flow), [Dagre](https://github.com/dagrejs/dagre) (for layout)
- **Testing:** [Vitest](https://vitest.dev/), [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

## Key Concepts

### Node Types
- **Root:** The central goal or project name (Shape: ■/□).
- **Domain:** A high-level category or area of responsibility (Shape: ◆/◇).
- **Feature:** A specific piece of functionality (Shape: ●/○).
- **Task:** An actionable item (Shape: ●/○).

### Edge Types
- **Hierarchy:** Represents a parent-child relationship (e.g., Domain -> Feature).
- **Blocks:** Represents a dependency where one node blocks another.

### Statuses
Nodes (specifically Features and Tasks) can have statuses: `pending`, `in_progress`, `done`, or `blocked`.

## Building and Running

### CLI (Go)
- **Build:** `make build` (produces the `mind` binary)
- **Install:** `make install`
- **View Tree:** `mind tree [project-id]` (defaults to all projects if ID is omitted)
- **Launch UI:** `mind ui` (runs `npx vite --open`)

### Web UI (Vite)
- **Development:** `npm run dev`
- **Build:** `npm run build`
- **Test:** `npm test`
- **Preview Build:** `npm run preview`

## Development Conventions

### Data Storage
- Project data is stored in the `data/` directory as JSON files (e.g., `data/mind.json`).
- **Web UI Backend:** For development, a custom Vite plugin (`src/plugins/dataApi.ts`) implements the `/api/projects` endpoints, providing direct file system persistence for the frontend.
- **Go CLI:** The Go code (`internal/data/loader.go`) also parses these files to provide the terminal tree view.

### State Management
- The frontend uses **Zustand** (`src/store/index.ts`) for global state.
- React Flow's `onNodesChange` and `onEdgesChange` are integrated into the Zustand store for seamless node manipulation.
- Radial layout logic is implemented in `src/lib/layout.ts` and triggered via the store.

### Directory Structure
- `cmd/mind/`: CLI entry point and terminal UI implementation.
- `internal/data/`: Shared Go data structures and JSON loading logic.
- `src/components/`: React components, divided into `nodes/`, `edges/`, and layout UI.
- `src/store/`: Zustand store and selectors.
- `src/lib/`: Utility functions for layouts, colors, and API interactions.
