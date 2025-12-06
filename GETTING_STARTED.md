# StagePi Development - Getting Started

## Prerequisites

- Docker Desktop (with ARM64 emulation support)
- Node.js and npm (for frontend development)
- Git

## Development Philosophy

StagePi uses **Docker ARM64 containers** for all backend development and testing. This ensures:
- ✅ Exact match with Raspberry Pi environment
- ✅ All GStreamer dependencies available
- ✅ No local Python environment conflicts
- ✅ Consistent development across all machines

The Raspberry Pi uses **Debian system packages only** - no pip, no virtual environments.

## First Time Setup

### 1. Enable Docker ARM64 Emulation

Docker Desktop includes ARM64 emulation by default. Verify it's working:

```bash
docker run --rm --platform linux/arm64 debian:bookworm-slim uname -m
# Should output: aarch64
```

### 2. Build the Development Container

```bash
cd src/backend
make docker-test-build
```

This builds an ARM64 container with all dependencies. **First build takes 5-10 minutes**, then cached.

### 3. Install Frontend Dependencies

```bash
cd src/frontend
npm install
```

## Development Workflow

### Backend Development

All backend work happens in the Docker ARM container:

```bash
cd src/backend

# Run tests
make test

# Run tests with coverage
make test-cov

# Format code
make format

# Lint code
make lint

# Open interactive shell for development
make docker-shell
```

### Inside the Docker Shell

When you run `make docker-shell`, you get a bash prompt in the ARM container:

```bash
# Run the backend server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Run specific tests
python3 -m pytest tests/test_network_routes.py -v

# Check GStreamer
python3 -c "import gi; gi.require_version('Gst', '1.0'); from gi.repository import Gst; print('OK')"

# Edit files (changes persist to host via volume mount)
vim api/network_routes.py
```

### Frontend Development

Frontend development uses the standard Node.js workflow:

```bash
cd src/frontend

# Start dev server
npm run dev

# Build for production
npm run build
```

Frontend dev server runs at: http://localhost:5173
Backend API at: http://localhost:8000
API docs at: http://localhost:8000/docs

## Building and Deployment

### Build the .deb Package

```bash
# From project root
./scripts/build.sh
```

This creates `build/stagepi-latest.deb` containing:
- Frontend build
- Backend Python code
- All configuration files

### Deploy to Raspberry Pi

First, configure your Pi IP in `src/backend/Makefile.local`:

```bash
# Create local config (not tracked in git)
echo "TARGET = 192.168.1.100" > src/backend/Makefile.local
```

Then deploy:

```bash
cd src/backend

# Deploy to configured Pi
make deploy-prod

# Or deploy to a specific IP
make deploy TARGET=192.168.1.50
```

Deployment process:
1. Builds the .deb package
2. Copies to Raspberry Pi via SCP
3. Installs via apt
4. Restarts services

## Project Structure

```
stagepi/
├── src/
│   ├── backend/              # FastAPI backend
│   │   ├── api/              # API route handlers
│   │   ├── core/             # Business logic
│   │   ├── tests/            # Test suite
│   │   ├── main.py           # FastAPI entry point
│   │   ├── Makefile          # Development commands
│   │   ├── Dockerfile.dev    # ARM64 dev container (not tracked)
│   │   └── Makefile.local    # Local config (not tracked)
│   │
│   ├── frontend/             # React/Preact UI
│   │   ├── src/
│   │   └── package.json
│   │
│   └── stagepi-package/      # Debian package structure
│       ├── DEBIAN/control    # Package dependencies
│       ├── DEBIAN/postinst   # Post-install script
│       └── usr/              # Files to install on Pi
│
│
└── scripts/
    ├── build.sh              # Build .deb package
    └── deploy.sh             # Deploy to Pi
```

## Common Tasks

### Running Tests

```bash
cd src/backend
make test              # Run all tests
make test-cov          # Run with coverage report
```

### Code Quality

```bash
cd src/backend
make format            # Auto-format with Ruff
make lint              # Check code quality
```

### Development Shell

```bash
cd src/backend
make docker-shell      # Open interactive ARM64 shell
```

Inside the shell:
- Edit files with vim
- Run uvicorn for development
- Execute Python commands
- Debug with pdb
- All changes sync back to your host machine

### Deployment

```bash
cd src/backend
make deploy-prod       # Deploy to configured Pi
```

## Testing Strategy

1. **Unit Tests (Docker)**: `make test`
   - Fast feedback loop
   - Full GStreamer support
   - Matches Pi environment

2. **Integration Tests (Raspberry Pi)**: `make deploy-prod`
   - Test on real hardware
   - Verify audio routing
   - Check network interfaces

## Troubleshooting

### Docker ARM64 Slow Performance

ARM64 emulation is slower than native. This is normal. First build takes ~5-10 minutes, but:
- Subsequent builds use cache (seconds)
- Running tests is reasonably fast
- Interactive shell is responsive

### Permission Errors

The Docker container runs as root. File ownership shouldn't be an issue as volumes are mounted with proper permissions.

### Port Conflicts

If ports 8000 or 5173 are in use:
- Backend: Change port in uvicorn command
- Frontend: Change port in `vite.config.ts`

### Frontend Can't Connect to Backend

Check CORS origins in [src/backend/main.py](src/backend/main.py). Add your frontend URL to the `origins` list.

## Quick Reference

| Task | Command |
|------|---------|
| Build Docker image | `cd src/backend && make docker-test-build` |
| Run tests | `cd src/backend && make test` |
| Run tests (coverage) | `cd src/backend && make test-cov` |
| Format code | `cd src/backend && make format` |
| Lint code | `cd src/backend && make lint` |
| Development shell | `cd src/backend && make docker-shell` |
| Run backend | Inside docker-shell: `uvicorn main:app --reload` |
| Run frontend | `cd src/frontend && npm run dev` |
| Build package | `./scripts/build.sh` |
| Deploy to Pi | `cd src/backend && make deploy-prod` |

## Next Steps

- Explore the API: http://localhost:8000/docs
- Check frontend code: `src/frontend/src/`
- Read backend code: `src/backend/api/`
- Run tests to understand the codebase
- Deploy to your Raspberry Pi and test!
