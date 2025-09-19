
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
#GNU General Public License for more details.

# You should have received a copy of the GNU General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.

set -e

# Get the short Git hash
GIT_HASH=$(git rev-parse --short HEAD)
VERSION="0.1.alpha"

# Prepare version string
VERSION_STRING="${VERSION}-${GIT_HASH}"

# Bump the package minor version
sed -E -i 's/(Version: [0-9]+\.)([0-9]+)(\.[0-9]+)/echo "\1$((\2+1))\3"/ge' src/stagepi-package/DEBIAN/control

# Update version file
echo "$VERSION_STRING" > src/stagepi-package/usr/local/stagepi/version

# Commit the version file update
# git add stagepi-package/usr/local/stagepi/version
# git commit -m "Update version file to ${VERSION_STRING}"

# Set permissions and prepare build directory
chmod 755 src/stagepi-package/DEBIAN/postinst
mkdir -p build

# Define the package name
PACKAGE_NAME="stagepi_${VERSION_STRING}_all.deb"

# Cleanup the previous package
rm -rf package
# Add base content for the package
cp -a src/stagepi-package package
mkdir -p package/usr/local/stagepi/ui
# Add the frontend
cp -a src/frontend/dist package/usr/local/stagepi/ui
# Add the backend
cp -a src/backend/api package/usr/local/stagepi/ui
cp -a src/backend/core package/usr/local/stagepi/ui
cp -a src/backend/main.py package/usr/local/stagepi/ui

# Build the package
dpkg-deb --build package "build/${PACKAGE_NAME}"

# Create symlink to latest build
cd build
[ -L stagepi-latest.deb ] && unlink stagepi-latest.deb
ln -s "$PACKAGE_NAME" stagepi-latest.deb
