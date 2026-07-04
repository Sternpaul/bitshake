import mqtt from 'mqtt';
import { query } from './db.js';

const MQTT_HOST = process.env.MQTT_HOST || 'mqtt://mosquitto:1883';
const MQTT_USER = process.env.MQTT_USER || '';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';
// Read user topics and always ensure hm2mqtt is included for the solar integration
const userTopic = process.env.MQTT_TOPIC || 'tele/+/SENSOR';
const MQTT_TOPICS = userTopic.split(',').map(t => t.trim());
if (!MQTT_TOPICS.some(t => t.includes('hm2mqtt'))) {
  MQTT_TOPICS.push('hm2mqtt/+/device/+/data');
}

let client = null;
let lastReading = null;
let lastRawPayloadGrid = null;
let lastRawPayloadSolar = null;
let messageCount = 0;

let lastGridData = { totalImport: null, totalExport: null, powerCurrent: null, powerL1: null, powerL2: null, powerL3: null };
let lastSolarData = { 
  totalSolarPower: null, 
  dailyEnergy: null, 
  monthlyEnergy: null, 
  totalEnergy: null,
  estimatedPower: null,
  estimatedDaily: null,
  estimatedTotal: null
};

// Solar curve parameters
let referenceArray = { capacity: 800, peakHour: 9.5, curveWidth: 3.0 };
let virtualArrays = [
  { id: 'default-south', name: 'Süd-Ausrichtung', capacity: 650, peakHour: 12.5, curveWidth: 3.0 }
];

export async function loadSolarSettings() {
  try {
    const res = await query("SELECT key, value FROM settings WHERE key IN ('solar_reference_array', 'solar_virtual_arrays')");
    for (const row of res.rows) {
      if (row.key === 'solar_reference_array') {
        try {
          referenceArray = JSON.parse(row.value);
        } catch (e) { console.error('Failed to parse solar_reference_array', e); }
      } else if (row.key === 'solar_virtual_arrays') {
        try {
          virtualArrays = JSON.parse(row.value);
        } catch (e) { console.error('Failed to parse solar_virtual_arrays', e); }
      }
    }
    console.log('[MQTT] Loaded dynamic solar array configuration');
  } catch (err) {
    console.error('[MQTT] Failed to load solar settings:', err);
  }
}

export function getSolarData() {
  return lastSolarData;
}

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
      if (topic.includes('hm2mqtt')) {
        lastRawPayloadSolar = payload;
      } else {
        lastRawPayloadGrid = payload;
      }
      
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
 */
async function processReading(payload, topic) {
  // --- hm2mqtt / Marstek Integration ---
  if (topic.includes('hm2mqtt') && topic.endsWith('/data')) {
    if (typeof payload === 'object' && payload !== null) {
      const time = new Date();
      
      const pv1 = parseFloat(payload.pv1Power || 0);
      const pv2 = parseFloat(payload.pv2Power || 0);
      const measuredEast = pv1 + pv2; // Raw solid output
      
      // Calculate Gaussian extrapolation for all Virtual arrays based on the Reference array
      const now = new Date();
      const hour = now.getUTCHours() + (now.getUTCMinutes() / 60);
      
      const theoRef = referenceArray.capacity * Math.exp(-0.5 * Math.pow((hour - referenceArray.peakHour) / referenceArray.curveWidth, 2));
      const safeTheoRef = Math.max(theoRef, 50); // Prevent divide by zero
      
      let totalVirtualCapacity = 0;
      let totalEstimatedPower = 0;

      for (const vArray of virtualArrays) {
        totalVirtualCapacity += vArray.capacity;
        
        let efficiency = 1.0;
        if (vArray.shade === 'morgens' && hour >= 6 && hour <= 10) efficiency = 0.2;
        else if (vArray.shade === 'mittags' && hour >= 11 && hour <= 14) efficiency = 0.2;
        else if (vArray.shade === 'nachmittags' && hour >= 14 && hour <= 17) efficiency = 0.2;
        else if (vArray.shade === 'abends' && hour >= 17 && hour <= 21) efficiency = 0.2;

        const theoVirtual = vArray.capacity * efficiency * Math.exp(-0.5 * Math.pow((hour - vArray.peakHour) / vArray.curveWidth, 2));
        const ratio = theoVirtual / safeTheoRef;
        
        // Estimate this specific virtual array and clamp to its max shaded capacity
        const estimatedVirtual = Math.min(measuredEast * ratio, vArray.capacity * efficiency);
        totalEstimatedPower += estimatedVirtual;
      }

      // We explicitly separate Raw vs Estimated
      const estimatedPower = Math.round(totalEstimatedPower);
      const capacityMultiplier = (referenceArray.capacity + totalVirtualCapacity) / referenceArray.capacity; // Total capacity ratio
      
      const pDaily = parseFloat(payload.dailyEnergyGenerated);
      const measuredDaily = (pDaily > 0) ? pDaily : (lastSolarData.dailyEnergy || 0);
      
      const pMonthly = parseFloat(payload.monthlyEnergyGenerated);
      const measuredMonthly = (pMonthly > 0) ? pMonthly : (lastSolarData.monthlyEnergy || 0);
      
      const pTotal = parseFloat(payload.totalEnergyGenerated);
      const measuredTotal = (pTotal > 0) ? pTotal : (lastSolarData.totalEnergy || 0);
      
      const estimatedDaily = measuredDaily * (capacityMultiplier - 1.0);
      const estimatedTotal = measuredTotal * (capacityMultiplier - 1.0);

      lastSolarData = { 
        totalSolarPower: measuredEast, 
        dailyEnergy: measuredDaily, 
        monthlyEnergy: measuredMonthly, 
        totalEnergy: measuredTotal,
        estimatedPower: estimatedPower,
        estimatedDaily: estimatedDaily,
        estimatedTotal: estimatedTotal
      };
      
      // Insert into TimescaleDB with combined data
      await query(
        `INSERT INTO meter_readings (time, total_import, total_export, power_current, power_l1, power_l2, power_l3, solar_power, solar_energy_daily, solar_energy_total, solar_estimated_power, solar_estimated_daily, solar_estimated_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          time, 
          lastGridData.totalImport, 
          lastGridData.totalExport, 
          lastGridData.powerCurrent, 
          lastGridData.powerL1, 
          lastGridData.powerL2, 
          lastGridData.powerL3, 
          lastSolarData.totalSolarPower, 
          lastSolarData.dailyEnergy, 
          lastSolarData.totalEnergy,
          lastSolarData.estimatedPower,
          lastSolarData.estimatedDaily,
          lastSolarData.estimatedTotal
        ]
      );
      
      console.log(`[DB] Inserted Solar Reading: ${measuredEast}W (Est: ${estimatedPower}W)`);
    }
    return;
  }

  // --- Tasmota / Logarex Integration ---
  const sml = payload.SML || payload.sml || findSmlData(payload);

  if (!sml) {
    return;
  }

  const time = new Date();

  const totalImport = sml.Total_in ?? sml.total_in ?? sml.Import ?? sml.Bezug ?? sml.ImportActive ?? null;
  const totalExport = sml.Total_out ?? sml.total_out ?? sml.Export ?? sml.Einspeisung ?? sml.ExportActive ?? null;
  const powerCurrent = sml.Power_curr ?? sml.power_curr ?? sml.Power ?? sml.Leistung ?? null;
  const powerL1 = sml.Power_L1 ?? sml.power_l1 ?? sml.power_L1 ?? sml.P_L1 ?? null;
  const powerL2 = sml.Power_L2 ?? sml.power_l2 ?? sml.power_L2 ?? sml.P_L2 ?? null;
  const powerL3 = sml.Power_L3 ?? sml.power_l3 ?? sml.power_L3 ?? sml.P_L3 ?? null;

  if (totalImport === null && totalExport === null && powerCurrent === null) {
    console.warn('[MQTT] Received SML data but no recognized values:', JSON.stringify(sml).substring(0, 200));
    return;
  }
  
  lastGridData = { totalImport, totalExport, powerCurrent, powerL1, powerL2, powerL3 };

  await query(
    `INSERT INTO meter_readings (time, total_import, total_export, power_current, power_l1, power_l2, power_l3, solar_power, solar_energy_daily, solar_energy_total, solar_estimated_power, solar_estimated_daily, solar_estimated_total)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      time, 
      totalImport, 
      totalExport, 
      powerCurrent, 
      powerL1, 
      powerL2, 
      powerL3, 
      lastSolarData.totalSolarPower, 
      lastSolarData.dailyEnergy, 
      lastSolarData.totalEnergy,
      lastSolarData.estimatedPower,
      lastSolarData.estimatedDaily,
      lastSolarData.estimatedTotal
    ]
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
  for (const key of Object.keys(payload)) {
    if (key === 'Time' || key === 'TempUnit') continue;
    const val = payload[key];
    if (typeof val === 'object' && val !== null) {
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
    lastRawPayloadGrid,
    lastRawPayloadSolar,
  };
}

/**
 * Gracefully disconnect the MQTT client.
 */
export function stopMqttBridge() {
  if (client) {
    client.end();
  }
}

async function loadInitialSettings() {
  await loadSolarSettings();
}

// Call it on startup
loadInitialSettings();
