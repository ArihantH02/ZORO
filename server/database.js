const mysql = require('mysql2/promise');

const pool = mysql.createPool('mysql://root:lwKNluCaIRFujAZkkXNJxrobfSJfbQda@tramway.proxy.rlwy.net:48805/railway');

// Initialize Database Schema
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        priority_score INT NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS budget_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        dept_name VARCHAR(255) NOT NULL,
        amount INT NOT NULL,
        reason TEXT NOT NULL,
        emergency BOOLEAN NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'Pending_Dept',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS request_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        user_role VARCHAR(50) NOT NULL,
        comment TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES budget_requests(id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        action_type VARCHAR(100) NOT NULL,
        request_id INT,
        user_role VARCHAR(50) NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        emp_id VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        department VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(company_name, emp_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        config_key VARCHAR(100) PRIMARY KEY,
        config_value VARCHAR(255) NOT NULL
      )
    `);

    // Seed default total budget if none exists
    const [configRows] = await pool.query("SELECT * FROM system_config WHERE config_key = 'total_budget'");
    if (configRows.length === 0) {
      await pool.query("INSERT INTO system_config (config_key, config_value) VALUES ('total_budget', '5000000')");
    }

    // Seed default departments if none exist
    const [rows] = await pool.query('SELECT count(*) as count FROM departments');
    if (rows[0].count === 0) {
      const depts = [
        ['Finance', 10],
        ['IT', 8],
        ['Marketing', 6],
        ['Operations', 4],
        ['HR', 2],
        ['Sales', 1]
      ];
      
      for (const dept of depts) {
        await pool.query('INSERT IGNORE INTO departments (name, priority_score) VALUES (?, ?)', [dept[0], dept[1]]);
      }
    }
    console.log("MySQL Database Initialized successfully!");
  } catch (error) {
    console.error("Database initialization failed:", error);
  }
};

initDb();

module.exports = pool;
