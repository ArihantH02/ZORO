// CSS handled via HTML link
import { socket, fetchState, runAutoAllocation, updateRequestStatus, fetchComments, addComment, fetchAuditLogs, getLocalRoleState, setLocalRoleState, updateTotalBudget, createDepartment } from './api.js';
import { initAurora } from './anoai.js';

document.addEventListener('DOMContentLoaded', async () => {
  const roleState = getLocalRoleState();
  if (roleState.role !== 'Admin') {
    window.location.href = '/dashboard.html';
    return;
  }

  // Initialize Background - Disabled for static background
  // initAurora();

  // --- Element Selections ---
  const budgetDisplay = document.getElementById('totalAvailableBudgetDisplay');
  const priorityOrderDisplay = document.getElementById('priorityOrderDisplay');
  const tableBody = document.getElementById('requestsTableBody');
  const searchInput = document.getElementById('searchDept');
  const sortSelect = document.getElementById('sortRequests');
  const auditLogBody = document.getElementById('auditLogBody');
  const toastContainer = document.getElementById('toastContainer');
  const btnAutoAllocate = document.getElementById('btnAutoAllocate');
  const btnSetBudget = document.getElementById('btnSetBudget');
  const budgetModal = document.getElementById('budgetModal');
  const closeBudgetModal = document.getElementById('closeBudgetModal');
  const budgetForm = document.getElementById('budgetForm');
  const newTotalBudgetInput = document.getElementById('newTotalBudget');
  
  // Department Elements
  const btnAddDept = document.getElementById('btnAddDept');
  const addDeptModal = document.getElementById('addDeptModal');
  const closeAddDeptModal = document.getElementById('closeAddDeptModal');
  const addDeptForm = document.getElementById('addDeptForm');
  const deptsTableBody = document.getElementById('deptsTableBody');
  // --- Budget Setting Logic ---
  if (btnSetBudget) {
    btnSetBudget.addEventListener('click', () => {
      newTotalBudgetInput.value = appState.totalBudget;
      budgetModal.classList.add('active');
    });
  }

  if (closeBudgetModal) {
    closeBudgetModal.addEventListener('click', () => {
      budgetModal.classList.remove('active');
    });
  }

  if (budgetForm) {
    budgetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newAmount = parseInt(newTotalBudgetInput.value);
      if (isNaN(newAmount) || newAmount < 0) return;

      try {
        const result = await updateTotalBudget(newAmount);
        if (result.success) {
          appState.totalBudget = newAmount;
          updateDisplays();
          budgetModal.classList.remove('active');
          showToast(`Budget pool updated to ₹${newAmount.toLocaleString()}`);
          renderAuditLog();
        }
      } catch (err) {
        console.error("Error updating budget:", err);
        showToast("Failed to update budget", true);
      }
    });
  }

  // --- Department Logic ---
  const deptNameInput = document.getElementById('newDeptName');
  const empCountInput = document.getElementById('newDeptEmpCount');
  const employeesList = document.getElementById('newDeptEmployeesList');
  const empHeader = document.getElementById('newDeptEmpHeader');
  const headContainer = document.getElementById('newDeptHeadContainer');
  const headSelect = document.getElementById('newDeptHeadSelect');

  const updateNewEmployeeIds = () => {
    const rows = employeesList.querySelectorAll('.emp-row');
    const deptTag = deptNameInput.value.trim().toUpperCase() || 'DEPT';
    rows.forEach((row, idx) => {
      const idInput = row.querySelector('.emp-id-display');
      if (idInput) idInput.value = `EMP-${deptTag}-${(idx + 1).toString().padStart(3, '0')}`;
    });
  };

  if (deptNameInput) deptNameInput.addEventListener('input', updateNewEmployeeIds);

  if (empCountInput) {
    empCountInput.addEventListener('input', (e) => {
      const count = parseInt(e.target.value) || 0;
      employeesList.innerHTML = '';
      headSelect.innerHTML = '<option value="" disabled selected>Select Department Head</option>';
      
      if (count > 0) {
        empHeader.style.display = 'grid';
        headContainer.style.display = 'block';
        
        const safeCount = Math.min(count, 50);
        for (let i = 1; i <= safeCount; i++) {
          const row = document.createElement('div');
          row.className = 'emp-row';
          row.style.display = 'grid';
          row.style.gridTemplateColumns = '1fr 1fr 120px';
          row.style.gap = '1rem';
          
          const deptTag = deptNameInput.value.trim().toUpperCase() || 'DEPT';
          const generatedId = `EMP-${deptTag}-${i.toString().padStart(3, '0')}`;

          row.innerHTML = `
            <input type="text" class="form-control emp-name-input" placeholder="Name" required>
            <input type="text" class="form-control emp-role-input" placeholder="Designation" value="Employee" required>
            <input type="text" class="form-control emp-id-display" value="${generatedId}" readonly style="background: rgba(255,255,255,0.05); color: var(--text-muted); cursor: not-allowed; text-align: center;">
          `;
          employeesList.appendChild(row);

          const nameInput = row.querySelector('.emp-name-input');
          nameInput.addEventListener('input', () => {
            const headOpt = headSelect.querySelector(`option[value="${generatedId}"]`);
            if (headOpt) {
              headOpt.textContent = nameInput.value || generatedId;
            } else {
              const opt = document.createElement('option');
              opt.value = generatedId;
              opt.textContent = nameInput.value || generatedId;
              headSelect.appendChild(opt);
            }
          });
        }
      } else {
        empHeader.style.display = 'none';
        headContainer.style.display = 'none';
      }
    });
  }

  if (btnAddDept) {
    btnAddDept.addEventListener('click', () => {
      addDeptModal.classList.add('active');
    });
  }

  if (closeAddDeptModal) {
    closeAddDeptModal.addEventListener('click', () => {
      addDeptModal.classList.remove('active');
    });
  }

  if (addDeptForm) {
    addDeptForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newDeptName').value;
      const priority = parseInt(document.getElementById('newDeptPriority').value);
      const headId = headSelect.value;
      
      const employeeData = [];
      employeesList.querySelectorAll('.emp-row').forEach((row) => {
        const empName = row.querySelector('.emp-name-input').value;
        const empRole = row.querySelector('.emp-role-input').value;
        const empId = row.querySelector('.emp-id-display').value;
        employeeData.push({
          empId,
          name: empName,
          role: empId === headId ? 'DeptHead' : 'Employee'
        });
      });

      try {
        await createDepartment(name, priority, roleState.role, employeeData);
        addDeptModal.classList.remove('active');
        addDeptForm.reset();
        employeesList.innerHTML = '';
        empHeader.style.display = 'none';
        headContainer.style.display = 'none';
        headSelect.innerHTML = '<option value="" disabled selected>Enter employees count first</option>';
        
        showToast(`Department '${name}' added successfully!`);
        loadBackendState();
      } catch (err) {
        console.error("Error creating department:", err);
        showToast(`Failed to add department: ${err.message}`, true);
      }
    });
  }
  
  // --- Local State ---
  let appState = { totalBudget: 0, allocatedBudget: 0, requests: [], departments: [] };

  // --- Utility Functions ---
  const formatCurrency = (amt) => '₹' + parseInt(amt).toLocaleString('en-IN');

  const showToast = (message, isEmergency) => {
    const toast = document.createElement('div');
    toast.className = `toast ${isEmergency ? 'emergency' : ''}`;
    toast.innerHTML = `
      <i class="fa-solid ${isEmergency ? 'fa-triangle-exclamation text-accent' : 'fa-circle-info'}" style="font-size: 1.2rem; color: ${isEmergency ? '#FF4785' : 'var(--accent-color)'}"></i>
      <span>${message}</span>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'fadeOutToast 0.4s forwards';
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  };

  const getDeptScore = (name) => {
    const d = appState.departments.find(x => x.name === name);
    return d ? d.priority_score : 0;
  };

  // --- Core Logic ---
  const updateDisplays = () => {
    if (!budgetDisplay || !priorityOrderDisplay) return;
    const available = appState.totalBudget - appState.allocatedBudget;
    budgetDisplay.textContent = formatCurrency(available);
    const deptNames = appState.departments.sort((a,b) => b.priority_score - a.priority_score).map(d => d.name);
    priorityOrderDisplay.textContent = deptNames.join(' > ');
  };

  const renderAuditLog = async () => {
    try {
      const logs = await fetchAuditLogs();
      if (!auditLogBody) return;
      auditLogBody.innerHTML = '';

      if (logs.length === 0) {
        auditLogBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No audit logs yet.</td></tr>`;
        return;
      }

      logs.forEach(log => {
        const actionKey = (log.action_type || 'UNKNOWN').replace(/-/g, '_').toUpperCase();
        const ts = new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="audit-action ${actionKey}">${(log.action_type || 'Unknown').replace(/_/g,' ')}</span></td>
          <td>${log.dept_name ? `<strong>${log.dept_name}</strong>` : `Request #${log.request_id || '—'}`}</td>
          <td><span class="priority-badge">${log.user_role}</span></td>
          <td style="max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${log.details || ''}">${log.details || '—'}</td>
          <td style="white-space:nowrap; color: var(--text-muted);">${ts}</td>
        `;
        auditLogBody.appendChild(tr);
      });
    } catch (err) {
      console.error("Error rendering audit logs:", err);
    }
  };

  const renderTable = () => {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    
    // Show all requests to Admin, including those pending at the department level
    let displayReqs = appState.requests;

    const searchTerm = searchInput.value.toLowerCase();
    displayReqs = displayReqs.filter(req => req.dept_name.toLowerCase().includes(searchTerm));

    const sortVal = sortSelect.value;
    
    displayReqs.sort((a, b) => {
      if (sortVal === 'priority_auto') {
        if (a.emergency && !b.emergency) return -1;
        if (!a.emergency && b.emergency) return 1;
        if (a.emergency && b.emergency) return new Date(a.created_at) - new Date(b.created_at);
        const pA = getDeptScore(a.dept_name);
        const pB = getDeptScore(b.dept_name);
        if (pA !== pB) return pB - pA;
        return new Date(a.created_at) - new Date(b.created_at);
      }
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      if (sortVal === 'date_desc') return dateB - dateA;
      if (sortVal === 'date_asc') return dateA - dateB;
      if (sortVal === 'amount_desc') return b.amount - a.amount;
      if (sortVal === 'amount_asc') return a.amount - b.amount;
      if (sortVal === 'emergency') {
        if (a.emergency && !b.emergency) return -1;
        if (!a.emergency && b.emergency) return 1;
        return dateB - dateA;
      }
      return 0;
    });

    displayReqs.forEach(req => {
      const tr = document.createElement('tr');
      let statusClass = 'pending';
      let statusText = 'Pending Allocation';
      if (req.status === 'Approved') { statusClass = 'success'; statusText = 'Approved'; }
      if (req.status === 'Rejected') { statusClass = 'rejected'; statusText = 'Rejected'; }

      let actionsHtml = '';
      if (req.status === 'Pending_Admin' || req.status === 'Pending_Dept') {
        actionsHtml = `
          <div class="action-btns">
            <button class="btn-icon approve" title="Approve" data-id="${req.id}"><i class="fa-solid fa-check"></i></button>
            <button class="btn-icon modify" title="Modify" data-id="${req.id}"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-icon reject" title="Reject" data-id="${req.id}"><i class="fa-solid fa-xmark"></i></button>
          </div>
        `;
      } else {
        actionsHtml = `<span style="color: var(--text-muted); font-size: 0.85rem;">Processed</span>`;
      }

      const discussHtml = `<button class="btn-icon discuss" title="Discussion Thread" data-id="${req.id}" data-dept="${req.dept_name}" data-reason="${req.reason.substring(0,40)}..."><i class="fa-solid fa-comments"></i></button>`;

      let priorityHTML = '';
      if (req.status === 'Pending_Admin' || req.status === 'Pending_Dept') {
        if (req.emergency) {
          priorityHTML = `<span class="priority-badge" style="color:#FF4785; border-color:#FF4785;">Priority 1 (Emergency)</span>`;
        } else {
          priorityHTML = `<span class="priority-badge">Score: ${getDeptScore(req.dept_name)}</span>`;
        }
      }

      tr.innerHTML = `
        <td><strong>${req.dept_name}</strong> ${priorityHTML}</td>
        <td class="text-accent">${formatCurrency(req.amount)}</td>
        <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${req.reason}">${req.reason}</td>
        <td>${req.emergency ? '<span style="color: #FF4785; font-weight: 500;"><i class="fa-solid fa-fire"></i> Yes</span>' : '<span style="color: var(--text-muted);">No</span>'}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>${actionsHtml}</td>
        <td>${discussHtml}</td>
      `;
      tableBody.appendChild(tr);
    });

    attachActionListeners();
    renderAuditLog();
    renderDeptsTable();
  };

  const renderDeptsTable = () => {
    if (!deptsTableBody) return;
    deptsTableBody.innerHTML = '';
    
    if (!appState.departments || appState.departments.length === 0) {
      deptsTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No departments found.</td></tr>`;
      return;
    }

    appState.departments.forEach(dept => {
      const tr = document.createElement('tr');
      const allocated = appState.requests
        .filter(r => r.dept_name === dept.name && r.status === 'Approved')
        .reduce((sum, r) => sum + r.amount, 0);

      tr.innerHTML = `
        <td><strong>${dept.name}</strong></td>
        <td><span class="priority-badge">Score: ${dept.priority_score}</span></td>
        <td><span class="status-badge success">Active</span></td>
        <td><span class="text-accent">${formatCurrency(allocated)} Allocated</span></td>
      `;
      deptsTableBody.appendChild(tr);
    });
  };

  const loadBackendState = async () => {
    try {
      const roleState = getLocalRoleState();
      appState = await fetchState(roleState.role, roleState.dept);
      updateDisplays();
      renderTable();
    } catch (err) {
      console.error("Error loading backend state:", err);
    }
  };

  // --- Initial Execution ---
  await loadBackendState();

  // --- Socket Listeners ---
  socket.on('REQUEST_UPDATED', loadBackendState);
  socket.on('BUDGET_UPDATED', (newState) => {
    appState.totalBudget = newState.totalBudget;
    appState.allocatedBudget = newState.allocatedBudget;
    updateDisplays();
  });
  socket.on('AUDIT_LOG_ADDED', renderAuditLog);
  socket.on('COMMENT_ADDED', ({ requestId }) => {
    if (currentNegotiationId === requestId) loadComments(requestId);
  });

  // --- UI Interactivity ---
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
  });

  const roleBtns = document.querySelectorAll('.role-btn');
  const setRole = (role) => {
    const currentState = getLocalRoleState();
    setLocalRoleState(role, currentState.dept);
    roleBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-role') === role);
    });
    if (role !== 'Admin') window.location.href = '/dashboard.html';
  };

  roleBtns.forEach(btn => {
    btn.addEventListener('click', (e) => setRole(e.target.getAttribute('data-role')));
  });
  setRole('Admin');

  // --- Negotiation Logic ---
  let currentNegotiationId = null;
  const negotiationModal = document.getElementById('negotiationModal');
  const commentsThread = document.getElementById('commentsThread');
  const commentForm = document.getElementById('commentForm');

  async function loadComments(reqId) {
    if (!commentsThread) return;
    commentsThread.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85rem;">Loading...</span>`;
    const comments = await fetchComments(reqId);
    commentsThread.innerHTML = '';
    if (comments.length === 0) {
      commentsThread.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85rem;">No comments yet. Start the discussion below.</span>`;
      return;
    }
    comments.forEach(c => {
      const ts = new Date(c.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
      const div = document.createElement('div');
      div.className = `comment-bubble by-${c.user_role}`;
      div.innerHTML = `
        <div class="comment-meta">
          <span class="comment-role">${c.user_role}</span>
          <span>${ts}</span>
        </div>
        <p style="margin:0;">${c.comment}</p>
      `;
      commentsThread.appendChild(div);
    });
    commentsThread.scrollTop = commentsThread.scrollHeight;
  }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.discuss');
    if (!btn) return;
    const id = parseInt(btn.getAttribute('data-id'));
    const dept = btn.getAttribute('data-dept');
    const reason = btn.getAttribute('data-reason');
    currentNegotiationId = id;
    document.getElementById('negotiationReqInfo').textContent = `${dept} — "${reason}"`;
    await loadComments(id);
    negotiationModal.classList.add('active');
  });

  document.getElementById('closeNegotiationModal').addEventListener('click', () => {
    negotiationModal.classList.remove('active');
    currentNegotiationId = null;
  });

  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const commentInput = document.getElementById('commentInput');
    const text = commentInput.value.trim();
    if (!text || !currentNegotiationId) return;
    const roleState = getLocalRoleState();
    await addComment(currentNegotiationId, roleState.role, text);
    commentInput.value = '';
    await loadComments(currentNegotiationId);
  });

  // --- Allocation Actions ---
  if (btnAutoAllocate) {
    btnAutoAllocate.addEventListener('click', async () => {
      const btnIcon = btnAutoAllocate.innerHTML;
      btnAutoAllocate.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Allocating...';
      try {
        const result = await runAutoAllocation('Admin');
        showToast(`Auto-Allocation Complete! Approved: ${result.approved}. Rejected (Insufficient Funds): ${result.rejected}.`, result.approved > 0);
      } catch (e) {
        showToast(`Error: ${e.message}`, true);
      } finally {
        btnAutoAllocate.innerHTML = btnIcon;
      }
    });
  }

  let currentActionId = null;
  const conflictModal = document.getElementById('conflictModal');
  const modifyModal = document.getElementById('modifyModal');

  function attachActionListeners() {
    document.querySelectorAll('.btn-icon.approve').forEach(btn => {
      btn.addEventListener('click', (e) => handleApprove(parseInt(e.currentTarget.getAttribute('data-id'))));
    });
    document.querySelectorAll('.btn-icon.reject').forEach(btn => {
      btn.addEventListener('click', (e) => handleReject(parseInt(e.currentTarget.getAttribute('data-id'))));
    });
    document.querySelectorAll('.btn-icon.modify').forEach(btn => {
      btn.addEventListener('click', (e) => openModifyModal(parseInt(e.currentTarget.getAttribute('data-id'))));
    });
  }

  async function handleApprove(id) {
    const req = appState.requests.find(r => r.id === id);
    if (!req) return;
    const available = appState.totalBudget - appState.allocatedBudget;
    if (req.amount > available) {
      currentActionId = id;
      document.getElementById('conflictDept').textContent = req.dept_name;
      document.getElementById('conflictAmount').textContent = formatCurrency(req.amount);
      document.getElementById('conflictAvailable').textContent = formatCurrency(available);
      document.getElementById('conflictDeficit').textContent = formatCurrency(req.amount - available);
      conflictModal.classList.add('active');
    } else {
      await updateRequestStatus(id, 'Approved', 'Admin');
      showToast('Request Manually Approved.', false);
    }
  }

  async function handleReject(id) {
    await updateRequestStatus(id, 'Rejected', 'Admin');
    showToast('Request Manually Rejected.', false);
  }

  function openModifyModal(id) {
    currentActionId = id;
    const req = appState.requests.find(r => r.id === id);
    if (req) {
      document.getElementById('modDeptName').value = req.dept_name;
      document.getElementById('modAmount').value = req.amount;
      modifyModal.classList.add('active');
    }
  }

  document.getElementById('closeModifyModal').addEventListener('click', () => {
    modifyModal.classList.remove('active');
    currentActionId = null;
  });

  document.getElementById('modifyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newAmount = parseInt(document.getElementById('modAmount').value);
    if (newAmount > 0 && currentActionId) {
      try {
        await updateRequestStatus(currentActionId, 'Approved', 'Admin', newAmount);
        showToast('Request Modified and Approved.', false);
        modifyModal.classList.remove('active');
        currentActionId = null;
      } catch(e) {
        showToast(e.message, true);
      }
    }
  });

  document.getElementById('btnCancelApproval').addEventListener('click', () => {
    conflictModal.classList.remove('active');
    currentActionId = null;
  });

  document.getElementById('btnForceModify').addEventListener('click', () => {
    conflictModal.classList.remove('active');
    if (currentActionId) openModifyModal(currentActionId);
  });

  searchInput.addEventListener('input', renderTable);
  sortSelect.addEventListener('change', renderTable);
});
