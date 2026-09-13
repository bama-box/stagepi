# StagePi Roadmap & TODO

This document tracks planned features, architectural improvements, and pending tasks for StagePi.

---

## Audio Engine & ALSA Integration

- [ ] **Support Multi-Stream Sharing on Sound Devices (ALSA `dmix` / `dsnoop`)**
  - **Context**: Currently, StagePi uses direct ALSA hardware access (`hw:<device_name>`). The Linux ALSA kernel driver enforces strict exclusive access on `hw:` devices, returning `Device or resource busy` (`-16`) if multiple stream processes attempt to open the same physical sound card concurrently.
  - **Goal**: Allow multiple AES67 streams to share the same audio device for both playback and capture:
    - **Playback / Receivers**: Support ALSA `dmix` (or `plug:dmix:<device>`) to mix multiple incoming AES67 network streams into a single physical output/DAC.
    - **Capture / Transmitters**: Support ALSA `dsnoop` (or `plug:dsnoop:<device>`) to split a single physical input/ADC into multiple outgoing AES67 network streams.
  - **Design Considerations**:
    - Add an option in the UI / API to configure audio access mode:
      - **Exclusive Mode (`hw:`)**: Lowest possible latency, zero software mixing jitter, bit-perfect streaming (ideal for primary broadcast channels).
      - **Shared Mode (`dmix`/`dsnoop`)**: Software multiplexed, allows multiple streams per sound card with minimal buffer overhead.
    - Validate hardware capabilities (e.g. identify DAC-only boards vs. DAC+ADC boards like HiFiBerry DAC+ ADC Pro).

---

## AES67 & Network Compliance

- [ ] **PTP Clocking (IEEE 1588-2008 / PTPv2)**
  - Integrate PTP clock distribution into GStreamer AES67 pipelines (`ptp4l` / `phc2sys`).
  - Implement full AES67 clocking compliance for synchronized multi-device playback.

- [ ] **RAVENNA PTP Profile & Clock Synchronization Option**
  - **PTP Profile Selection**:
    - Support configurable PTP operational profiles via `ptp4l`:
      - **RAVENNA PTP Profile**: Standard RAVENNA parameters (Domain 0, sync interval at 8 or 16 pkt/sec, announce interval 1s, delay request mechanism E2E).
      - **AES67 Standard Profile**: IEEE 1588-2008 Annex J compliant.
      - **SMPTE ST 2059-2 Profile**: Broadcast synchronization profile (Domain 127).
      - **Default PTPv2**: Generic IEEE 1588-2008.
  - **GStreamer Pipeline Time Synchronization**:
    - Feed the PTP reference clock directly to GStreamer using `GstPtpClock` or discipline the ALSA audio clock via `phc2sys` and kernel timestamping.
    - Align RTP timestamps with PTP absolute time (TAI/epoch) to achieve sample-accurate alignment with RAVENNA and Dante AES67 devices.
  - **PTP Status Monitoring in Web UI**:
    - Display real-time PTP status in the UI (Grandmaster ID, offset from master, clock jitter, lock status: Locked / Synchronizing / Free-Running).

- [ ] **NMOS Control Plane (AMWA IS-04 & IS-05)**
  - Expand NMOS Node, Device, Source, and Flow registration (IS-04).
  - Implement dynamic connection management (IS-05) for automated routing via broadcast controllers.


---

## Web UI & Management

- [ ] **Audio Device Capability Detection**
  - Distinguish between playback-only (DAC) and capture-capable (ADC) cards in the UI stream creation modal to prevent selecting input mode on DAC-only hardware.
- [ ] **Advanced Audio Buffer & Latency Tuning**
  - Provide configurable buffer/latency presets in the stream modal (e.g. ultra-low latency, standard broadcast, high resilience).
