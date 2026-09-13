# StagePi Agent Guidelines & Hardware Insights

This file contains critical context, operational rules, and architecture insights for AI assistants working on the StagePi codebase.

---

## 1. Safety & Remote Hardware Rules

* **CRITICAL - DO NOT Sever the Network Connection:**
  * The Raspberry Pi is frequently connected directly to the development machine over Ethernet (e.g. static link `10.42.10.2`) without an external DHCP server.
  * **NEVER** run commands or scripts that modify, reset, or bring down active network interfaces (such as `reset_ethernet_config()`, `nmcli connection up eth0` with DHCP, or `ip link set eth0 down`) without explicit user permission.
  * Switching `eth0` to DHCP/auto on a direct-cable connection causes the Pi to drop its static IP and wait for a DHCP server that does not exist, severing SSH and locking the host out.
* **Testing on Target Hardware:**
  * When testing Python backend logic locally or on the target, test pure functions or mock system calls where possible.
  * Never alter network configuration via automated commands unless explicitly requested by the user.

---

## 2. Network Manager & System Integration

* **NetworkManager (`nmcli`):**
  * `_run_nmcli_command()` in `src/backend/core/network_manager.py` already includes `sudo nmcli -t` in its base command.
  * **Do not** pass `-t` or `--terse` in the command arguments passed to `_run_nmcli_command()`. Passing it again causes `Error: Option '--terse' is specified the second time` and fails the command.
* **Handling Multiple IP Addresses:**
  * Devices with `dhcpcd` or link-local enabled may have multiple IP addresses on `eth0` (e.g. configured IP `10.42.10.2` and link-local `169.254.x.x`).
  * Always prioritize the configured IP address in the connection profile (`ipv4.addresses`) for static setups, and filter out `169.254.x.x` addresses when reading DHCP assignments unless link-local is the only address available.
* **Gateway & DNS Nuances:**
  * Gateway is often empty on direct point-to-point cables. Treat `gateway` as optional in both Pydantic models and nmcli invocations.
  * Always clean and sanitize DNS inputs. Stripping and filtering empty strings (`""`) is mandatory before passing them to nmcli, otherwise nmcli will reject the command as invalid IP syntax.
* **Subnet Mask Formatting:**
  * Support both standard dotted-decimal subnet masks (e.g., `255.255.255.0`) and CIDR notation (e.g., `24` or `/24`).

---

## 3. API & Frontend Architecture

* **Backend Routing (`src/backend/main.py`):**
  * All API routers are mounted under the `/api` prefix:
    * `/api/network` -> `network_routes.router`
    * `/api/system` -> `system_routes.router`
    * `/api/services` -> `services_routes.router`
    * `/api/sound` -> `sound_hw_routes.router`
    * `/api/streams` -> `streams_routes.router`
  * The SPA catch-all route `/{full_path:path}` serves `dist/index.html` for **GET** requests only. Any non-GET requests to unmapped URLs (e.g. `PUT /network/...` instead of `PUT /api/network/...`) return `405 Method Not Allowed`.
* **Frontend Fetch Requests (`src/frontend/`):**
  * `API_BASE_URL` is defined in `src/frontend/src/config.ts` (set to `'/api'`).
  * **Every API call from the frontend must prepend `${API_BASE_URL}`**.
  * Never hardcode root-relative API URLs like `fetch('/network/config/ethernet')`.

---

## 4. Build & Deployment Workflow

* **Building:**
  ```bash
  ./scripts/build.sh
  ```
  This builds the frontend bundle, packages backend and frontend files into `package/`, and produces `build/stagepi-latest.deb`.
* **Deploying:**
  ```bash
  # Deploy to target defined in src/backend/Makefile.local
  ./scripts/deploy.sh

  # Or deploy to specific IP
  TARGET=10.42.10.2 ./scripts/deploy.sh
  ```
* **Services on Target:**
  * Supervised by `supervisord` (`/etc/supervisor/conf.d/stagepi.conf`) or `stagepi-ui.service`.
  * Web backend runs via `uvicorn main:app --host 0.0.0.0 --port 80` from `/usr/local/stagepi/ui`.
  * Binding to port 80 as unprivileged user `pi` is enabled via `net.ipv4.ip_unprivileged_port_start = 80` in `/etc/sysctl.d/99-stagepi.conf` and `AmbientCapabilities=CAP_NET_BIND_SERVICE`.
