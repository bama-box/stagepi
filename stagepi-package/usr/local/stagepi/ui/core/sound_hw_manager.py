# core/sound_hw_manager.py
import subprocess
import re

def get_sound_hw():
    """
    Retrieves a list of available sound hardware (playback devices).
    """
    try:
        # Execute the aplay command to list playback hardware devices
        result = subprocess.run(['aplay', '-l'], capture_output=True, text=True, check=True)
        output = result.stdout
        
        # Process the output to create a list of sound cards
        devices = []
        # Regex to find card number and name, e.g., "card 0: PCH [HDA Intel PCH], device 0: ALC255 Analog [ALC255 Analog]"
        card_matches = re.findall(r'^card (\d+): (.*) \[(.*)\], device.*', output, re.M)
        
        for card_num, card_name, card_id in card_matches:
            devices.append({
                "card_number": int(card_num),
                "card_name": card_name.strip(),
                "card_id": card_id.strip()
            })
            
        return devices

    except FileNotFoundError:
        # This handles the case where 'aplay' is not installed or not in PATH
        print("aplay command not found. Returning empty list.")
        return []
    except subprocess.CalledProcessError as e:
        # This handles errors during the execution of the command
        print(f"Error executing aplay: {e}")
        return []
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return []

if __name__ == '__main__':
    # For testing the script directly
    sound_devices = get_sound_hw()
    if sound_devices:
        print("Available sound devices:")
        for device in sound_devices:
            print(f"  Card {device['card_number']}: {device['card_name']} ({device['card_id']})")
    else:
        print("No sound devices found or an error occurred.")
