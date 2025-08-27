#!/bin/bash
# Get the short Git hash
GIT_HASH=$(git rev-parse --short HEAD)
chmod 755 stagepi-package/DEBIAN/postinst
mkdir -p build

# Define the package name
PACKAGE_NAME="stagepi_1.0-${GIT_HASH}_arm64.deb"

# Build the package with the Git hash in the name
dpkg-deb --build stagepi-package build/"$PACKAGE_NAME"
cd build
unlink stagepi-latest.deb
ln -s "$PACKAGE_NAME" stagepi-latest.deb 
