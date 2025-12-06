# Copilot Instructions for StagePi

## Project Overview
StagePi is an open-source digital stage box firmware for Raspberry Pi, focused on real-time audio routing, network integration, and web-based control. It is designed for live performance environments and leverages embedded Linux, ALSA, JACK/PipeWire, and custom Python services.

## Architecture & Key Components
- **Backend (src/backend/)**: Python-based API and core managers for audio, network, and system control. Key files:
  - `api/`: FastAPI route definitions for network, services, sound hardware, and system endpoints.
  - `core/`: Manager classes for network, services, sound hardware, and system logic.
- **Frontend (src/frontend/)**: React/TypeScript web UI for configuration and monitoring. Entry: `src/frontend/src/main.tsx`.
- **Image Builder (src/image-builder/)**: Shell scripts and pi-gen integration for building deployable Raspberry Pi images. Main script: `stagepi-build.sh`.
- **Package (package/)**: Debian packaging files and install scripts for system deployment.

## Developer Workflows
- **Build Raspberry Pi Image**: Run `src/image-builder/stagepi-build.sh` to generate a custom OS image.
- **Frontend Development**:
  1. Install Node.js via nvm: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash`
  2. `nvm install --lts`
  3. `npm install` in `src/frontend/`
  4. `npm run dev` to start the web UI
- **Backend Development**:
  1. Edit Python files in `src/backend/`. API routes are defined in `api/`, logic in `core/`.
  2. Run `make format` to auto-format code with Ruff (required before committing)
  3. Run `make test` to run unit tests
  4. Run `make lint` to check for issues
- **Deployment**: Use scripts in `scripts/` and `package/` for building and deploying Debian packages.

## Patterns & Conventions
- **API Structure**: FastAPI routes are grouped by domain (network, services, sound hardware, system) and call into corresponding manager classes.
- **Manager Classes**: Each subsystem (network, service, sound hardware, system) has a dedicated manager in `core/` for separation of concerns.
- **Frontend**: Uses React with TypeScript. Components are organized in `src/frontend/src/components/`.
- **Image Building**: Relies on pi-gen scripts and custom shell scripts for reproducible OS images.
- **Wi-Fi Hotspot**: On first boot, device exposes a hotspot (`stagepi-[hostname]`) and web UI at `http://[hostname].local:8000`.
- **Code Quality**: All Python code must be formatted and linted with Ruff before committing. Run `make format` in `src/backend/` to auto-fix issues.

## Integration Points
- **Audio Hardware**: HiFiBerry HATs (DAC+ ADC Pro, Digi+ I/O) via ALSA/JACK/PipeWire.
- **Network Protocols**: OSC, custom UDP/TCP, AES67 compatibility.
- **Web UI**: Communicates with backend API for configuration and monitoring.

## Licensing
- All code is GPLv3. Any modifications must also be GPLv3.

## Code Quality & Linting

### Python Backend (src/backend/)
All Python code **must** be formatted and linted with **Ruff** before committing.

**What is Ruff?**
- Single tool that replaces flake8, black, and isort
- 10-100x faster than traditional Python tools
- Configured in `src/backend/pyproject.toml`

**Required Commands:**
```bash
cd src/backend
make format  # Auto-fix all issues and format code
make lint    # Check for remaining issues
make test    # Run unit tests
```

**Direct Ruff Usage:**
```bash
ruff check --fix .  # Auto-fix linting issues
ruff format .       # Format code
```

**Configuration:**
- Line length: 127 characters
- Target: Python 3.9+
- Rules: E (pycodestyle), W (warnings), F (pyflakes), I (import sorting), C90 (complexity)
- Config file: `src/backend/pyproject.toml`

**DO NOT use these tools (replaced by Ruff):**
- ❌ black
- ❌ flake8
- ❌ isort

**GitHub Actions:**
- All PRs automatically run `ruff check` and `ruff format --check`
- Linting failures will block merging

## Example: Adding a New API Route
1. Define route in `src/backend/api/<domain>_routes.py`.
2. Implement logic in `src/backend/core/<domain>_manager.py`.
3. Update frontend to call new API if needed.

## Example: LED Control API
- **GET `/system/led`**: Returns LED state and availability (requires Raspberry Pi GPIO).
- **PUT `/system/led?action=on|off|blink`**: Sets LED state. Returns success or error if unavailable.
- Backend logic in `system_manager.py` uses RPi.GPIO if available, otherwise returns not available.

**Note:** Hardware control features (like LED) require running on a Raspberry Pi with GPIO support. Fallbacks are handled gracefully in the API.

---
For questions about unclear workflows or missing conventions, ask for clarification or review the main `README.md`.
