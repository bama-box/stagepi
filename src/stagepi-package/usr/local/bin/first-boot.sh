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

echo "Running first boot tasks..." >> /var/log/first-boot.log
# enable SSH
sudo raspi-config nonint do_ssh 0
# make sure we are not blocked by rfkill
sudo raspi-config nonint do_wifi_country IL
# set hostname as mac address of eth0
# Get MAC address of eth0
mac=$(cat /sys/class/net/eth0/address)
# Remove colons
hostname=$(echo "$mac" | tr -d ':')
# Set the hostname
hostnamectl set-hostname "$hostname"
sed -i "s/127.0.1.1.*/127.0.1.1 $hostname/" /etc/hosts

# need to restart for the new name get advertised
sudo systemctl restart avahi-daemon.service 

sudo nmcli connection delete wlan0
sudo nmcli connection delete Hotspot
sudo nmcli -t device wifi hotspot ifname wlan0 ssid Stagepi-$(hostname) password stage314

#systemctl disable first-boot.service
