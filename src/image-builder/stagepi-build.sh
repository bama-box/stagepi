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

# Build the Raspberry Pi Image using pi-gen
echo -e "\n--- Building Raspberry Pi Image ---"
if [ ! -d "pi-gen" ]; then
    git clone https://github.com/RPi-Distro/pi-gen.git
    cd pi-gen
    git checkout origin/arm64
else
    cd pi-gen
fi

(echo "IMG_NAME='stagepi-os'"
 echo "arm_64bit=1"
 echo "FIRST_USER_NAME=pi"
 echo "FIRST_USER_PASS=stage314"
 echo "ENABLE_SSH=1") > config

touch ./stage3/SKIP ./stage4/SKIP ./stage5/SKIP
touch ./stage3/SKIP_IMAGES ./stage4/SKIP_IMAGES ./stage5/SKIP_IMAGES


# Copy the new stage which will install our .deb package
# It's cleaner to have a dedicated stage for our custom package
# cp -rL ../04-install-stagepi stage2/

CLEAN=1 ./build-docker.sh
