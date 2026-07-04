import mqtt from 'mqtt';
import { query } from './db.js';

const MQTT_HOST = process.env.MQTT_HOST || 'mqtt://mosquitto:1883';
const MQTT_USER = process.env.MQTT_USER || '';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';
// We now support multiple topics: the original Tasmota topic AND the hm2mqtt topics
const MQTT_TOPICS = (process.env.MQTT_TOPIC || 'tele/+/SENSOR,hm2mqtt/+/device/+/data').split(',').map(t => t.trim());

let client = null;
let lastReading = null;
let lastRawPayload = null;
let messageCount = 0;

/**
 * Start the MQTT bridge — subscribes to Tasmota sensor topics
 * and writes readings to TimescaleDB.
 */
export function startMqttBridge() {
  const options = {
    clientId: `bitshake-api-${Date.now()}`,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
  };

  if (MQTT_USER) {
    options.username = MQTT_USER;
    options.password = MQTT_PASSWORD;
  }

  client = mqtt.connect(MQTT_HOST, options);

  client.on('connect', () => {
    console.log(`[MQTT] Connected to ${MQTT_HOST}`);
    
    // Subscribe to all topics in our array
    MQTT_TOPICS.forEach(topic => {
      client.subscribe(topic, { qos: 1 }, (err, granted) => {
        if (err) {
          console.error(`[MQTT] Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`[MQTT] Subscribed to: ${granted.map(g => g.topic).join(', ')}`);
        }
      });
    });
  });

  client.on('message', async (topic, message) => {
    try {
      const msgStr = message.toString();
      let payload = null;
      try {
        payload = JSON.parse(msgStr);
      } catch (e) {
        // Not a JSON payload, probably an availability string like "online"
        payload = msgStr;
      }
      lastRawPayload = payload;
      
      await processReading(payload, topic);
    } catch (err) {
      console.error('[MQTT] Failed to process message:', err.message);
    }
  });

  client.on('error', (err) => {
    console.error('[MQTT] Connection error:', err);
  });

  client.on('reconnect', () => {
    console.log('[MQTT] Reconnecting...');
  });

  client.on('offline', () => {
    console.warn('[MQTT] Client offline');
  });

  return client;
}

/**
 * Process a Tasmota SML sensor reading.
 * Expected payload format from Tasmota SML script:
 * {
 *   "Time": "2026-07-02T11:00:00",
 *   "SML": {
 *     "Total_in": 12345.678,
 *     "Total_out": 4567.890,
 *     "Power_curr": 1250,
 *     "Power_L1": 420,
 *     "Power_L2": 380,
 *     "Power_L3": 450,
 *     "Meter_id": "..."
 *   }
 * }
 */
async function processReading(payload, topic) {
  // --- hm2mqtt / Marstek Integration ---
  if (topic.includes('hm2mqtt') && topic.endsWith('/data')) {
    if (typeof payload === 'object' && payload !== null) {
      // The payload contains the full JSON state of the inverter!
      console.log(`[MQTT] Received Marstek Data:`, payload);
      
      const time = new Date();
      // Combine pv1Power and pv2Power if they exist
      const pv1 = parseFloat(payload.pv1Power || 0);
      const pv2 = parseFloat(payload.pv2Power || 0);
      const totalSolarPower = pv1 + pv2;
      const dailyEnergy = parseFloat(payload.dailyEnergyGenerated || 0);
      
      // We insert a row with JUST the solar data. The grid data will be null.
      // TimescaleDB allows us to coalesce or aggregate these smoothly over time.
      await query(
        `INSERT INTO meter_readings (time, solar_power, solar_energy_daily)
         VALUES ($1, $2, $3)`,
        [time, totalSolarPower, dailyEnergy]
      );
      
      console.log(`[DB] Inserted Solar Reading: ${totalSolarPower}W`);
    }
    return;
  }

  // --- Tasmota / Logarex Integration ---
  // Tasmota wraps sensor data in a key — find the SML data
  // It could be under "SML", or the Tasmota topic name
  const sml = payload.SML || payload.sml || findSmlData(payload);

  if (!sml) {
    // Not an SML message — might be a status or other Tasmota message
    return;
  }

  // Ignore Tasmota's payload.Time entirely. ESP8266/ESP32 clocks often drift or
  // lack proper timezone/DST configurations, resulting in 1-2 hour display offsets.
  // Using the server's NTP-synced clock guarantees standard UTC timestamps.
  const time = new Date();

  // Extract values with fallbacks for different Tasmota script naming conventions
  const totalImport = sml.Total_in ?? sml.total_in ?? sml.Import ?? sml.Bezug ?? sml.ImportActive ?? null;
  const totalExport = sml.Total_out ?? sml.total_out ?? sml.Export ?? sml.Einspeisung ?? sml.ExportActive ?? null;
  const powerCurrent = sml.Power_curr ?? sml.power_curr ?? sml.Power ?? sml.Leistung ?? null;
  const powerL1 = sml.Power_L1 ?? sml.power_l1 ?? sml.power_L1 ?? sml.P_L1 ?? null;
  const powerL2 = sml.Power_L2 ?? sml.power_l2 ?? sml.power_L2 ?? sml.P_L2 ?? null;
  const powerL3 = sml.Power_L3 ?? sml.power_l3 ?? sml.power_L3 ?? sml.P_L3 ?? null;

  // Validate: at least one meaningful value
  if (totalImport === null && totalExport === null && powerCurrent === null) {
    console.warn('[MQTT] Received SML data but no recognized values:', JSON.stringify(sml).substring(0, 200));
    return;
  }

  // Insert into TimescaleDB
  await query(
    `INSERT INTO meter_readings (time, total_import, total_export, power_current, power_l1, power_l2, power_l3)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [time, totalImport, totalExport, powerCurrent, powerL1, powerL2, powerL3]
  );

  messageCount++;
  lastReading = {
    time,
    total_import: totalImport,
    total_export: totalExport,
    power_current: powerCurrent,
    power_l1: powerL1,
    power_l2: powerL2,
    power_l3: powerL3,
  };

  if (messageCount % 100 === 0) {
    console.log(`[MQTT] Processed ${messageCount} readings. Latest power: ${powerCurrent}W`);
  }
}

/**
 * Try to find SML-like data in the payload, supporting various Tasmota configurations.
 */
function findSmlData(payload) {
  // Some Tasmota configs nest data differently
  for (const key of Object.keys(payload)) {
    if (key === 'Time' || key === 'TempUnit') continue;
    const val = payload[key];
    if (typeof val === 'object' && val !== null) {
      // Check if it has energy-related keys
      if ('Total_in' in val || 'total_in' in val || 'Power_curr' in val || 'Import' in val || 'Bezug' in val || 'ImportActive' in val) {
        return val;
      }
    }
  }
  return null;
}

/**
 * Get MQTT bridge status for health checks.
 */
export function getMqttStatus() {
  return {
    connected: client?.connected || false,
    messageCount,
    lastReading,
    lastRawPayload,
  };
}

/**
 * Gracefully disconnect the MQTT client.
 */
export function stopMqttBridge() {
  if (client) {
    client.end(true);
    console.log('[MQTT] Bridge stopped');
  }
}
