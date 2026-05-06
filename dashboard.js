// CSS handled via HTML link
// Chart handled via global Chart from CDN
import { socket, fetchState, createRequest, updateRequestStatus, fetchAuditLogs, getLocalRoleState, setLocalRoleState } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
  const roleState = getLocalRoleState();
  if (!roleState || !roleState.empId || (roleState.empId === 'EMP-IT-001' && !localStorage.getItem('zoro_user'))) {
    // Check if it's the default mock state and no real user is logged in
    window.location.href = '/login.html';
    return;
  }

  if (roleState.role === 'Admin') {
    window.location.href = '/admin.html';
    return;
  }

  // Initialize Global Background - Disabled for static background
  // initAurora();

  // --- State ---
  let appState = {
    totalBudget: 0,
    allocatedBudget: 0,
    requests: [],
    departments: []
  };
  let charts = {
    line: null,
    bar: null,
    doughnut: null,
    pie: null
  };
  let notifications = [];
  let unreadCount = 0;

  // --- Element Selections ---
  const viewSections = document.querySelectorAll('.view-section');
  const budgetDisplays = {
    total: document.getElementById('dispTotalBudget'),
    allocated: document.getElementById('dispAllocatedBudget'),
    remaining: document.getElementById('dispRemainingBudget')
  };
  const requestsTableBody = document.getElementById('requestsTableBody');
  const auditLogsBody = document.getElementById('auditLogsBody');
  const toastContainer = document.getElementById('toastContainer');

  // Hub specific selections
  const btnBudgetPool = document.getElementById('btnBudgetPool');
  const btnBudgetHistory = document.getElementById('btnBudgetHistory');
  const btnRequestBudget = document.getElementById('btnRequestBudget');

  // Notification selections
  const notificationBtn = document.getElementById('notificationBtn');
  const notificationDropdown = document.getElementById('notificationDropdown');
  const notifList = document.getElementById('notifList');
  const notifBadge = document.getElementById('notifBadge');
  const clearNotifsBtn = document.getElementById('clearNotifs');

  // --- Utility Functions ---
  const formatCurrency = (amt) => '₹' + parseInt(amt || 0).toLocaleString('en-IN');

  const showToast = (message, isEmergency = false) => {
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

  // --- View Switching ---
  window.switchView = (viewId) => {
    viewSections.forEach(section => {
      section.classList.toggle('active', section.id === `${viewId}-view`);
    });

    // Refresh view-specific data
    if (viewId === 'dashboard') updateAnalytics();
    if (viewId === 'budget-details') renderBudgetDetails();
    if (viewId === 'audit') renderAuditLogs();
    if (viewId === 'settings') renderSettings();
  };

  // Add click listeners to Hub cards
  if (btnBudgetPool) btnBudgetPool.onclick = () => window.switchView('budget-details');
  if (btnBudgetHistory) btnBudgetHistory.onclick = () => window.switchView('audit');
  if (btnRequestBudget) btnRequestBudget.onclick = () => window.switchView('budget-request');

  const renderSettings = () => {
    const user = getLocalRoleState();
    const nameEl = document.getElementById('settingsUserName');
    const roleEl = document.getElementById('settingsUserRole');
    const compEl = document.getElementById('settingsCompany');
    const empEl = document.getElementById('settingsEmpId');

    if (nameEl) nameEl.textContent = user.empId;
    if (roleEl) roleEl.textContent = user.role;
    if (compEl) compEl.textContent = user.companyName || 'ZORO Network';
    if (empEl) empEl.textContent = user.empId;

    const priorityList = document.getElementById('prioritySettingsList');
    if (!priorityList) return;
    priorityList.innerHTML = '';

    if (appState && appState.departments) {
      appState.departments.forEach(dept => {
        const div = document.createElement('div');
        div.className = 'dept-priority-item';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.innerHTML = `
          <span>${dept.name}</span>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <input type="range" min="1" max="10" value="${dept.priority_score}" class="priority-range">
            <span style="width: 20px; font-weight: 600; color: var(--accent-color);">${dept.priority_score}</span>
          </div>
        `;
        priorityList.appendChild(div);
      });
    }

    const settingsTotalBudget = document.getElementById('settingsTotalBudget');
    if (settingsTotalBudget && appState) {
      settingsTotalBudget.value = appState.totalBudget;
    }
  };

  // --- Data Logic ---
  const loadBackendState = async () => {
    try {
      const roleState = getLocalRoleState();
      appState = await fetchState(roleState.role, roleState.dept);
      updateGlobalUI();
      // Initial render for current active view
      const activeNav = document.querySelector('.nav-item.active');
      if (activeNav) switchView(activeNav.getAttribute('data-view'));
    } catch (err) {
      console.error("Error loading state:", err);
    }
  };

  const updateGlobalUI = () => {
    const roleState = getLocalRoleState();
    const available = appState.totalBudget - appState.allocatedBudget;

    // Update Budget Overview (Syncing Pool card with Available amount)
    if (budgetDisplays.total) budgetDisplays.total.textContent = formatCurrency(available);
    if (budgetDisplays.allocated) budgetDisplays.allocated.textContent = formatCurrency(appState.allocatedBudget);
    if (budgetDisplays.remaining) budgetDisplays.remaining.textContent = formatCurrency(available);

    const detailsTotal = document.getElementById('detailsTotalBudget');
    if (detailsTotal) detailsTotal.textContent = formatCurrency(appState.totalBudget);

    // Populate Personal Info Section
    const empId = document.getElementById('displayEmpId');
    const empName = document.getElementById('displayEmpName');
    const empRole = document.getElementById('displayEmpRole');
    const empSalary = document.getElementById('displayEmpSalary');

    if (empId && empName && empRole) {
      empId.textContent = roleState.empId || 'N/A';
      empName.textContent = roleState.role === 'Admin' ? 'Admin Master' : (roleState.empName || 'Employee');
      empRole.textContent = roleState.role === 'Admin' ? 'Administrator' : `Dept: ${roleState.dept}`;

      const salaryMap = { 'Admin': '₹1,50,000', 'DeptHead': '₹95,000', 'Employee': '₹65,000' };
      empSalary.textContent = salaryMap[roleState.role] || '₹0';
    }
  };

  // --- Render Functions ---

  window.approveRequest = async (id) => {
    try {
      await updateRequestStatus(id, 'Pending_Admin', roleState.role);
      showToast('Request forwarded to Admin successfully!');
      loadBackendState();
    } catch (err) {
      showToast('Failed to forward request: ' + err.message, true);
    }
  };

  const renderRequests = (filter = 'pending') => {
    if (!requestsTableBody) return;
    requestsTableBody.innerHTML = '';

    const roleState = getLocalRoleState();
    let displayReqs = appState.requests;

    // Filter by tab
    if (filter === 'pending') displayReqs = displayReqs.filter(r => r.status.includes('Pending'));
    else if (filter === 'approved') displayReqs = displayReqs.filter(r => r.status === 'Approved');
    else if (filter === 'rejected') displayReqs = displayReqs.filter(r => r.status === 'Rejected');

    // If Employee, only show their dept
    if (roleState.role === 'Employee') {
      displayReqs = displayReqs.filter(r => r.dept_name === roleState.dept);
    }

    displayReqs.forEach(req => {
      const tr = document.createElement('tr');
      const ts = new Date(req.created_at).toLocaleDateString('en-IN');
      tr.innerHTML = `
        <td><strong>${req.dept_name}</strong></td>
        <td title="${req.reason}">${req.reason.substring(0, 30)}...</td>
        <td class="text-accent">${formatCurrency(req.amount)}</td>
        <td style="color: var(--text-muted); font-size: 0.85rem;">${ts}</td>
        <td><span class="status-badge ${req.status.toLowerCase()}">${req.status.replace('_', ' ')}</span></td>
        <td>${req.status === 'Pending_Dept' && roleState.role === 'DeptHead' ? `<button class="btn btn-primary btn-sm" onclick="window.approveRequest(${req.id})">Forward</button>` : '—'}</td>
      `;
      requestsTableBody.appendChild(tr);
    });
  };

  // (Orphaned renderDepartments function removed)

  const renderAuditLogs = async () => {
    try {
      const logs = await fetchAuditLogs();
      if (!auditLogsBody) return;
      auditLogsBody.innerHTML = '';
      logs.slice(0, 20).forEach(log => {
        const tr = document.createElement('tr');
        const ts = new Date(log.created_at).toLocaleString('en-IN', { timeStyle: 'short', dateStyle: 'short' });
        tr.innerHTML = `
          <td><span class="audit-action ${log.action_type}">${log.action_type.replace(/_/g, ' ')}</span></td>
          <td>${log.user_role}</td>
          <td>${log.dept_name || 'System'}</td>
          <td style="font-size: 0.85rem; color: var(--text-muted);">${log.details || '—'}</td>
          <td style="font-size: 0.8rem; color: rgba(255,255,255,0.2);">${ts}</td>
        `;
        auditLogsBody.appendChild(tr);
      });
    } catch (err) { console.error(err); }
  };

  // (Orphaned renderConflicts function removed)

  const renderBudgetDetails = () => {
    const pieCtx = document.getElementById('detailsPieChart');
    if (!pieCtx) return;

    if (charts.pie) charts.pie.destroy();

    const selectedMonth = parseInt(document.getElementById('selectMonth').value);
    const selectedYear = parseInt(document.getElementById('selectYear').value);

    const depts = appState.departments;
    
    // If no departments, we can't show anything
    if (!depts || depts.length === 0) {
      pieCtx.parentElement.innerHTML = '<div style="height:100%; display:flex; align-items:center; justify-content:center; color:var(--text-muted);">No departments found.</div>';
      return;
    }

    const deptData = depts.map((d, index) => {
      let allocated = appState.requests
        .filter(r => {
          const rDate = new Date(r.created_at);
          return r.dept_name === d.name &&
            r.status === 'Approved' &&
            rDate.getMonth() === selectedMonth &&
            rDate.getFullYear() === selectedYear;
        })
        .reduce((sum, r) => sum + (r.amount || 0), 0);
      
      // FOR NOW: Use mock values if zero (as requested) 
      // This ensures the chart is visible even without data
      if (allocated === 0) {
        const mockValues = [150000, 250000, 350000, 450000, 200000];
        allocated = mockValues[index % mockValues.length];
      }

      return { name: d.name, amount: allocated };
    });

    const colors = [
      '#00E5FF', '#1DE9B6', '#7367F0', '#FF4785', '#FF8A65', '#FFC107', 
      '#9C27B0', '#00BCD4', '#4CAF50', '#FFEB3B', '#FF5722', '#607D8B'
    ];

    charts.pie = new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: deptData.map(d => d.name),
        datasets: [{
          data: deptData.map(d => d.amount),
          backgroundColor: colors.slice(0, deptData.length),
          borderColor: 'rgba(15, 20, 35, 0.8)',
          borderWidth: 2,
          hoverOffset: 15
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#a0abc0',
              font: { family: "'Poppins', sans-serif", size: 12 },
              padding: 20,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 20, 35, 0.95)',
            titleFont: { size: 14, weight: '600' },
            bodyFont: { size: 13 },
            padding: 12,
            displayColors: true,
            callbacks: {
              label: (context) => {
                const val = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${formatCurrency(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  };

  // Add listeners for month/year changes
  const selectMonth = document.getElementById('selectMonth');
  const selectYear = document.getElementById('selectYear');
  const btnFetchHistory = document.getElementById('btnFetchHistory');

  if (selectMonth) selectMonth.value = new Date().getMonth();
  if (selectYear) selectYear.value = new Date().getFullYear();

  if (btnFetchHistory) {
    btnFetchHistory.onclick = () => renderBudgetDetails();
  }



  // --- Charts Logic ---
  const updateAnalytics = () => {
    const ctx = document.getElementById('budgetLineChart');
    if (!ctx) return;

    if (charts.line) charts.line.destroy();

    // Generate dynamic labels for last 6 months
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const labels = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(monthNames[d.getMonth()]);
    }

    // Generate realistic trend data based on current allocation
    // We scale the mock history to be a percentage of the total budget 
    // so it doesn't dwarf the actual current usage data point.
    const baseline = appState.totalBudget * 0.1; // 10% baseline
    const currentUsage = appState.allocatedBudget;

    // Mock growth trend leading up to current usage
    const usageData = [
      baseline * 0.4,
      baseline * 0.6,
      baseline * 0.5,
      baseline * 0.8,
      baseline * 0.95,
      currentUsage
    ];

    charts.line = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Budget Usage',
          data: usageData,
          borderColor: '#00E5FF',
          backgroundColor: 'rgba(0, 229, 255, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#00E5FF',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 20, 35, 0.9)',
            titleColor: '#00E5FF',
            bodyColor: '#fff',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context) => `Usage: ${formatCurrency(context.parsed.y)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.03)' },
            ticks: {
              color: '#a0abc0',
              callback: (value) => value >= 1000000 ? (value / 1000000).toFixed(1) + 'M' : (value / 1000).toFixed(0) + 'K'
            }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#a0abc0' }
          }
        }
      }
    });
  };

  // (Orphaned addActivity function and renderAdvancedCharts function removed)

  // --- Tab Listeners ---
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderRequests(btn.getAttribute('data-tab'));
    });
  });

  // --- Initial Load ---
  await loadBackendState();

  // --- Notifications Logic ---
  const addNotification = (title, message, type = 'pending') => {
    notifications.unshift({
      id: Date.now(),
      title,
      message,
      type,
      time: 'Just now'
    });
    unreadCount++;
    updateNotifUI();
  };

  const updateNotifUI = () => {
    if (!notifList || !notifBadge) return;

    notifBadge.textContent = unreadCount;
    notifBadge.style.display = unreadCount > 0 ? 'flex' : 'none';

    if (notifications.length === 0) {
      notifList.innerHTML = '<div class="notif-empty">No new notifications</div>';
      return;
    }

    notifList.innerHTML = notifications.map(n => `
      <div class="notif-item">
        <div class="notif-icon ${n.type}">
          <i class="fa-solid ${n.type === 'approved' ? 'fa-check' : (n.type === 'rejected' ? 'fa-xmark' : 'fa-clock')}"></i>
        </div>
        <div class="notif-content">
          <h5>${n.title}</h5>
          <p>${n.message}</p>
          <div class="notif-time">${n.time}</div>
        </div>
      </div>
    `).join('');
  };

  if (notificationBtn) {
    notificationBtn.onclick = (e) => {
      e.stopPropagation();
      notificationDropdown.classList.toggle('show');
      unreadCount = 0;
      updateNotifUI();
    };
  }

  if (clearNotifsBtn) {
    clearNotifsBtn.onclick = () => {
      notifications = [];
      unreadCount = 0;
      updateNotifUI();
    };
  }

  // --- Socket Events ---
  socket.on('REQUEST_UPDATED', () => {
    loadBackendState();
  });

  socket.on('STATUS_NOTIFICATION', (data) => {
    const roleState = getLocalRoleState();
    // Only notify if it's for this user's department
    if (data.dept === roleState.dept) {
      const statusType = data.status.toLowerCase();
      const title = `Budget ${data.status}`;
      const message = `Your request of ₹${parseInt(data.amount).toLocaleString()} for ${data.dept} has been ${statusType}.`;

      addNotification(title, message, statusType === 'approved' ? 'approved' : 'rejected');
      showToast(message, statusType === 'rejected');
    }
  });

  socket.on('BUDGET_UPDATED', () => {
    loadBackendState();
    addNotification('Budget Updated', 'Global budget allocation has been adjusted.', 'pending');
  });

  // --- Hub Request Form Submission ---
  const requestModal = document.getElementById('requestModal');
  const closeRequestModal = document.getElementById('closeRequestModal');
  const requestForm = document.getElementById('budgetRequestForm');

  if (closeRequestModal) closeRequestModal.onclick = () => requestModal.classList.remove('active');

  if (requestForm) {
    requestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = document.getElementById('requestAmount').value;
      const reason = document.getElementById('requestReason').value;
      const emergencyEl = document.getElementById('emergencyToggle');
      const emergency = emergencyEl ? emergencyEl.checked : false;
      const roleState = getLocalRoleState();

      try {
        await createRequest({
          dept: roleState.dept,
          amount: amount,
          reason: reason,
          emergency: emergency,
          role: roleState.role
        });
        requestForm.reset();
        requestModal.classList.remove('active');
        showToast('Request submitted successfully!');
      } catch (err) {
        showToast('Submission failed.', true);
      }
    });
  }

  // --- Hub Request Form Submission ---
  const hubRequestForm = document.getElementById('hubBudgetRequestForm');
  if (hubRequestForm) {
    hubRequestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = document.getElementById('hubRequestAmount').value;
      const reason = document.getElementById('hubRequestReason').value;
      const emergencyEl = document.getElementById('hubEmergencyToggle');
      const emergency = emergencyEl ? emergencyEl.checked : false;
      const roleState = getLocalRoleState();

      try {
        await createRequest({
          dept: roleState.dept,
          amount: parseInt(amount),
          reason: reason,
          emergency: emergency,
          role: roleState.role
        });
        hubRequestForm.reset();
        showToast('Budget request submitted successfully!');
        window.switchView('dashboard'); // Return to hub
      } catch (err) {
        showToast('Submission failed: ' + err.message, true);
      }
    });
  }

  // --- Role Switcher ---
  const roleBtns = document.querySelectorAll('.role-btn');
  roleBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const newRole = e.target.getAttribute('data-role');
      if (!newRole) return;
      const curState = getLocalRoleState();
      setLocalRoleState(newRole, curState.dept);
      window.location.reload(); // Refresh to re-initialize with new role logic
    });
  });

  // Profile Dropdown
  const profileDropdownBtn = document.getElementById('profileDropdownBtn');
  const profileMenu = document.getElementById('profileMenu');
  if (profileDropdownBtn) {
    profileDropdownBtn.onclick = (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle('show');
    };
  }
  document.onclick = () => profileMenu?.classList.remove('show');
});
