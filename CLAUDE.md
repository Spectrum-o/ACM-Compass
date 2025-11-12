# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ACM-Compass is a local web-based tool for managing competitive programming problems and contests. It features a **Gradio-based** interactive UI with Python event handlers, storing data in JSON files under version control for natural multi-person collaboration.

## Development Commands

### Setup
```bash
# Using uv (recommended, already configured)
uv sync
```

### Running the Server
```bash
# Development mode (default runs on http://127.0.0.1:7860)

# Or with uv
uv run python server.py
```

Server runs at `http://127.0.0.1:7860/`

### Testing
No automated tests currently configured. Manual testing through the Gradio web UI.

## Project Structure

```
acm-compass/
├── server.py                 # Main entry point (48 lines)
├── src/
│   ├── __init__.py
│   ├── models.py            # Pydantic data models
│   ├── data_manager.py      # JSON file I/O operations
│   ├── git_utils.py         # Git command wrappers
│   └── ui/
│       ├── __init__.py
│       ├── problems.py      # Problem management UI
│       ├── contests.py      # Contest management UI
│       └── git_sync.py      # Git sync UI
├── data/
│   ├── problems.json        # Problem data
│   ├── contests.json        # Contest data
│   └── solutions/           # Solution markdown files
├── pyproject.toml           # Project dependencies
└── README.md
```

## Architecture

### Modular Design

The project follows a clean separation of concerns:

**Core Modules (`src/`):**
- `models.py` - Pydantic models for data validation
- `data_manager.py` - All file I/O operations (thread-safe with `_lock`)
- `git_utils.py` - Git operations (pull, push, status checks)

**UI Modules (`src/ui/`):**
- `problems.py` - Problem management tabs (All/Unsolved/Solved)
- `contests.py` - Contest management tab
- `git_sync.py` - Git sync tab

**Main Application (`server.py`):**
- Ultra-simple entry point (~48 lines)
- Imports UI builders and composes them
- No business logic - pure UI assembly

### Data Flow

```
User Interaction (Gradio UI)
    ↓
UI Handlers (src/ui/*.py)
    ↓
Data Operations (src/data_manager.py)
    ↓
File System (data/*.json, data/solutions/*.md)
```

### Key Principles

1. **Single Responsibility**: Each module has one clear purpose
2. **No Circular Dependencies**: Clean import hierarchy
3. **Thread Safety**: All file operations use locking
4. **Type Safety**: Pydantic models for validation
5. **Reusability**: Problem UI is reused for 3 tabs (All/Unsolved/Solved)

## Data Storage

**Problems (`data/problems.json`):**
- Core: `id`, `title`, `link`, `source`, `tags[]`
- Status: `solved` (bool), `unsolved_stage` (enum)
- Metadata: `assignee`, `pass_count`, `notes`
- Timestamps: `created_at`, `updated_at` (ISO8601)

**Contests (`data/contests.json`):**
- `name`, `total_problems` (1-15)
- `problems[]` - Array of problem stats with letters A-O
- `rank_str`, `summary`

**Solutions (`data/solutions/*.md`):**
- Stored separately as `{problem_id}.md` files
- Markdown format with code highlighting support
- `has_solution` field is computed at runtime

## Git Version Control Workflow

The `data/` directory is managed as a **separate cloned Git repository** for team collaboration:

### Architecture

- **Separate Repository**: `data/` is cloned from a remote Git repository (not a submodule of the main project)
- **Configuration Cache**: Repository URL and branch are saved in `.git_config.json` (git-ignored)
- **Auto-load**: Saved configuration is automatically loaded when opening the Git sync tab

### First-time Setup

1. User creates a remote repository on GitHub/GitLab (e.g., `https://github.com/user/acm-data.git`)
2. User enters the repository URL and branch name in the Git sync tab
3. User clicks "克隆 Data 仓库" (Clone Data Repository)
4. System clones the remote repository as the local `data/` directory
5. If `data/` already exists, it's automatically backed up to `data.backup` (or `data.backup.N`)

### Daily Workflow

- **Before work**: Click "拉取远程更新" (Pull) to sync latest changes
- **After work**: Enter commit message and click "推送到远程" (Push)
- **Multi-person collaboration**: Regular pulls prevent conflicts

### Key Functions (`git_utils.py`)

- `clone_data_repo()` - Clone remote repository as data/ directory
- `backup_existing_data()` - Backup existing data/ before cloning
- `ensure_data_repo()` - Validate data/ is cloned from correct remote
- `backup_and_reclone()` - Backup and re-clone for switching repositories
- `git_pull()` / `git_push()` - Standard Git operations in data/ directory
- `get_repo_status()` - Display current repository status
- `load_git_config()` / `save_git_config()` - Configuration persistence

### Important Notes

- The main project repository and data repository are **completely separate**
- Only `data/` directory is version-controlled by the cloned repository
- Users can switch to a different repository using "备份并重新克隆" button
- All Git operations are performed in the `data/` directory context

## Important Patterns

### Adding New Features

1. **Data Model**: Add/modify in `src/models.py`
2. **Data Operations**: Add CRUD functions in `src/data_manager.py`
3. **UI Components**: Create handlers in appropriate `src/ui/*.py` module
4. **Wire Up**: Import and use in `server.py` if needed

### Migration & Normalization

The `normalize_record()` function in `data_manager.py` handles backward compatibility:
- Legacy `status: "Done"` → `solved: true`
- Deprecated `owner` field → `assignee`
- Embedded `solution_markdown` extraction to separate files

Always run normalization on loaded data to maintain compatibility.

### Thread Safety

All file operations in `data_manager.py` use the `_lock` context manager. When adding new file operations, maintain this pattern:

```python
with _lock:
    # File I/O operations here
    pass
```

### UI Event Handlers

Gradio event handlers follow these conventions:
- Return tuples for multiple outputs: `(status_message, updated_dataframe)`
- Use `gr.State()` to track tab-specific state (filter mode, etc.)
- Table `.select()` events populate forms
- Button `.click()` events trigger actions

## Python Environment

- Python 3.13+ required (see `.python-version`)
- Package manager: `uv` (see `pyproject.toml` and `uv.lock`)
- Dependencies: gradio, pydantic, markdown, pandas
- No database - pure JSON file storage

## Development Notes

- **Module imports**: Use relative imports within `src/` package
- **No frontend files**: Gradio generates all UI from Python
- **Backup files**: Old monolithic version saved as `server.py.old`
- **Server port**: 7860 (Gradio default)
- **File corruption recovery**: Auto-backup corrupted JSON to `.backup.json`
- **Solution rendering**: Uses Python `markdown` library with extensions

## Adding New Tabs

To add a new tab to the UI:

1. Create new file in `src/ui/` (e.g., `statistics.py`)
2. Define `build_statistics_tab()` function
3. Import in `server.py`
4. Call in `build_app()` within the `with gr.Tabs():` block

Example:
```python
# src/ui/statistics.py
def build_statistics_tab():
    with gr.Tab("📊 统计"):
        # Your UI components here
        pass

# server.py
from src.ui.statistics import build_statistics_tab

def build_app():
    with gr.Blocks(...) as app:
        with gr.Tabs():
            # ... existing tabs ...
            build_statistics_tab()  # Add new tab
```

## Code Style Guidelines

- **Docstrings**: Use for all public functions
- **Type hints**: Use where helpful, especially for function parameters
- **Naming**:
  - `snake_case` for functions/variables
  - `PascalCase` for classes
  - `_private` prefix for internal functions
- **Line length**: Keep under 100 characters where reasonable
- **Imports**: Group by standard library, third-party, local modules

## Migration from Monolithic Structure

This project was refactored from a single 1100+ line `server.py` to a modular structure:
- **Before**: One massive file with all code
- **After**: Organized into logical modules
- **Benefits**: Easier navigation, better maintainability, clearer dependencies
- **Compatibility**: 100% data format compatible, all features preserved
