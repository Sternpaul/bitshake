import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
dotenv.config(); // fallback to current dir
import mqtt from 'mqtt';

const MQTT_HOST = process.env.MQTT_HOST || 'mqtt://localhost:1883';
const MQTT_USER = process.env.MQTT_USER || '';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';
const MQTT_TOPIC = 'tele/tasmota_bitshake/SENSOR'; // Matches 'tele/+/SENSOR'

console.log(`Connecting to ${MQTT_HOST}...`);

const options = {
  clientId: `bitshake-mock-${Date.now()}`,
};

if (MQTT_USER) {
  options.username = MQTT_USER;
  options.password = MQTT_PASSWORD;
}

const client = mqtt.connect(MQTT_HOST, options);

client.on('connect', () => {
  console.log('Connected to MQTT broker!');
  console.log(`Publishing mock data to ${MQTT_TOPIC} every 3 seconds... Press Ctrl+C to stop.\n`);

  // Starting values
  let totalIn = 12345.6;
  let totalOut = 4567.8;

  setInterval(() => {
    // Generate realistic looking fluctuations
    const powerCurr = Math.floor(Math.random() * 2000) + 300; // 300W to 2300W
    const powerL1 = Math.floor(powerCurr * 0.4);
    const powerL2 = Math.floor(powerCurr * 0.35);
    const powerL3 = powerCurr - powerL1 - powerL2;

    // Increment total_in slightly based on power
    totalIn += (powerCurr / 3600) * 3; // 3 seconds worth of watt-hours

    const payload = {
      Time: new Date().toISOString(),
      SML: {
        Total_in: parseFloat(totalIn.toFixed(3)),
        Total_out: parseFloat(totalOut.toFixed(3)),
        Power_curr: powerCurr,
        Power_L1: powerL1,
        Power_L2: powerL2,
        Power_L3: powerL3,
        Meter_id: "1234567890ABCDEF"
      }
    };

    client.publish(MQTT_TOPIC, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        console.error('Failed to publish:', err);
      } else {
        console.log(`[${payload.Time}] Published: ${powerCurr}W`);
      }
    });
  }, 3000);
});

client.on('error', (err) => {
  console.error('MQTT connection error:', err);
  process.exit(1);
});
