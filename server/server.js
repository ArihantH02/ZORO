const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./database'); // This is now a mysql2 pool

const app = express();
const server = http.createServer(app);

// Serve static files from the root and public directory
app.use(express.static(path.join(__dirname, '..')));
app.use('/assets', express.static(path.join(__dirname, '../public/assets')));

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH']
  }
});

app.use(cors());
app.use(express.json());

// In-Memory Budget State (Should eventually be in DB, but good for demo concurrency)
let systemState = {
  totalBudget: 5000000,
  allocatedBudget: 0
};

// Calculate allocated budget and total budget on boot
(async () => {
  try {
    const [rows] = await db.query(`SELECT SUM(amount) as total FROM budget_requests WHERE status = 'Approved'`);
    if (rows.length > 0 && rows[0].total) {
      systemState.allocatedBudget = parseInt(rows[0].total);
    }
    
    const [configRows] = await db.query(`SELECT config_value FROM system_config WHERE config_key = 'total_budget'`);
    if (configRows.length > 0) {
      systemState.totalBudget = parseInt(configRows[0].config_value);
    }
  } catch (err) {
    console.error("Failed to load initial budget state:", err);
  }
})();

// --- Audit Logger ---
const logAudit = async (action, reqId, role, details) => {
  try {
    await db.query('INSERT INTO audit_logs (action_type, request_id, user_role, details) VALUES (?, ?, ?, ?)', [action, reqId || null, role, details]);
    io.emit('AUDIT_LOG_ADDED');
  } catch (err) {
    console.error("Audit Log Error:", err);
  }
};

// --- Auth Endpoints ---

// Register
app.post('/api/auth/register', async (req, res) => {
  const { companyName, password, role, department } = req.body;
  
  let empId;
  try {
    if (role === 'Admin') {
      // Generate ADMIN-XXXX
      empId = `ADMIN-${Math.floor(1000 + Math.random() * 9000)}`;
    } else {
      // Generate EMP-<DEPT>-<NUM>
      const [rows] = await db.query('SELECT COUNT(*) as count FROM users WHERE department = ?', [department]);
      const count = rows[0].count;
      empId = `EMP-${department.toUpperCase()}-${(count + 1).toString().padStart(3, '0')}`;
    }

    await db.query(`
      INSERT INTO users (company_name, emp_id, password, role, department) 
      VALUES (?, ?, ?, ?, ?)
    `, [companyName, empId, password, role, department || null]);

    res.status(201).json({ empId, role });
  } catch (err) {
    res.status(400).json({ error: 'REGISTRATION_FAILED', message: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { companyName, empId, password } = req.body;
  
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE LOWER(company_name) = LOWER(?) AND LOWER(emp_id) = LOWER(?) AND password = ?', [companyName, empId, password]);
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'AUTH_FAILED', message: 'Invalid credentials' });
    }

    const user = rows[0];
    res.json({
      empId: user.emp_id,
      role: user.role,
      department: user.department,
      companyName: user.company_name
    });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Onboard (Bulk Setup)
app.post('/api/auth/onboard', async (req, res) => {
  const { companyName, departments } = req.body;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    for (const dept of departments) {
      // Create Department
      await connection.query('INSERT IGNORE INTO departments (name, priority_score) VALUES (?, ?)', [dept.name, dept.priority || 5]);

      // Create Employees
      if (dept.employees && dept.employees.length > 0) {
        for (const emp of dept.employees) {
          await connection.query(`
            INSERT IGNORE INTO users (company_name, emp_id, password, role, department) 
            VALUES (?, ?, ?, ?, ?)
          `, [companyName, emp.empId, 'zoro123', emp.role || 'Employee', dept.name]);
        }
      }
    }

    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    res.status(400).json({ error: 'ONBOARD_FAILED', message: err.message });
  } finally {
    connection.release();
  }
});

// GET Initial State
app.get('/api/state', async (req, res) => {
  const { role, dept } = req.query;
  
  try {
    let requests = [];
    if (role === 'Admin') {
      const [rows] = await db.query('SELECT * FROM budget_requests ORDER BY created_at DESC');
      requests = rows;
    } else if (dept) {
      const [rows] = await db.query('SELECT * FROM budget_requests WHERE dept_name = ? ORDER BY created_at DESC', [dept]);
      requests = rows;
    }

    const [depts] = await db.query('SELECT * FROM departments ORDER BY priority_score DESC');
    
    res.json({
      ...systemState,
      requests,
      departments: role === 'Admin' ? depts : depts.filter(d => d.name === dept)
    });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// GET Audit Logs
app.get('/api/audit', async (req, res) => {
  try {
    const [logs] = await db.query(`
      SELECT al.*, br.dept_name 
      FROM audit_logs al
      LEFT JOIN budget_requests br ON al.request_id = br.id
      ORDER BY al.created_at DESC
      LIMIT 100
    `);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Update Total Budget Pool
app.post('/api/budget/total', async (req, res) => {
  const { amount } = req.body;
  if (!amount || isNaN(amount)) return res.status(400).json({ error: 'Invalid amount' });

  try {
    // Save to database config
    await db.query(`
      INSERT INTO system_config (config_key, config_value) 
      VALUES ('total_budget', ?) 
      ON DUPLICATE KEY UPDATE config_value = ?
    `, [amount.toString(), amount.toString()]);

    // Update global system state
    systemState.totalBudget = parseInt(amount);
    
    // Create an audit log
    await logAudit('UPDATE_TOTAL_BUDGET', null, 'Admin', `Total budget pool set to ₹${parseInt(amount).toLocaleString()}`);
    
    // Broadcast update to all clients
    io.emit('BUDGET_UPDATED', { ...systemState });

    res.json({ success: true, totalBudget: systemState.totalBudget });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});


// POST New Department
app.post('/api/departments', async (req, res) => {
  const { name, priority, role, employees } = req.body;
  if (role !== 'Admin') return res.status(403).json({ error: 'Unauthorized' });

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query('INSERT INTO departments (name, priority_score) VALUES (?, ?)', [name, priority || 5]);

    if (employees && employees.length > 0) {
      const [adminRows] = await connection.query('SELECT company_name FROM users WHERE role = ? LIMIT 1', ['Admin']);
      const companyName = adminRows.length > 0 ? adminRows[0].company_name : 'ZORO Corp';

      for (const emp of employees) {
        await connection.query(`
          INSERT INTO users (company_name, emp_id, password, role, department) 
          VALUES (?, ?, ?, ?, ?)
        `, [companyName, emp.empId, 'zoro123', emp.role || 'Employee', name]);
      }
    }

    await connection.commit();

    await logAudit('CREATE_DEPARTMENT', null, role, `Created department ${name} with ${employees ? employees.length : 0} employees.`);
    io.emit('REQUEST_UPDATED'); // Broadly signals a state change to clients
    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Department or Employee ID already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  } finally {
    connection.release();
  }
});

app.get('/api/requests/:id/comments', async (req, res) => {
  try {
    const [comments] = await db.query('SELECT * FROM request_comments WHERE request_id = ? ORDER BY created_at ASC', [req.params.id]);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// POST New Request
app.post('/api/requests', async (req, res) => {
  const { dept, amount, reason, emergency, role } = req.body;
  
  // Logic: DeptHead requests go straight to Admin. Employee requests go to DeptHead.
  const initialStatus = (role === 'DeptHead' || role === 'Admin') ? 'Pending_Admin' : 'Pending_Dept';

  try {
    const [result] = await db.query(`
      INSERT INTO budget_requests (dept_name, amount, reason, emergency, status) 
      VALUES (?, ?, ?, ?, ?)
    `, [dept, amount, reason, emergency ? 1 : 0, initialStatus]);
    
    await logAudit('CREATE_REQUEST', result.insertId, role, `Requested ${amount} for ${dept}`);
    
    io.emit('REQUEST_UPDATED'); // Broadcast change
    if (emergency) io.emit('EMERGENCY_ALERT', { dept, amount });
    
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// PATCH Request Status (Dept Head / Manual Admin)
app.patch('/api/requests/:id', async (req, res) => {
  const { status, role, amount } = req.body;
  const id = req.params.id;

  try {
    const [rows] = await db.query('SELECT * FROM budget_requests WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).send('Not found');
    const currentReq = rows[0];

    // Concurrency Check for Manual Approval
    if (status === 'Approved') {
      const finalAmount = amount || currentReq.amount;
      if (systemState.totalBudget - systemState.allocatedBudget < finalAmount) {
        return res.status(400).json({ error: 'BUDGET_CONFLICT', message: 'Insufficient remaining budget.' });
      }
      systemState.allocatedBudget += finalAmount;
    }

    await db.query('UPDATE budget_requests SET status = ?, amount = ? WHERE id = ?', [status, amount || currentReq.amount, id]);

    await logAudit(`UPDATE_STATUS_${status.toUpperCase()}`, id, role, `Status changed to ${status}`);
    
    io.emit('REQUEST_UPDATED');
    io.emit('BUDGET_UPDATED', systemState);
    
    // Specific status notification for the requesting department
    io.emit('STATUS_NOTIFICATION', { 
      id, 
      status, 
      dept: currentReq.dept_name, 
      amount: amount || currentReq.amount 
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// POST Comment (Negotiation)
app.post('/api/requests/:id/comments', async (req, res) => {
  const { role, comment } = req.body;
  const id = req.params.id;

  try {
    await db.query('INSERT INTO request_comments (request_id, user_role, comment) VALUES (?, ?, ?)', [id, role, comment]);

    await logAudit('ADD_COMMENT', id, role, `Added comment: ${comment.substring(0, 20)}...`);
    
    io.emit('COMMENT_ADDED', { requestId: id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// POST Auto-Allocate (Arbitration Engine)
app.post('/api/allocate', async (req, res) => {
  const { role } = req.body;

  try {
    // 1. Get all Pending_Admin requests
    const [pendingReqs] = await db.query('SELECT * FROM budget_requests WHERE status = ?', ['Pending_Admin']);
    if (pendingReqs.length === 0) return res.json({ approved: 0, rejected: 0 });

    // 2. Get Department Priorities
    const [depts] = await db.query('SELECT * FROM departments');
    const deptPriorityMap = {};
    depts.forEach(d => deptPriorityMap[d.name] = d.priority_score);

    // 3. Sort Logic (Emergency First, then Priority Score, then Date)
    pendingReqs.sort((a, b) => {
      if (a.emergency && !b.emergency) return -1;
      if (!a.emergency && b.emergency) return 1;
      if (a.emergency && b.emergency) return new Date(a.created_at) - new Date(b.created_at);
      
      const pA = deptPriorityMap[a.dept_name] || 0;
      const pB = deptPriorityMap[b.dept_name] || 0;
      
      if (pA !== pB) return pB - pA; // Descending score
      return new Date(a.created_at) - new Date(b.created_at);
    });

    // 4. Sequentially Process Transaction
    let approvedCount = 0;
    let rejectedCount = 0;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      for (const r of pendingReqs) {
        if (systemState.totalBudget - systemState.allocatedBudget >= r.amount) {
          await connection.query('UPDATE budget_requests SET status = ? WHERE id = ?', ['Approved', r.id]);
          systemState.allocatedBudget += r.amount;
          approvedCount++;
          // We can call logAudit without connection, or rewrite logAudit. Since it's demo, we can just await the global one
        } else {
          await connection.query('UPDATE budget_requests SET status = ? WHERE id = ?', ['Rejected', r.id]);
          rejectedCount++;
        }
      }

      await connection.commit();
      
      // Async logging outside transaction to avoid blocking it for too long
      for (const r of pendingReqs) {
         if (r.status === 'Approved') await logAudit('AUTO_APPROVE', r.id, role, 'Approved via Auto-Allocation Engine');
         else await logAudit('AUTO_REJECT', r.id, role, 'Rejected via Auto-Allocation Engine (Insufficient Budget)');
      }

    } catch (txErr) {
      await connection.rollback();
      throw txErr;
    } finally {
      connection.release();
    }

    io.emit('REQUEST_UPDATED');
    io.emit('BUDGET_UPDATED', systemState);
    res.json({ approved: approvedCount, rejected: rejectedCount });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});



// Socket Connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ZORO Backend running on http://localhost:${PORT}`);
});
