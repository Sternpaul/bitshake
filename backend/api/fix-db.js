import { query } from './src/db.js';

async function fixDb() {
  console.log('Fixing 0 drops in meter_readings...');
  try {
    const res = await query('SELECT MAX(solar_energy_total) as max_total, MAX(solar_estimated_total) as max_est FROM meter_readings');
    const maxTotal = res.rows[0].max_total || 0;
    const maxEst = res.rows[0].max_est || 0;
    
    if (maxTotal > 0) {
      await query(`UPDATE meter_readings SET solar_energy_total = $1 WHERE solar_energy_total = 0 OR solar_energy_total IS NULL`, [maxTotal]);
      await query(`UPDATE meter_readings SET solar_estimated_total = $1 WHERE solar_estimated_total = 0 OR solar_estimated_total IS NULL`, [maxEst]);
      
      console.log(`Updated 0s to MAX: Total=${maxTotal}, Est=${maxEst}`);
      
      // Refresh the continuous aggregates to fix the analytics
      console.log('Refreshing hourly_energy...');
      await query(`CALL refresh_continuous_aggregate('hourly_energy', NULL, NULL)`);
      
      console.log('Refreshing daily_energy...');
      await query(`CALL refresh_continuous_aggregate('daily_energy', NULL, NULL)`);
      
      console.log('Database fixed successfully!');
    } else {
      console.log('No valid solar data found to fix with.');
    }
    
  } catch (err) {
    console.error('Error fixing DB:', err);
  }
  process.exit(0);
}

fixDb();
