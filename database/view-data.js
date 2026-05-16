const pool = require('../src/config/db');

async function viewData() {
  try {
    console.log('--- USERS ---');
    const [users] = await pool.query('SELECT * FROM users');
    console.table(users);

    console.log('\n--- JOBS ---');
    const [jobs] = await pool.query('SELECT * FROM jobs');
    console.table(jobs);

    console.log('\n--- APPLICATIONS ---');
    const [applications] = await pool.query('SELECT * FROM applications');
    console.table(applications);

    console.log('\n--- RATINGS ---');
    const [ratings] = await pool.query('SELECT * FROM ratings');
    console.table(ratings);

  } catch (error) {
    console.error('Error fetching data:', error);
  } finally {
    process.exit();
  }
}

viewData();
