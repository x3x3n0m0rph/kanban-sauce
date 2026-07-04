<div align="center">

<img src="https://raw.githubusercontent.com/salsa-lab/kanban-sauce/main/resources/icon.png" alt="Kanban Sauce" width="150" />

# Kanban Sauce

**A folder-focused kanban board for VS Code, backed by markdown files**

[![VS Marketplace](https://vsmarketplacebadges.dev/version/salsa-lab.kanban-sauce.svg?&colorB=orange)](https://marketplace.visualstudio.com/items?itemName=salsa-lab.kanban-sauce)
[![Open VSX](https://img.shields.io/open-vsx/v/salsa-lab/kanban-sauce?label=Open%20VSX&logo=vscodium)](https://open-vsx.org/extension/salsa-lab/kanban-sauce)
[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/salsa-lab/kanban-sauce?label=Downloads&logo=vscodium)](https://open-vsx.org/extension/salsa-lab/kanban-sauce)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

![Board Overview](https://raw.githubusercontent.com/salsa-lab/kanban-sauce/main/docs/images/board-overview.png)

</div>

---

Features are stored as markdown files with YAML frontmatter — version-controllable, diffable, and editable outside the extension. No accounts, no external services.

## Quick Start

1. **Install** — search "Kanban Sauce" in the Extensions view ([VS Marketplace](https://marketplace.visualstudio.com/items?itemName=salsa-lab.kanban-sauce) / [Open VSX](https://open-vsx.org/extension/salsa-lab/kanban-sauce))
2. **Open** — run `Open Kanban Board` from the command palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and choose any folder to open as a board
3. **Create** — click `+ New Feature` in the sidebar or click the `+` sign next to column headers to add a new card

## Features

### Multiple Kanban Boards

You can create and open multiple independent kanban boards inside the same workspace:
- **Open any folder**: Right-click any folder in the VS Code Explorer file tree and select **Open as Kanban Board**. Or run **Open Kanban Board** from the command palette to select from your history or pick a new folder.
- **No automatic/hidden folders**: Features are stored exactly inside the chosen directory in subfolders named after their status (`backlog`, `todo`, `in-progress`, `review`, `done`).
- **Run multiple simultaneously**: You can open two or more kanban boards side-by-side! Each tab will dynamically track and update cards for its specific directory path.

### Board & Workflow

- 5-column workflow — Backlog, To Do, In Progress, Review, Done (customizable)
- Drag-and-drop between columns and within columns
- Sidebar view from the activity bar
- Split-view editor — board on left, inline editor on right
- Horizontal and vertical layouts
- Compact mode for dense boards
- Keyboard shortcuts — `N` new feature, `Esc` close dialogs, `Cmd/Ctrl+Enter` submit

### Cards

Each card is a markdown file with YAML frontmatter.

<div align="center">

![Editor View](https://raw.githubusercontent.com/salsa-lab/kanban-sauce/main/docs/images/editor-view.png)

</div>

- Priority levels — Critical, High, Medium, Low with color-coded badges
- Assignees
- Due dates with smart formatting (Overdue, Today, Tomorrow, "5d", etc.)
- Labels — multiple per card, shows up to 3 with "+X more"
- Automatic created/modified timestamps
- Archive completed features to keep the board clean

### Search & Filtering

- Full-text search across content, IDs, assignees, and labels
- Filter by priority, assignee, label, or due date
- Due date filters — overdue, today, this week, or no date

### Editor Integration

- Rich text editing with Tiptap
- Inline frontmatter editing — dropdowns for status/priority, inputs for assignee/due date/labels
- Auto-save on change
- Auto-refresh when files change externally
- Native markdown mode — open files in VS Code's built-in editor instead
- Follows your VS Code/Cursor theme (light & dark)

## Differences from the Original Repository

This project is a fork of [Kanban Markdown](https://github.com/LachyFS/kanban-markdown-vscode-extension) extension. This fork introduces major architectural improvements and UI enhancements:

- **Dynamic Board Folder Selection**: You are no longer restricted to a single `.devtool/features` directory at the root of your workspace. You can open *any* folder as an independent Kanban board.
- **Multiple Concurrent Boards**: Fully supports running multiple Kanban board panels side-by-side. The Sidebar Summary view automatically tracks and switches to whichever board is active.
- **Persistent History Pruning**: Remembers your previously opened boards. It automatically filters out board directories that were deleted or moved, and includes a **Clear Board History...** picker to manually remove entries.
- **Granular Font Size Settings**: Extensive settings let you customize the font size of almost every component (column headers, card titles, card description previews, label tags, card metadata, editor headings, editor body, and the editor metadata block).
- **Cleaned Command Palette**: Obsolete/redundant commands like `selectBoard` or auto-generated focus actions are hidden or removed to prevent command palette clutter.
- **AI Tools Removal**: The "Build with AI" prompt integrations are completely stripped, making the extension 100% private, local, and exceptionally lightweight.

## File Format

Features live inside your selected board folder as Markdown files with YAML formatter, organized into subfolders by status.

```markdown
---
id: "remove-ai-integration-2026-07-04"
status: "done"
priority: "critical"
assignee: "peppe"
epic: null
dueDate: "2026-07-04"
created: "2026-07-04T09:27:55.052Z"
modified: "2026-07-04T09:27:55.052Z"
completedAt: "2026-07-04T09:27:55.052Z"
labels: ["enhancement"]
order: "Zz"
---
# Remove AI integration

Remove completely the AI integration, so that humans can waste a bit more time

```

## Configuration

Settings live under `kanban-sauce.*` in your VS Code preferences.

| Setting | Default | Description |
|---------|---------|-------------|
| `filenamePattern` | `name-date` | Filename pattern for new cards (`name-date`, `date-name`, `name-datetime`, `datetime-name`) |
| `defaultPriority` | `medium` | Default priority for new features |
| `defaultStatus` | `backlog` | Default status for new features |
| `columns` | *see below* | Customize column IDs, names, and colors |
| `showPriorityBadges` | `true` | Show priority badges on cards |
| `showAssignee` | `true` | Show assignee on cards |
| `showDueDate` | `true` | Show due date on cards |
| `showLabels` | `true` | Show labels on cards and in editors |
| `showFileName` | `false` | Show the source markdown filename on cards |
| `showEpic` | `true` | Show epic (parent grouping) on cards and in editors |
| `compactMode` | `false` | Use compact card layout |
| `addNewCardsToTop` | `false` | Add new cards to the top of the column |
| `markdownEditorMode` | `false` | Open files in VS Code's native text editor instead of the inline rich-text editor |
| `fontSizeColumnHeader` | `16px` | Font size for column headers in the Kanban board (e.g. `16px`, `1.1rem`) |
| `fontSizeCardTitle` | `14px` | Font size for card titles in the Kanban board (e.g. `14px`, `1rem`) |
| `fontSizeCardDescription` | `14px` | Font size for the feature card body/description text in the Kanban board (e.g. `14px`, `0.9rem`) |
| `fontSizeCardLabel` | `12px` | Font size for custom label tags on cards (e.g. `12px`, `0.8rem`) |
| `fontSizeCardMeta` | `13px` | Font size for card metadata like assignee, due date, epic, filename, and priority (e.g. `13px`, `0.8rem`) |
| `fontSizeEditorHeader` | `18px` | Font size for headings in the markdown editor/preview panel (e.g. `18px`, `1.5rem`) |
| `fontSizeEditorBody` | `16px` | Font size for body text, lists, and tables in the editor/preview panel (e.g. `16px`, `1.1rem`) |
| `fontSizeEditorMeta` | `14px` | Font size for elements in the metadata block above the editor/preview (e.g. `14px`, `0.9rem`) |
| `language` | `auto` | Language for the Kanban Sauce UI (`auto`, `en` - English, `es` - Español, `pt` - Português) |
| `hideScrollbar` | `false` | Hide scrollbars in the Kanban board (scrolling still works) |

Default columns:

```json
[
  { "id": "backlog", "name": "Backlog", "color": "#6b7280" },
  { "id": "todo", "name": "To Do", "color": "#3b82f6" },
  { "id": "in-progress", "name": "In Progress", "color": "#f59e0b" },
  { "id": "review", "name": "Review", "color": "#8b5cf6" },
  { "id": "done", "name": "Done", "color": "#22c55e" }
]
```

## Installation

### VS Code Marketplace

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=salsa-lab.kanban-sauce) or search "Kanban Sauce" in the Extensions view.

### Open VSX (VSCodium, Cursor, etc.)

Install from [Open VSX](https://open-vsx.org/extension/salsa-lab/kanban-sauce) or search "Kanban Sauce" in the Extensions view.

### From VSIX

1. Download the `.vsix` from [Releases](https://github.com/salsa-lab/kanban-sauce/releases)
2. In VS Code: Extensions > `...` > Install from VSIX
3. Select the downloaded file

## Development

### Prerequisites

- Node.js 18+
- pnpm

### Setup

```bash
pnpm install       # Install dependencies
pnpm dev           # Start development (watch mode)
pnpm build         # Build for production
pnpm typecheck     # Type checking
pnpm lint          # Linting
```

### Testing

```bash
# Unit + component tests (fast, no VS Code host required)
pnpm test

# Watch mode
pnpm test:watch

# Integration tests (launches a real VS Code instance)
pnpm test:integration
```

Unit tests cover shared logic, extension utilities, and React components. Integration tests run inside a VS Code host using `@vscode/test-electron` and exercise the real file system and VS Code APIs.

#### Running the CI pipeline locally with `act`

[`act`](https://github.com/nektos/act) runs GitHub Actions workflows locally in Docker.

```bash
# Install (macOS)
brew install act

# Run the full CI test job
act push -j test --container-architecture linux/amd64
```

The first run downloads a VS Code binary (~160 MB) into `.vscode-test/` which is cached for subsequent runs.

### Debugging

1. Press `F5` in VS Code to launch the Extension Development Host
2. Open the command palette and run "Open Kanban Board"
3. Make changes and reload the window (`Cmd+R`) to see updates

### Tech Stack

**Extension**: TypeScript, VS Code API, esbuild | **Webview**: React 18, Vite, Tailwind CSS, Zustand, Tiptap

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Contributors

Contributors to the main repository [Kanban Markdown](https://github.com/LachyFS/kanban-markdown-vscode-extension):

- [@LachyFS](https://github.com/LachyFS) — lead developer
- [@luciopaiva](https://github.com/luciopaiva) — sidebar view and layout improvements
- [@ungive](https://github.com/ungive) — file organization and status subfolders
- [@hodanli](https://github.com/hodanli) — label management enhancements
- [@SuperbDotHub](https://github.com/SuperbDotHub) — compact mode and card display options

## License

[MIT](LICENSE)
