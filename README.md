
# Stage Pi: Digital Stage Box Using Raspberry Pi

## Project Description

**Stage Pi** is an open-source project dedicated to creating a versatile and affordable digital stage box solution using the power of embedded Linux.

This project aims to provide musicians, sound engineers, and live event enthusiasts with a robust, customizable, and portable system for audio routing, processing, and control in live performance environments.

Traditional stage boxes can be bulky and expensive. Stage Pi leverages the compact and cost-effective Raspberry Pi to offer a flexible alternative, enabling users to build their own digital audio network interface tailored to their specific needs.

## Features

- **Customizable Audio Routing**: Configure inputs and outputs to suit various stage setups.
- **Low-Latency Audio**: Designed for real-time audio performance.
- **Network Integration**: Connects seamlessly with digital audio consoles and other network-enabled devices (e.g., Dante, or custom protocols).
- **Compact & Portable**: Built around the small form factor of the Raspberry Pi.
- **Open Source**: Fully customizable and extensible by the community.
- **Web Interface (In Progress)**: Easy configuration and monitoring via a web browser.

## Technologies Used

### Hardware

- **Raspberry Pi** (e.g., Raspberry Pi 4 Model B)
- **HiFiBerry HATs**: High-quality audio HATs for the Raspberry Pi  
  (e.g., HiFiBerry DAC+ ADC Pro, HiFiBerry Digi+ I/O)  
  [HiFiBerry XLR Steel Case Assembly Guide](https://www.hifiberry.com/docs/hardware/assembling-the-xlr-steions
- **Ethernet and Wi-Fi Connectivity**
- **Custom Enclosure** (recommended)

### Software

- **Raspberry Pi OS**
- **ALSA** (Advanced Linux Sound Architecture)
- **JACK Audio Connection Kit** (or **PipeWire** for modern systems)
- **Custom Python Applications**: For control and routing logic
- **Network Audio Protocols**:  
  - OSC  
  - Custom UDP/TCP for control  
  - Dante (where applicable)

## Getting Started

### Prerequisites

- A Raspberry Pi (Raspberry Pi 4 recommended)
- A suitable power supply
- An SD card (4GB or larger recommended)
- A compatible HiFiBerry HAT
- Ethernet cable

### Installation

**Flash Raspberry Pi OS**: *Instructions TBD*

> Detailed instructions on configuring audio routing, connecting to a mixer, and controlling the stage box will be added as the project develops.

## Contributing

We welcome contributions from the community! If you're interested in helping improve Stage Pi, please consider:

1. Forking the repository
2. Creating a new branch for your features or bug fixes
3. Submitting a pull request with a clear description of your changes
4. Reporting bugs or suggesting new features via the Issues page

Please read our `CONTRIBUTING.md` (to be created) for more details.

## License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**.  
Any derivative works or modifications you distribute must also be licensed under the GPLv3.

## Acknowledgements

- The **Raspberry Pi Foundation** for creating such a versatile single-board computer
- The **open-source audio community** (ALSA, JACK, PipeWire) for their invaluable tools
- **HiFiBerry** for providing high-quality audio HATs for the Raspberry Pi

