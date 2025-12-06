# Code Quality & Linting Standards

## ⚡ Ruff - The Only Linter

This project uses **Ruff** exclusively for all Python code quality checks and formatting.

### Why Ruff?

- **Fast**: 10-100x faster than traditional Python tools (written in Rust)
- **All-in-One**: Replaces flake8, black, and isort with a single tool
- **Compatible**: Drop-in replacement with familiar rules and formatting
- **Modern**: Actively maintained by Astral (creators of uv)

## 📋 Quick Commands

```bash
cd src/backend

# Auto-fix everything (recommended before committing)
make format

# Check for issues without fixing
make lint

# Run tests
make test
```

## 🔧 Configuration

All Ruff settings are in [`src/backend/pyproject.toml`](../src/backend/pyproject.toml):

```toml
[tool.ruff]
line-length = 127
target-version = "py39"

[tool.ruff.lint]
select = ["E", "W", "F", "I", "C90", "UP"]

[tool.ruff.format]
quote-style = "double"
```

## 📖 Rules

### Enabled Rule Categories:
- **E** - pycodestyle errors (PEP 8 violations)
- **W** - pycodestyle warnings
- **F** - pyflakes (undefined names, unused imports, etc.)
- **I** - isort (import sorting and organization)
- **C90** - mccabe (complexity checking, max 15)
- **UP** - pyupgrade (modern Python syntax suggestions)

### Ignored Rules:
- **E501** - Line too long (handled by formatter)

## 🚫 Deprecated Tools

**DO NOT USE:**
- ❌ `black` - Replaced by `ruff format`
- ❌ `flake8` - Replaced by `ruff check`
- ❌ `isort` - Replaced by `ruff check --select I`

These tools are no longer installed and should not be added back.

## 🤖 GitHub Actions

Every pull request automatically runs:

```yaml
- name: Run linting with Ruff
  run: |
    ruff check .
    ruff format --check .
```

**PRs with linting failures will be blocked from merging.**

## 💻 Local Development Workflow

### Before Committing:

```bash
cd src/backend
make format  # Auto-fix and format
make lint    # Verify no issues remain
make test    # Run unit tests
```

### Direct Ruff Commands:

```bash
# Check for issues
ruff check .

# Auto-fix issues
ruff check --fix .

# Format code
ruff format .

# Check formatting without changing
ruff format --check .
```

## 📝 IDE Integration

### VS Code
Install the Ruff extension:
```json
{
  "recommendations": ["charliermarsh.ruff"]
}
```

Add to `.vscode/settings.json`:
```json
{
  "[python]": {
    "editor.defaultFormatter": "charliermarsh.ruff",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll": true,
      "source.organizeImports": true
    }
  }
}
```

### PyCharm / IntelliJ
1. Install Ruff plugin from marketplace
2. Enable "Ruff" in Settings → Tools → Ruff
3. Enable "Run Ruff on save"

## 🎯 Common Scenarios

### New Python File Created
```bash
make format  # Auto-formats and organizes imports
```

### Linting Errors in CI
```bash
# Run locally to see the same errors
make lint

# Fix automatically
make format

# Commit the fixes
git add .
git commit -m "fix: Apply ruff formatting"
```

### Import Organization
Ruff automatically organizes imports into three groups:
1. Standard library (e.g., `os`, `sys`)
2. Third-party (e.g., `fastapi`, `pytest`)
3. Local/first-party (e.g., `api`, `core`)

## 📚 Learn More

- [Ruff Documentation](https://docs.astral.sh/ruff/)
- [Ruff Configuration](https://docs.astral.sh/ruff/configuration/)
- [Rule Reference](https://docs.astral.sh/ruff/rules/)

## ❓ FAQ

**Q: Can I use black/flake8/isort instead?**
A: No. The project has standardized on Ruff. Adding other tools will create conflicts and is not allowed.

**Q: What if Ruff breaks my code?**
A: Ruff only formats code, it doesn't change logic. If you see unexpected behavior, it's likely revealing a pre-existing issue.

**Q: How do I ignore a specific line?**
A: Add `# noqa: <code>` at the end of the line:
```python
from gi.repository import Gst  # noqa: E402
```

**Q: Why line length 127 instead of 88?**
A: 127 characters fits perfectly in GitHub's diff view, making code reviews easier.
