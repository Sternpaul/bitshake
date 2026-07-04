import { getSolarData, setSolarEstimation } from './backend/api/src/mqtt-bridge.js';

// mock things up
setSolarEstimation(true);

const time = new Date('2026-07-04T09:55:15Z'); // 11:55 local (UTC+2) is 09:55 UTC

const hour = 9.916666;
console.log("hour", hour);

const theoEast = 800 * Math.exp(-0.5 * Math.pow((hour - 9.5) / 3.0, 2));
const theoSouth = 650 * Math.exp(-0.5 * Math.pow((hour - 12.5) / 3.0, 2));

const safeTheoEast = Math.max(theoEast, 50); 
const ratio = Math.min(theoSouth / safeTheoEast, 4.0);

const measuredEast = 107;
const estimatedSouth = Math.min(measuredEast * ratio, 650);
const totalSolarPower = Math.round(measuredEast + estimatedSouth);

console.log({
  hour,
  theoEast,
  theoSouth,
  ratio,
  estimatedSouth,
  totalSolarPower
});
