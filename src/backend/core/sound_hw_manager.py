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

# core/sound_hw_manager.py
import subprocess
import re


def _parse_alsa_list(output: str):
    """Parse ALSA 'aplay -l' or 'arecord -l' output and return a list of card dicts.

    Expected lines like: "card 0: PCH [HDA Intel PCH], device 0: ALC255 Analog [ALC255 Analog]"
    """
    devices = []
    card_matches = re.findall(r'^card (\d+): (.*?) \[(.*?)\], device.*', output, re.M)
    for card_num, card_name, card_id in card_matches:
        devices.append({
            "card_number": int(card_num),
            "card_name": card_name.strip(),
            "card_id": card_id.strip()
        })
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


if __name__ == '__main__':
    # For quick local testing
    outputs = get_sound_outputs()
    inputs = get_sound_inputs()
    if outputs:
        print("Available output devices:")
        for d in outputs:
            print(f"  Card {d['card_number']}: {d['card_name']} ({d['card_id']})")
    else:
        print("No output devices found or an error occurred.")

    if inputs:
        print("Available input devices:")
        for d in inputs:
            print(f"  Card {d['card_number']}: {d['card_name']} ({d['card_id']})")
    else:
        print("No input devices found or an error occurred.")
