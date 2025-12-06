# Makefile for StagePi Backend Development

.PHONY: help test test-cov lint format clean deploy docker-test docker-test-build docker-shell

# Include local configuration if it exists (not tracked in git)
-include Makefile.local

help:
	@echo "StagePi Backend Development Commands:"
	@echo "  make test         - Run tests in ARM Docker container"
	@echo "  make test-cov     - Run tests with coverage in Docker"
	@echo "  make docker-shell - Open bash shell in ARM Docker container"
	@echo "  make lint         - Run linting checks in Docker"
	@echo "  make format       - Auto-fix and format code in Docker"
	@echo "  make clean        - Remove cache and coverage files"
	@echo "  make deploy       - Deploy to target (set TARGET=<ip> or define in Makefile.local)"

# All development happens in Docker
test: docker-test-build
	@docker run --rm --platform linux/arm64 -v "$$(pwd):/app:ro" stagepi-test python3 -m pytest tests/ -v

test-cov: docker-test-build
	@docker run --rm --platform linux/arm64 -v "$$(pwd):/app" stagepi-test python3 -m pytest tests/ -v --cov=. --cov-report=html --cov-report=term-missing
	@echo "Coverage report generated in htmlcov/index.html"

lint: docker-test-build
	@docker run --rm --platform linux/arm64 -v "$$(pwd):/app:ro" -e RUFF_CACHE_DIR=/tmp/ruff stagepi-test sh -c "python3 -m ruff check . && python3 -m ruff format --check ."

format: docker-test-build
	@docker run --rm --platform linux/arm64 -v "$$(pwd):/app" -e RUFF_CACHE_DIR=/tmp/ruff stagepi-test sh -c "python3 -m ruff check --fix . && python3 -m ruff format ."

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	rm -rf .pytest_cache
	rm -rf .coverage
	rm -rf htmlcov
	rm -rf coverage.xml
	@echo "Cleaned up cache and coverage files"

deploy:
	@cd ../.. && ./scripts/deploy.sh

deploy-prod:
	@cd ../.. && TARGET=$(TARGET) ./scripts/deploy.sh

# Docker-based testing (with ARM emulation and GStreamer)
docker-test-build:
	@echo "Building ARM Docker test environment..."
	@docker build --platform linux/arm64 -t stagepi-test -f Dockerfile.dev .

docker-test: docker-test-build
	@echo "Running tests in ARM Docker container..."
	@docker run --rm --platform linux/arm64 -v "$$(pwd):/app:ro" stagepi-test python3 -m pytest tests/ -v

docker-shell: docker-test-build
	@echo "Opening shell in ARM Docker container..."
	@echo "Run: uvicorn main:app --reload --host 0.0.0.0 --port 8000"
	@docker run --rm -it --platform linux/arm64 -v "$$(pwd):/app" -p 8000:8000 stagepi-test /bin/bash
