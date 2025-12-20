#!/bin/bash
# Stage Pi: Open source stagebox firmware
# Copyright (C) 2025 Bama Box ltd.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, version 3 of the License.

# This program is distributed in the hope that it will be useful,
#but WITHOUT ANY WARRANTY; without even the implied warranty of
#MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.

# You should have received a copy of the GNU General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== StagePi Quick Rebuild (with cache) ===${NC}"

# Step 1: Build the package
echo -e "${YELLOW}[1/4] Building StagePi package...${NC}"
./scripts/build.sh

# Step 2: Copy package to src directory for Docker build context
echo -e "${YELLOW}[2/4] Copying package to Docker build context...${NC}"
cp build/stagepi-latest.deb src/stagepi-latest.deb

# Step 3: Rebuild Docker image (with cache)
echo -e "${YELLOW}[3/4] Rebuilding Docker image...${NC}"
cd src
docker compose -f docker-compose.dev.yml build

# Step 4: Restart containers
echo -e "${YELLOW}[4/4] Restarting containers...${NC}"
docker compose -f docker-compose.dev.yml up -d

echo -e "${GREEN}=== Quick rebuild complete! ===${NC}"
echo -e "View logs with: ${BLUE}cd src && docker compose -f docker-compose.dev.yml logs -f${NC}"
