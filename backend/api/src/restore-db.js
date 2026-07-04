import { query } from './db.js';

async function restoreDb() {
  console.log('Restoring solar data for today using daily generation counters...');
  try {
    // 1. Get the absolute latest valid readings for today
    const resLatest = await query(`
      SELECT solar_energy_total, solar_energy_daily, solar_estimated_total, solar_estimated_daily 
      FROM meter_readings 
      WHERE time >= CURRENT_DATE 
        AND solar_energy_daily > 0 
        AND solar_energy_total > 0
      ORDER BY time DESC LIMIT 1
    `);
    
    if (resLatest.rows.length === 0) {
      console.log('Could not find valid daily metrics to restore from. They might be 0.');
      process.exit(0);
    }
    
    const latest = resLatest.rows[0];
    const baseTotal = latest.solar_energy_total - latest.solar_energy_daily;
    const baseEstTotal = latest.solar_estimated_total - latest.solar_estimated_daily;
    
    console.log(`Calculated Base Totals at Start of Day: Raw=${baseTotal}, Est=${baseEstTotal}`);
    
    // 2. Fetch all rows for today ordered by time
    const resRows = await query(`SELECT time, solar_energy_daily, solar_estimated_daily FROM meter_readings WHERE time >= CURRENT_DATE ORDER BY time ASC`);
    
    let runningDaily = 0;
    let runningEstDaily = 0;
    
    console.log(`Processing ${resRows.rows.length} readings for today to rebuild the curves...`);
    
    // 3. Update each row
    for (const row of resRows.rows) {
      // The bug caused daily to drop to 0 too. We use a running max so the counter never goes backwards.
      if (row.solar_energy_daily > runningDaily) {
        runningDaily = row.solar_energy_daily;
      }
      if (row.solar_estimated_daily > runningEstDaily) {
        runningEstDaily = row.solar_estimated_daily;
      }
      
      const newTotal = baseTotal + runningDaily;
      const newEstTotal = baseEstTotal + runningEstDaily;
      
      await query(`
        UPDATE meter_readings 
        SET solar_energy_total = $1, solar_estimated_total = $2 
        WHERE time = $3
      `, [newTotal, newEstTotal, row.time]);
    }
    
    console.log('Perfectly restored all rows for today!');
    
    console.log('Refreshing Analytics Engine...');
    await query(`CALL refresh_continuous_aggregate('hourly_energy', NULL, NULL)`);
    await query(`CALL refresh_continuous_aggregate('daily_energy', NULL, NULL)`);
    
    console.log('Database restore complete! You can refresh your dashboard now.');
    
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

restoreDb();
