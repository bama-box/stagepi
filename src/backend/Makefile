# Makefile for StagePi Backend Development

.PHONY: help install install-dev test test-cov lint format clean

help:
	@echo "StagePi Backend Development Commands:"
	@echo "  make install      - Install production dependencies"
	@echo "  make install-dev  - Install development dependencies"
	@echo "  make test         - Run tests"
	@echo "  make test-cov     - Run tests with coverage report"
	@echo "  make lint         - Run linting checks with Ruff"
	@echo "  make format       - Auto-fix and format code with Ruff"
	@echo "  make clean        - Remove cache and coverage files"

install:
	pip install -r requirements.txt

install-dev:
	pip install -r requirements.txt
	pip install -r requirements-dev.txt

test:
	pytest tests/ -v

test-cov:
	pytest tests/ -v --cov=. --cov-report=html --cov-report=term-missing
	@echo "Coverage report generated in htmlcov/index.html"

lint:
	# Check for errors and style issues with ruff
	ruff check .
	# Check formatting
	ruff format --check .

format:
	# Auto-fix issues and format code with ruff
	ruff check --fix .
	ruff format .

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
