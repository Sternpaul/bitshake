# Tasmota Setup Guide — Bitshake Smart Meter Reader Air

This guide walks you through configuring your Bitshake Smart Meter Reader Air to send electricity meter data to your backend.

## Prerequisites

- Bitshake Smart Meter Reader Air (attached to your meter's optical interface)
- Meter PIN from your grid operator (Messstellenbetreiber) — already unlocked
- Your Bitshake device connected to your WiFi network
- The IP address of your Bitshake device (check your router's DHCP lease table)

## Step 1: Access the Tasmota Web Interface

1. Open your browser and navigate to `http://<BITSHAKE_IP>`
2. You should see the Tasmota web interface

## Step 2: Configure the SML Script

The SML script tells Tasmota how to parse the data from your electricity meter.

1. Go to **Consoles > Edit Script**
2. **Enable** the script checkbox
3. Paste the following script:

```
>D
>B
=>sensor53 r
>M 1
+1,3,s,0,9600,SML
1,77070100010800ff@1000,Total Import,kWh,Total_in,3
1,77070100020800ff@1000,Total Export,kWh,Total_out,3
1,77070100100700ff@1,Current Power,W,Power_curr,0
1,77070100240700ff@1,Power L1,W,Power_L1,0
1,77070100380700ff@1,Power L2,W,Power_L2,0
1,770701004c0700ff@1,Power L3,W,Power_L3,0
1,77070100000009ff@#,Meter ID,,Meter_id,0
#
```

4. Click **Save**

> **Note:** The OBIS hex codes in this script work with most common German smart meters (EMH, Logarex, eBZ). If your meter uses different codes, check the Tasmota SML documentation or your meter's technical datasheet.

## Step 3: Verify Data is Being Read

1. Go to the Tasmota **Main Page**
2. You should see sensor readings appearing with values for:
   - Total Import (kWh)
   - Total Export (kWh)
   - Current Power (W)
   - Power L1/L2/L3 (W) — if supported by your meter
3. If no values appear, double-check:
   - The IR sensor alignment on the meter
   - Your meter PIN is entered and the extended data output is enabled
   - The baud rate (9600 is standard, some meters use 19200)

## Step 4: Configure MQTT

1. Go to **Configuration > Configure MQTT**
2. Fill in the following:

| Setting | Value |
|:--------|:------|
| **Host** | `<your-cluster-url>.s1.eu.hivemq.cloud` |
| **Port** | `8883` |
| **Client** | `bitshake-device` |
| **User** | `<your-hivemq-username>` |
| **Password** | `<your-hivemq-password>` |
| **Topic** | `bitshake` |
| **Full Topic** | `%prefix%/%topic%/` |
| **MQTT TLS** | ✅ **Check this box** (Required for HiveMQ) |

3. Click **Save** — the device will reboot

## Step 5: Adjust Telemetry Interval

By default, Tasmota sends sensor data every 300 seconds (5 minutes). For a responsive dashboard, reduce this:

1. Go to **Consoles > Console**
2. Type the following command and press Enter:

```
TelePeriod 10
```

This sets the reporting interval to **10 seconds**. The data will be published to the MQTT topic `tele/bitshake/SENSOR` every 10 seconds.

> **Tip:** For normal monitoring, 10-30 seconds is ideal. Going below 10 seconds increases network traffic with minimal benefit for dashboard visualization.

## Step 6: Verify MQTT Connection

1. In the Tasmota console, you should see MQTT connection messages
2. The MQTT status should show "Connected" in the Tasmota web interface
3. On your Oracle Cloud server, you can verify with:

```bash
docker exec bitshake-mosquitto mosquitto_sub -t "tele/bitshake/SENSOR" -u bitshake -P yourpassword
```

You should see JSON messages like:

```json
{
  "Time": "2026-07-02T11:00:00",
  "SML": {
    "Total_in": 12345.678,
    "Total_out": 4567.890,
    "Power_curr": 1250,
    "Power_L1": 420,
    "Power_L2": 380,
    "Power_L3": 450,
    "Meter_id": "0901454d480000000000"
  }
}
```

## Troubleshooting

### No sensor data appearing
- Check IR sensor alignment — the sensor must be centered on the meter's optical port
- Verify the meter PIN is entered correctly
- Try a different baud rate: add `TelePeriod 10` then check console output

### MQTT not connecting
- Verify the Oracle Cloud IP is reachable from your network
- Check that port 1883 is open in OCI Security Lists
- Verify MQTT credentials match between Tasmota and Mosquitto

### Incorrect values
- Some meters report power in different scales. Adjust the `@` multiplier in the SML script
- Check if your meter uses different OBIS codes (refer to meter documentation)
- For negative power values during feed-in, this is normal — it means you're exporting

### Per-phase power not showing
- Not all meters expose per-phase power data
- Remove the L1/L2/L3 lines from the script if your meter doesn't support them
