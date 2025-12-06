# Testing Guide for StagePi Backend

This guide explains how to run tests for the StagePi backend both locally and on GitHub.

## Table of Contents

- [Local Testing](#local-testing)
- [GitHub Actions CI/CD](#github-actions-cicd)
- [Writing Tests](#writing-tests)
- [Code Coverage](#code-coverage)

## Local Testing

### Prerequisites

1. **Install Python dependencies:**
   ```bash
   cd src/backend
   pip install -r requirements-dev.txt
   ```

2. **Install GStreamer (if testing locally with actual streams):**
   ```bash
   sudo apt-get install \
     gstreamer1.0-tools \
     gstreamer1.0-plugins-base \
     gstreamer1.0-plugins-good \
     python3-gi
   ```

### Running Tests

#### Quick Test Run
```bash
cd src/backend
pytest
```

#### Verbose Output
```bash
pytest -v
```

#### Run Specific Test File
```bash
pytest tests/test_streams_routes.py
```

#### Run Specific Test Function
```bash
pytest tests/test_streams_routes.py::TestStreamsAPI::test_add_stream
```

#### Run with Coverage
```bash
pytest --cov=. --cov-report=html --cov-report=term-missing
```

This generates an HTML coverage report in `htmlcov/index.html`.

### Using Makefile (Recommended)

We provide a Makefile for common tasks:

```bash
# Install development dependencies
make install-dev

# Run all tests
make test

# Run tests with coverage report
make test-cov

# Run linting checks
make lint

# Format code automatically
make format

# Clean up cache files
make clean
```

## GitHub Actions CI/CD

Tests run automatically on GitHub when you:
- Push to `main` or `develop` branches
- Create a pull request to `main` or `develop`
- Modify files in `src/backend/`

### Workflow Features

The GitHub Actions workflow (`.github/workflows/backend-tests.yml`) includes:

1. **Multi-Python Version Testing**
   - Tests run on Python 3.9, 3.10, and 3.11
   - Ensures compatibility across versions

2. **Automated Checks**
   - Unit tests with pytest
   - Code linting and formatting with Ruff (replaces flake8, black, isort)
   - Coverage reporting

3. **Coverage Integration**
   - Uploads coverage to Codecov
   - Displays coverage summary in PR comments

### Viewing Test Results

1. Go to your repository on GitHub
2. Click on the "Actions" tab
3. Select the workflow run you want to view
4. Click on individual jobs to see detailed logs

### Status Badges

Add these badges to your README to show build status:

```markdown
![Backend Tests](https://github.com/YOUR_USERNAME/stagepi/workflows/Backend%20Tests/badge.svg)
[![codecov](https://codecov.io/gh/YOUR_USERNAME/stagepi/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_USERNAME/stagepi)
```

## Writing Tests

### Test Structure

Tests are located in `src/backend/tests/` and follow this structure:

```
tests/
├── __init__.py
├── test_streams_routes.py     # API route tests
└── test_stream_manager.py     # Core logic tests (to be added)
```

### Test Naming Conventions

- Test files: `test_*.py`
- Test classes: `Test*`
- Test functions: `test_*`

### Example Test

```python
def test_add_stream_with_custom_format(client, mock_stream_file):
    """Test adding a stream with custom audio format."""
    mock_stream_file.write_text('{"streams": []}')

    new_stream = {
        "kind": "sender",
        "ip": "239.69.0.2",
        "port": 5006,
        "device": "hw:1,0",
        "iface": "eth0",
        "format": "S16LE",
    }

    response = client.post("/streams", json=new_stream)
    assert response.status_code == 200
    data = response.json()
    assert data['streams'][0]['format'] == 'S16LE'
```

### Fixtures

Common fixtures are defined in test files:

- `client`: FastAPI test client
- `mock_gstreamer`: Mocks GStreamer to avoid actual stream creation
- `mock_stream_file`: Provides a temporary config file for testing

### Test Markers

Use markers to categorize tests:

```python
@pytest.mark.unit
def test_something():
    pass

@pytest.mark.integration
def test_integration():
    pass

@pytest.mark.slow
def test_slow_operation():
    pass
```

Run specific marker:
```bash
pytest -m unit
```

## Code Coverage

### Understanding Coverage Reports

After running `pytest --cov`, you'll see:

```
Name                              Stmts   Miss  Cover   Missing
---------------------------------------------------------------
api/streams_routes.py                45      2    96%   89-90
core/stream_manager.py              120     15    88%   45-47, 102-105
---------------------------------------------------------------
TOTAL                               450     25    94%
```

### Coverage Goals

- Aim for at least 80% code coverage
- Critical paths (API routes, core logic) should have 90%+ coverage
- 100% coverage is ideal but not always practical

### Viewing HTML Coverage Report

After running `make test-cov` or `pytest --cov --cov-report=html`:

1. Open `htmlcov/index.html` in your browser
2. Click on files to see line-by-line coverage
3. Red lines = not covered by tests
4. Green lines = covered by tests

## Continuous Integration Best Practices

1. **Run tests before pushing:**
   ```bash
   make test && make lint
   ```

2. **Keep tests fast:** Mock external dependencies (GStreamer, file I/O)

3. **Test edge cases:** Empty inputs, invalid data, errors

4. **Update tests when adding features:** New features should include tests

5. **Fix failing tests immediately:** Don't let broken tests accumulate

## Troubleshooting

### Tests fail locally but pass on GitHub (or vice versa)

- Check Python version differences
- Verify all dependencies are installed
- Check for system-specific paths or configurations

### Import errors

- Ensure you're in the correct directory (`src/backend`)
- Check that `__init__.py` files exist
- Verify PYTHONPATH includes the backend directory

### GStreamer errors during tests

- Tests should mock GStreamer by default
- Check that `mock_gstreamer` fixture is being used
- If you need real GStreamer, install system dependencies

### Coverage not updating

- Clear cache: `make clean`
- Re-run with: `pytest --cov --cov-report=html`
- Check `.coveragerc` configuration

## Additional Resources

- [pytest documentation](https://docs.pytest.org/)
- [FastAPI testing guide](https://fastapi.tiangolo.com/tutorial/testing/)
- [GitHub Actions documentation](https://docs.github.com/en/actions)
- [Codecov documentation](https://docs.codecov.com/)
