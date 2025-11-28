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

echo "Running first boot tasks..."
# enable SSH
sudo raspi-config nonint do_ssh 0
# make sure we are not blocked by rfkill
sudo raspi-config nonint do_wifi_country IL

# Get MAC address of eth0
mac=$(cat /sys/class/net/eth0/address)
# Remove colons
id=$(echo "$mac" | tr -d ':')

# set hostname as stagepi
hostname="stagepi"
password="stage314"
# Set the hostname
hostnamectl set-hostname "$hostname"
sed -i "s/127.0.1.1.*/127.0.1.1 $hostname/" /etc/hosts

# need to restart for the new name get advertised
sudo systemctl restart avahi-daemon.service 
# TODO: resovle hostname conflicts
# setup wifi hotspot
sudo nmcli connection delete wlan0
sudo nmcli connection delete Hotspot
sudo nmcli -t device wifi hotspot ifname wlan0 ssid Stagepi-$id-$hostname password $password

#setup ethernet
sudo ip link set eth0 down
sudo nmcli connection delete eth0
sudo nmcli connection add type ethernet ifname eth0 con-name eth0 ip4 192.168.1.100/24 autoconnect yes
sudo nmcli connection modify eth0 ipv4.method auto
sudo nmcli connection modify eth0 ipv6.method auto
sudo nmcli connection up eth0
