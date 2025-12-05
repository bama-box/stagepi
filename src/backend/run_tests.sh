#!/bin/bash
# Quick script to run tests for StagePi backend

set -e

echo "========================================="
echo "StagePi Backend Test Runner"
echo "========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "pytest.ini" ]; then
    echo "Error: Please run this script from src/backend directory"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ] && [ ! -d ".venv" ]; then
    echo "No virtual environment found. Creating one..."
    python3 -m venv venv
    echo "Virtual environment created in ./venv"
fi

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Install dependencies
echo "Installing dependencies..."
pip install -q -r requirements-dev.txt

echo ""
echo "Running tests..."
echo "========================================="
echo ""

# Run tests with coverage
pytest tests/ -v --cov=. --cov-report=term-missing --cov-report=html

echo ""
echo "========================================="
echo "Tests completed!"
echo "Coverage report available at: htmlcov/index.html"
echo "========================================="
