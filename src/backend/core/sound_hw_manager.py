"""
Stage Pi: Open source stagebox firmware

Copyright (C) 2025 Bama Box ltd.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, version 3 of the License.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
"""

import glob
import os
import re
import subprocess


def _parse_alsa_list(output: str):
    """Parse ALSA 'aplay -l' or 'arecord -l' output and return a list of card dicts.

    Expected lines like: "card 0: PCH [HDA Intel PCH], device 0: ALC255 Analog [ALC255 Analog]"
    """
    devices = []
    card_matches = re.findall(r"^card (\d+): (.*?) \[(.*?)\], device.*", output, re.M)
    for card_num, card_name, card_id in card_matches:
        devices.append(
            {
                "card_number": int(card_num),
                "card_name": card_name.strip(),
                "card_id": card_id.strip(),
            }
        )
    return devices


def _run_cmd(cmd):
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout
    except FileNotFoundError:
        # Command (arecord/aplay) not present
        print(f"Command not found: {cmd[0]}. Returning empty list.")
        return ""
    except subprocess.CalledProcessError as e:
        print(f"Error executing {' '.join(cmd)}: {e}")
        return ""
    except Exception as e:
        print(f"Unexpected error executing {' '.join(cmd)}: {e}")
        return ""


def get_sound_outputs():
    """Return playback (output) devices using 'aplay -l'."""
    output = _run_cmd(["aplay", "-l"])
    if not output:
        return []
    return _parse_alsa_list(output)


def get_sound_inputs():
    """Return capture (input) devices using 'arecord -l'."""
    output = _run_cmd(["arecord", "-l"])
    if not output:
        return []
    return _parse_alsa_list(output)


def get_sound_hw():
    """Backward-compatible alias returning output/playback devices."""
    return get_sound_outputs()


def get_audio_topology():
    """
    Inspects system device-tree and ALSA subsystem to return full hardware audio topology:
    - Raspberry Pi model
    - Mounted HAT info (vendor, product, uuid)
    - List of audio interfaces with physical port mapping, capabilities, and primary flag.
    """
    model = "Raspberry Pi"
    if os.path.exists("/proc/device-tree/model"):
        try:
            with open("/proc/device-tree/model", "r", encoding="utf-8", errors="ignore") as f:
                model = f.read().strip().replace("\x00", "")
        except Exception:
            pass

    hat_info = {"detected": False, "vendor": None, "product": None, "name": None, "uuid": None}
    if os.path.exists("/proc/device-tree/hat"):
        try:
            vendor = ""
            product = ""
            uuid_val = ""
            v_path = "/proc/device-tree/hat/vendor"
            p_path = "/proc/device-tree/hat/product"
            u_path = "/proc/device-tree/hat/uuid"
            if os.path.exists(v_path):
                with open(v_path, "r", encoding="utf-8", errors="ignore") as f:
                    vendor = f.read().strip().replace("\x00", "")
            if os.path.exists(p_path):
                with open(p_path, "r", encoding="utf-8", errors="ignore") as f:
                    product = f.read().strip().replace("\x00", "")
            if os.path.exists(u_path):
                with open(u_path, "r", encoding="utf-8", errors="ignore") as f:
                    uuid_val = f.read().strip().replace("\x00", "")
            if vendor or product:
                full_name = f"{vendor} {product}".strip()
                hat_info = {
                    "detected": True,
                    "vendor": vendor,
                    "product": product,
                    "name": full_name,
                    "uuid": uuid_val,
                }
        except Exception as e:
            print(f"Error reading HAT device-tree: {e}")

    cards = []
    card_paths = sorted(glob.glob("/sys/class/sound/card[0-9]*"))

    if card_paths:
        for path in card_paths:
            m = re.search(r"card(\d+)", path)
            if not m:
                continue
            card_num = int(m.group(1))
            real_path = os.path.realpath(path)
            id_file = f"/proc/asound/card{card_num}/id"
            card_id = f"card{card_num}"
            if os.path.exists(id_file):
                try:
                    with open(id_file) as f:
                        card_id = f.read().strip()
                except Exception:
                    pass

            has_playback = len(glob.glob(f"{path}/pcm*p")) > 0
            has_capture = len(glob.glob(f"{path}/pcm*c")) > 0

            pcm_name = ""
            for pcm_info in [
                f"/proc/asound/card{card_num}/pcm0p/info",
                f"/proc/asound/card{card_num}/pcm0c/info",
            ]:
                if os.path.exists(pcm_info):
                    try:
                        with open(pcm_info) as f:
                            for line in f:
                                if line.startswith("name:"):
                                    pcm_name = line.split(":", 1)[1].strip()
                                    break
                    except Exception:
                        pass
                    if pcm_name:
                        break

            itype = "other"
            port = "Audio Port"
            port_id = "generic"
            hat_name = None

            id_lower = card_id.lower()
            path_lower = real_path.lower()

            if "hdmi" in id_lower or "hdmi" in path_lower:
                itype = "hdmi"
                if "hdmi0" in id_lower or "fef00700" in path_lower:
                    port = "Micro-HDMI 0"
                    port_id = "hdmi0"
                else:
                    port = "Micro-HDMI 1"
                    port_id = "hdmi1"
            elif "headphone" in id_lower or "bcm2835" in id_lower or "analog" in id_lower:
                itype = "jack"
                port = "3.5mm Analog Jack"
                port_id = "jack"
            elif "usb" in path_lower or "usb" in id_lower:
                itype = "usb"
                port = "USB Audio Port"
                port_id = "usb"
            elif any(
                k in id_lower or k in path_lower
                for k in ["sound", "rpi", "hifiberry", "i2s", "allo", "iqaudio", "dac", "adc"]
            ):
                itype = "hat"
                port = "40-Pin GPIO (I2S)"
                port_id = "gpio_hat"
                hat_name = hat_info.get("name") or pcm_name or card_id

            if itype == "hat":
                display_name = hat_info.get("name") or (pcm_name if pcm_name else card_id)
            elif itype == "jack":
                display_name = "3.5mm Analog Headphones"
            elif itype == "hdmi":
                display_name = f"HDMI Audio ({port})"
            elif itype == "usb":
                display_name = pcm_name or f"USB Audio ({card_id})"
            else:
                display_name = pcm_name or card_id

            cards.append(
                {
                    "card_number": card_num,
                    "card_id": card_id,
                    "card_name": display_name,
                    "pcm_name": pcm_name,
                    "type": itype,
                    "port": port,
                    "port_id": port_id,
                    "hat_name": hat_name,
                    "playback": has_playback,
                    "capture": has_capture,
                    "alsa_device": f"hw:{card_id}",
                    "alsa_device_idx": f"hw:{card_num}",
                    "is_primary": False,
                }
            )
    else:
        # Fallback to aplay / arecord parsing
        outputs = get_sound_outputs()
        inputs = get_sound_inputs()
        seen_nums = set()
        for d in outputs:
            cnum = d["card_number"]
            cid = d["card_id"]
            cname = d["card_name"]
            itype = "hat" if "rpi" in cid.lower() or "hifiberry" in cid.lower() else "other"
            port = "40-Pin GPIO (I2S)" if itype == "hat" else "Audio Port"
            cards.append(
                {
                    "card_number": cnum,
                    "card_id": cid,
                    "card_name": cname,
                    "pcm_name": cname,
                    "type": itype,
                    "port": port,
                    "port_id": "gpio_hat" if itype == "hat" else "generic",
                    "hat_name": hat_info.get("name") if itype == "hat" else None,
                    "playback": True,
                    "capture": False,
                    "alsa_device": f"hw:{cid}",
                    "alsa_device_idx": f"hw:{cnum}",
                    "is_primary": False,
                }
            )
            seen_nums.add(cnum)

    # Rank and designate primary interface: hat > usb > jack > hdmi > other
    type_priority = {"hat": 1, "usb": 2, "jack": 3, "hdmi": 4, "other": 5}
    if cards:
        best_card = min(cards, key=lambda c: type_priority.get(c["type"], 99))
        best_card["is_primary"] = True

    return {
        "model": model,
        "hat": hat_info,
        "interfaces": cards,
    }


if __name__ == "__main__":
    import json

    print(json.dumps(get_audio_topology(), indent=2))

