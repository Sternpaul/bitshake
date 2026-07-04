# Marstek / Hame Solar Integration Setup

The Bitshake Smart Meter Dashboard includes a native, built-in integration for **Marstek** and **Hame** Microinverters. This allows you to track your solar production alongside your grid consumption, even if your solar panels are not connected to a smart meter!

## How it works

The backend runs two additional Docker containers to fetch data from the cloud:
1. **`hame-relay`**: Logs into the Hame Energy cloud using your email/password, acts as a bridge, and creates a local MQTT endpoint for the data.
2. **`hm2mqtt`**: Connects to the relay, parses the proprietary device packets, and converts them into standard JSON payloads that our `mqtt-bridge` can ingest.

## Prerequisites

- You must have a registered account in the official Marstek/Hame App.
- You must know the MAC address of your microinverter (found on the device sticker or inside the app).

## Step-by-Step Configuration

1. Connect to your Oracle Cloud server via SSH.
2. Open the backend configuration file:
   ```bash
   cd ~/bitshake/backend
   nano .env
   ```
3. Scroll down to the **Marstek Solar Integration** section. Fill in your credentials:
   ```ini
   # Marstek Solar Integration
   HAME_USER=your.email@example.com
   HAME_PASS=YourSecretPassword123
   MARSTEK_MAC=009b0805d1da
   ```
   *Note: Ensure the MAC address is lowercase and contains no colons.*

4. Restart the backend to apply the new configuration and spin up the solar containers:
   ```bash
   docker compose up -d
   ```

5. **Verify it's working**: Check the logs of the dashboard API to ensure it's receiving the solar data:
   ```bash
   docker logs -f bitshake-api
   ```
   You should see `[DB] Inserted Solar Reading: XX W` appearing every 10-20 seconds.

## Advanced: Gaussian Time-of-Day Estimation

If you have additional solar panels that use a *different* microinverter (or are unmeasured), the backend includes an experimental mathematical estimation model. 

It uses the live readings of your primary Marstek panels (e.g., East-facing) to extrapolate the expected generation of unmeasured panels (e.g., South-facing) based on their capacity ratio and the time of day using a Gaussian distribution curve.

This feature can be easily turned **ON** or **OFF** directly from the **Einstellungen** tab in the web dashboard!

## Diagnostics & Troubleshooting

The Marstek API provides extensive diagnostic information, including:
- Per-panel DC Voltage (`pv1_v`, `pv2_v`)
- Per-panel DC Current (`pv1_i`, `pv2_i`)
- AC Grid Frequency (`grd_f`)
- AC Grid Voltage (`grd_v`)
- Inverter Temperature (`chp_t`)
- Error Codes and WiFi Signal Strength (`wif_r`)

While the main dashboard only visualizes the total power and energy for simplicity, you can view the **complete, unfiltered raw data** at any time. Simply navigate to **Settings -> Gerätediagnose (Rohdaten) -> Solaranlage** in the web dashboard to see the live JSON output.
