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

TARGET="${TARGET:-$1}"

if [ -z "$TARGET" ]; then
  echo "Usage: TARGET=<target-host> $0 OR $0 <target-host>"
  exit 1
fi

scripts/build.sh

scp build/stagepi-latest.deb pi@"$TARGET":/tmp
ssh pi@"$TARGET" sudo apt remove stagepi -y
ssh pi@"$TARGET" sudo apt install /tmp/stagepi-latest.deb -y
ssh pi@"$TARGET" rm -f /tmp/stagepi-latest.deb
