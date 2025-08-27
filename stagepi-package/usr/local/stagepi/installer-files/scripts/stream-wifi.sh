#!/bin/bash -x
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
ADDR=$1
PORT=$2
# defualt values
#ADDR=239.69.22.10
#PORT=5004
gst-launch-1.0 -v filesrc location=output.wav \! wavparse \! audioconvert \! audioresample \! \
  audio/x-raw,format=S16BE,rate=48000,channels=2 \! \
  rtpL16pay \! \
  udpsink host=239.69.22.10 port=5004 bind-address=192.168.1.3 auto-multicast=true

