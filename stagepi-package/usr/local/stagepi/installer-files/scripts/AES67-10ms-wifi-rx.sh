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

ADDR=${1:-"239.69.22.10"}
PORT=${2:-"5004"}
HW_DEVICE=${3:-"hw:sndrpihifiberry"}
NET_DEVICE=${4:"wlan0"}

GST_DEBUG=alsasink:4,rtpjitterbuffer:4 gst-launch-1.0 -v   udpsrc address=$ADDR port=$PORT buffer-size=2097152 multicast-iface=$NET_DEVICE caps="application/x-rtp, media=audio, encoding-name=L16, payload=96, clock-rate=48000, channels=2" !   rtpjitterbuffer latency=10 drop-on-latency=true do-lost=true ! rtpL16depay ! audioconvert !  alsasink device=$HW_DEVICE sync=false buffer-time=50000 latency-time=10000
