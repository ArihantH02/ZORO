import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'server', 'zoro.db');
const db = new Database(dbPath);

const targetEmp = 'EMP-HR-001';
const users = db.prepare('SELECT * FROM users WHERE emp_id = ?').all(targetEmp);
console.log("Found users for " + targetEmp + ":");
console.log(JSON.stringify(users, null, 2));

const allUsers = db.prepare('SELECT company_name, emp_id, password FROM users').all();
console.log("\nAll registered users (Company | ID | Password):");
allUsers.forEach(u => {
    console.log(`${u.company_name} | ${u.emp_id} | ${u.password}`);
});
