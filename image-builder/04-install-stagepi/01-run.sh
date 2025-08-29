#!/bin/bash -e
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

# Copy the package from the host to a temporary location
cp files/stagepi-latest.deb ${ROOTFS_DIR}/tmp/

on_chroot << EOF
	apt install /tmp/stagepi-latest.deb -f -y
	apt install -f -y
	rm /tmp/stagepi-latest.deb
EOF


