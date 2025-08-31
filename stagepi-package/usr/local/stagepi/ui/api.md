### API Endpoints

| Method  | Endpoint                            | Description                                        |
| :------ | :---------------------------------- | :------------------------------------------------- |
| `GET`   | `/system/status`                    | Get the device's high-level status and ID.         |
| `GET`   | `/system/resources`                 | Retrieves a real-time resource utilization        |
| `GET`   | `/system/config/network`            | Get all network settings (Ethernet and Wi-Fi).     |
| `GET`   | `/system/config/network/ethernet`   | Get only the Ethernet settings.                    |
| `PUT`   | `/system/config/network/ethernet`   | **Configure** the Ethernet interface.              |
| `DELETE`| `/system/config/network/ethernet`   | **Reset** the Ethernet config to its default (DHCP).|
| `GET`   | `/system/config/network/wifi`       | Get only the Wi-Fi settings.                       |
| `PUT`   | `/system/config/network/wifi`       | **Configure** the Wi-Fi interface.                 |
| `DELETE`| `/system/config/network/wifi`       | **Forget** the saved Wi-Fi network credentials.    |
| `GET`   | `/network/wifi/available`           | **Scan** for available Wi-Fi networks in the area. |
| `GET`   | `/services`                         | List all available services and their current state. |
| `GET`   | `/services/{serviceName}`           | Get the status of one specific service.            |
| `PATCH` | `/services/{serviceName}`           | **Enable or disable** a specific service.          |



### `GET /system/status`

Retrieves a high-level, real-time snapshot of the device's identity and operational health.

---

#### Request

-   **Parameters:** None
-   **Body:** None

---

#### Response

* **Success Response (`200 OK`)**

    Returns a JSON object containing the current system state.

    **Example Body:**
    ```json
    {
      "deviceId": "a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8",
      "hostname": "LivingRoomPi",
      "status": "configured",
      "ipAddress": "192.168.1.11",
      "uptime": 172800,
      "firmwareVersion": "1.2.0",
      "timestamp": "2025-08-29T12:05:00Z"
    }
    ```

    **Response Fields:**

| Field             | Type      | Description                                                                 |
| :---------------- | :-------- | :-------------------------------------------------------------------------- |
| `deviceId`        | `String`  | The unique, persistent identifier (UUID) of the device.                     |
| `hostname`        | `String`  | The network name of the device.                                             |
| `status`          | `String`  | The configuration status: `"configured"` or `"unconfigured"`.               |
| `ipAddress`       | `String`  | The primary IP address the device is currently using.                       |
| `uptime`          | `Integer` | The number of seconds the device has been running since its last boot.      |
| `firmwareVersion` | `String`  | The current software/firmware version.                                      |
| `timestamp`       | `String`  | The current UTC time on the device in ISO 8601 format.                      |

* **Error Response (`500 Internal Server Error`)**

    Returned if the server fails to retrieve the system status.

    **Example Body:**
    ```json
    {
      "error": "Failed to retrieve system status due to an internal issue."
    }
    ```

### `GET /system/resources`

Retrieves a real-time snapshot of the device's core resource utilization, including CPU, memory, disk usage, and uptime.

---

#### Request

-   **Parameters:** None
-   **Body:** None

---

#### Response

* **Success Response (`200 OK`)**

    Returns a single JSON object containing the current resource metrics.

    **Example Body:**
    ```json
    {
      "cpu": {
        "usage": 15.5,
        "temperature": {
          "value": 45.2,
          "unit": "celsius"
        }
      },
      "memory": {
        "total": 3952,
        "used": 1250,
        "unit": "MB"
      },
      "disk": {
        "total": 29,
        "used": 11,
        "usage": 37.9,
        "unit": "GB"
      },
      "uptime": 182305
    }
    ```

    **Response Fields:**

| Field               | Type     | Description                                                          |
| :------------------ | :------- | :------------------------------------------------------------------- |
| `cpu`               | `Object` | Contains all CPU-related metrics.                                    |
| `cpu.usage`         | `Number` | Current CPU load as a percentage (e.g., 15.5).                       |
| `cpu.temperature`   | `Object` | Contains the CPU temperature reading.                                |
| `cpu.temperature.value`| `Number`| The temperature value.                                               |
| `cpu.temperature.unit` | `String`| The unit of temperature (e.g., "celsius").                           |
| `memory`            | `Object` | Contains all memory (RAM) usage metrics.                             |
| `memory.total`      | `Integer`| Total physical RAM available.                                        |
| `memory.used`       | `Integer`| Currently used RAM.                                                  |
| `memory.unit`       | `String` | The unit for memory values (e.g., "MB").                             |
| `disk`              | `Object` | Contains metrics for the primary storage partition.                  |
| `disk.total`        | `Integer`| Total disk space.                                                    |
| `disk.used`         | `Integer`| Used disk space.                                                     |
| `disk.usage`        | `Number` | Disk usage as a percentage (e.g., 37.9).                             |
| `disk.unit`         | `String` | The unit for disk values (e.g., "GB").                               |
| `uptime`            | `Integer`| The total number of seconds the device has been running.             |


* **Error Response (`500 Internal Server Error`)**

    Returned if the server fails to read the system resource data.

    **Example Body:**
    ```json
    {
      "error": "Failed to retrieve system resource data."
    }
    ```
### `/system/config/network/ethernet`

This endpoint manages the configuration of the wired Ethernet interface.

---

#### `GET`
Retrieves the current Ethernet configuration.

* **Request**
    * **Parameters:** None
    * **Body:** None

* **Response (`200 OK`)**
    Returns a JSON object with the current settings.

    **Example Body (DHCP):**
    ```json
    {
      "mode": "dhcp",
      "ipAddress": "192.168.1.10",
      "subnetMask": "255.255.255.0",
      "gateway": "192.168.1.1",
      "dnsServers": [
        "192.168.1.1"
      ]
    }
    ```

    **Example Body (Static):**
    ```json
    {
      "mode": "static",
      "ipAddress": "192.168.1.50",
      "subnetMask": "255.255.255.0",
      "gateway": "192.168.1.1",
      "dnsServers": [
        "8.8.8.8",
        "1.1.1.1"
      ]
    }
    ```

---

#### `PUT`
Sets or updates the Ethernet configuration. The provided JSON body will completely replace the existing configuration.

* **Request**
    The request body must contain a JSON object specifying the new configuration.

    **Request Body Fields:**

| Field        | Type            | Required?                                | Description                                     |
| :----------- | :-------------- | :--------------------------------------- | :---------------------------------------------- |
| `mode`       | `String`        | **Yes** | Configuration mode: `"dhcp"` or `"static"`.     |
| `ipAddress`  | `String`        | If `mode` is `"static"`                  | The static IPv4 address.                        |
| `subnetMask` | `String`        | If `mode` is `"static"`                  | The subnet mask.                                |
| `gateway`    | `String`        | If `mode` is `"static"`                  | The default gateway address.                    |
| `dnsServers` | `Array<String>` | No                                       | An array of DNS server IP addresses.            |


    **Example Body (to set Static IP):**
    ```json
    {
      "mode": "static",
      "ipAddress": "192.168.1.50",
      "subnetMask": "255.255.255.0",
      "gateway": "192.168.1.1",
      "dnsServers": ["8.8.8.8"]
    }
    ```

    **Example Body (to set DHCP):**
    ```json
    {
      "mode": "dhcp"
    }
    ```
* **Response (`200 OK`)**
    Returns the newly applied configuration object.

* **Error Response (`400 Bad Request`)**
    Returned if the request body is invalid (e.g., `mode` is "static" but `ipAddress` is missing).
    ```json
    {
      "error": "ipAddress is required for static mode."
    }
    ```

---

#### `DELETE`
Resets the Ethernet configuration to its default state (DHCP).

* **Request**
    * **Parameters:** None
    * **Body:** None

* **Response (`200 OK`)**
    Returns the configuration object after it has been reset, confirming the new state.

    **Example Body:**
    ```json
    {
      "mode": "dhcp",
      "ipAddress": null,
      "subnetMask": null,
      "gateway": null,
      "dnsServers": []
    }
    ```

### `/system/config/network/wifi`

Manages the configuration of the wireless interface, including its operational mode as a **Client** or an **Access Point (AP)**.

---

#### `GET`
Retrieves the current Wi-Fi configuration, including its mode and the relevant settings for that mode.

* **Response (`200 OK`)**
    The response structure changes based on the `deviceMode`.

    **Example Body (Client Mode):**
    ```json
    {
      "deviceMode": "client",
      "clientConfig": {
        "connected": true,
        "ssid": "MyHomeNetwork",
        "ipAddress": "192.168.1.11",
        "mode": "dhcp"
      },
      "apConfig": null
    }
    ```

    **Example Body (AP Mode):**
    ```json
    {
      "deviceMode": "ap",
      "clientConfig": null,
      "apConfig": {
        "active": true,
        "ssid": "RaspberryPi-AP",
        "channel": 11,
        "ipAddress": "10.0.0.1"
      }
    }
    ```

---

#### `PUT`
Configures the Wi-Fi interface for a specific mode. The request body must specify the `deviceMode` and include the corresponding configuration object (`clientConfig` or `apConfig`).

* **Request Body Fields:**

| Field          | Type     | Required? | Description                                                                |
|:---------------|:---------|:----------|:---------------------------------------------------------------------------|
| `deviceMode`   | `String` | **Yes** | The operational mode: `"client"` or `"ap"`.                                |
| `clientConfig` | `Object` | If `deviceMode` is `"client"` | An object containing the settings for connecting to a network. See below.  |
| `apConfig`     | `Object` | If `deviceMode` is `"ap"`     | An object containing the settings for creating a network. See below.     |


    * **Fields for `clientConfig`**

| Field      | Type   | Required? | Description                                                                |
|:-----------|:-------|:----------|:---------------------------------------------------------------------------|
| `ssid`     | `String` | **Yes** | The SSID of the network to connect to.                                       |
| `password` | `String` | **Yes** | The password for the network.                                              |
| `mode`     | `String` | No        | IP mode: `"dhcp"` (default) or `"static"`. Static IP settings are not shown. |

    * **Fields for `apConfig`**

| Field      | Type      | Required? | Description                                                            |
|:-----------|:----------|:----------|:-----------------------------------------------------------------------|
| `ssid`     | `String`  | **Yes** | The SSID of the network you want to create.                            |
| `password` | `String`  | **Yes** | The password for your new network (must be 8+ characters).             |
| `channel`  | `Integer` | No        | The Wi-Fi channel to use (e.g., 1, 6, 11). Defaults to a common value. |

    **Example Body (to set Client Mode):**
    ```json
    {
      "deviceMode": "client",
      "clientConfig": {
        "ssid": "MyHomeNetwork",
        "password": "super-secret-password"
      }
    }
    ```

    **Example Body (to set AP Mode):**
    ```json
    {
      "deviceMode": "ap",
      "apConfig": {
        "ssid": "RaspberryPi-AP",
        "password": "a-new-secure-password"
      }
    }
    ```
* **Response (`200 OK`)**
    Returns the newly applied configuration object.

* **Error Response (`400 Bad Request`)**
    Returned if the request body is invalid (e.g., `deviceMode` is "ap" but `apConfig` object is missing).
    ```json
    {
      "error": "apConfig is required when deviceMode is 'ap'."
    }
    ```

---

#### `DELETE`
Resets the entire Wi-Fi configuration to a default, inactive state. This will disconnect from any client network and shut down the Access Point if active.

* **Response (`200 OK`)**
    Returns a cleared configuration object, confirming the reset.

    **Example Body:**
    ```json
    {
      "deviceMode": "client",
      "clientConfig": {
        "connected": false,
        "ssid": null,
        "ipAddress": null,
        "mode": "dhcp"
      },
      "apConfig": null
    }
    ```

### `GET /network/wifi/available`

Performs a scan and returns a list of all available Wi-Fi networks detected in the immediate vicinity.

---

#### Request

-   **Parameters:** None
-   **Body:** None

---

#### Response

* **Success Response (`200 OK`)**

    Returns a JSON array where each object represents a single discovered network. The list is typically sorted from strongest to weakest signal.

    **Example Body:**
    ```json
    [
      {
        "ssid": "MyHomeNetwork",
        "signalStrength": -55,
        "security": "WPA3"
      },
      {
        "ssid": "NeighborsWifi-5G",
        "signalStrength": -78,
        "security": "WPA2"
      },
      {
        "ssid": "Public_Free_Wifi",
        "signalStrength": -85,
        "security": "Open"
      }
    ]
    ```

    **Response Fields:**

| Field            | Type      | Description                                                                          |
| :--------------- | :-------- | :----------------------------------------------------------------------------------- |
| `ssid`           | `String`  | The name (SSID) of the Wi-Fi network.                                                |
| `signalStrength` | `Integer` | The signal strength of the network in dBm (decibel-milliwatts). A higher number (closer to 0) is better. |
| `security`       | `String`  | The security protocol used by the network (e.g., "WPA3", "WPA2", "WEP", "Open").     |

* **Error Response (`500 Internal Server Error`)**

    Returned if the device's Wi-Fi hardware fails to perform the scan.

    **Example Body:**
    ```json
    {
      "error": "Failed to scan for Wi-Fi networks."
    }
    ```

### `/services`

This resource allows for the discovery and management of controllable services running on the device.

---

#### `GET /services`
Retrieves a list of all available services and their current status.

* **Request**
    * **Parameters:** None
    * **Body:** None

* **Response (`200 OK`)**
    Returns a JSON array where each object represents a single manageable service.

    **Example Body:**
    ```json
    [
      {
        "name": "bluetooth",
        "description": "Manages the Bluetooth radio and device visibility.",
        "enabled": true
      },
      {
        "name": "a2dp",
        "description": "Enables the high-quality audio streaming profile (A2DP Sink).",
        "enabled": true
      },
      {
        "name": "airplay",
        "description": "Enables the AirPlay audio streaming service.",
        "enabled": false
      },
      {
        "name": "aes",
        "description": "Enables AES67 audio over IP streaming.",
        "enabled": true
      }
    ]
    ```

    **Object Fields:**

| Field         | Type      | Description                                                    |
| :------------ | :-------- | :------------------------------------------------------------- |
| `name`        | `String`  | The unique, machine-readable name of the service.              |
| `description` | `String`  | A human-friendly description of what the service does.         |
| `enabled`     | `Boolean` | The current status of the service (`true`=on, `false`=off). |

---

#### `GET /services/{serviceName}`
Retrieves the status of a single, specific service.

* **Request**
    * **URL Parameter:** `serviceName` (e.g., `bluetooth`) - The unique name of the service.

* **Response (`200 OK`)**
    Returns a single service object.

    **Example Body:**
    ```json
    {
      "name": "bluetooth",
      "description": "Manages the Bluetooth radio and device visibility.",
      "enabled": true
    }
    ```

* **Error Response (`404 Not Found`)**
    Returned if the `serviceName` does not exist.
    ```json
    {
      "error": "Service 'non-existent-service' not found."
    }
    ```

---

#### `PATCH /services/{serviceName}`
Enables or disables a specific service.

* **Request**
    * **URL Parameter:** `serviceName` (e.g., `a2dp`) - The unique name of the service.
    * **Body:** A JSON object specifying the new state.

    **Request Body Fields:**

| Field     | Type      | Required? | Description                                 |
| :-------- | :-------- | :-------- | :------------------------------------------ |
| `enabled` | `Boolean` | **Yes** | The desired new state (`true` or `false`). |

    **Example Body:**
    ```json
    {
      "enabled": false
    }
    ```

* **Response (`200 OK`)**
    Returns the full service object reflecting its new state.

    **Example Body (after disabling a2dp):**
    ```json
    {
      "name": "a2dp",
      "description": "Enables the high-quality audio streaming profile (A2DP Sink).",
      "enabled": false
    }
    ```
* **Error Response (`400 Bad Request`)**
    Returned if the request body is missing the `enabled` field or it is not a boolean.
    ```json
    {
      "error": "The 'enabled' field must be a boolean."
    }
    ```