// CSS handled via HTML link
import { initAurora } from './anoai.js';
import { onboardCompany } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  // Get pending registration data
  const pendingReg = JSON.parse(localStorage.getItem('zoro_pending_reg'));
  if (!pendingReg) {
    window.location.href = '/register.html';
    return;
  }

  // Set generated Admin ID
  const empIdElement = document.getElementById('generatedEmpId');
  empIdElement.textContent = pendingReg.empId;
  
  // Set welcome message with company name
  const welcomeSubtitle = document.querySelector('.auth-subtitle');
  if (welcomeSubtitle) welcomeSubtitle.textContent = `${pendingReg.companyName} setup begins now.`;

  // Department Generation Logic
  const deptCountInput = document.getElementById('deptCount');
  const dynamicDepartments = document.getElementById('dynamicDepartments');

  deptCountInput.addEventListener('input', (e) => {
    const count = parseInt(e.target.value) || 0;
    const safeCount = Math.min(Math.max(count, 0), 20);
    dynamicDepartments.innerHTML = '';

    for (let i = 1; i <= safeCount; i++) {
      const card = document.createElement('div');
      card.className = 'dept-card';
      card.style.animationDelay = `${i * 0.05}s`;

      card.innerHTML = `
        <h4>Department ${i}</h4>
        <div class="form-row">
          <div class="form-group half-width">
            <label>Department Name</label>
            <input type="text" class="form-control dept-name" placeholder="e.g. Marketing" required>
          </div>
          <div class="form-group half-width">
            <label>Number of Employees</label>
            <input type="number" class="form-control emp-count-input" min="1" placeholder="e.g. 5" required>
          </div>
        </div>
        
        <!-- Employee Header -->
        <div class="employee-header-row" style="display: grid; grid-template-columns: 1fr 1fr 120px; gap: 1rem; margin-top: 1rem; padding: 0 1rem; opacity: 0.6; font-size: 0.8rem; font-weight: 600; text-transform: uppercase;">
          <span>Full Name</span>
          <span>Role / Designation</span>
          <span>Employee ID</span>
        </div>

        <div class="employees-list" style="margin-top: 0.5rem; border-left: 2px solid var(--glass-border); padding-left: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
        </div>
        
        <div class="form-group" style="margin-top: 1.5rem;">
          <label>Assign Department Head</label>
          <select class="form-control head-select" required>
            <option value="" disabled selected>Enter employees count first</option>
          </select>
        </div>
      `;

      const deptNameInput = card.querySelector('.dept-name');
      const empCountInput = card.querySelector('.emp-count-input');
      const employeesList = card.querySelector('.employees-list');
      const headSelect = card.querySelector('.head-select');

      const updateEmployeeIds = () => {
        const rows = employeesList.querySelectorAll('.emp-row');
        const deptTag = deptNameInput.value.trim().toUpperCase() || 'DEPT' + i;
        rows.forEach((row, idx) => {
          const idInput = row.querySelector('.emp-id-display');
          idInput.value = `EMP-${deptTag}-${(idx + 1).toString().padStart(3, '0')}`;
        });
      };

      deptNameInput.addEventListener('input', updateEmployeeIds);

      empCountInput.addEventListener('input', (ev) => {
        const empCount = parseInt(ev.target.value) || 0;
        employeesList.innerHTML = '';
        headSelect.innerHTML = '<option value="" disabled selected>Select Department Head</option>';
        
        if (empCount > 0) {
          const maxList = Math.min(empCount, 50);
          for (let e = 1; e <= maxList; e++) {
            const empRow = document.createElement('div');
            empRow.className = 'emp-row';
            empRow.style.display = 'grid';
            empRow.style.gridTemplateColumns = '1fr 1fr 120px';
            empRow.style.gap = '1rem';
            
            const deptTag = deptNameInput.value.trim().toUpperCase() || 'DEPT' + i;
            const generatedId = `EMP-${deptTag}-${e.toString().padStart(3, '0')}`;

            empRow.innerHTML = `
              <input type="text" class="form-control emp-name-input" placeholder="Name" required>
              <input type="text" class="form-control emp-role-input" placeholder="e.g. Lead" required>
              <input type="text" class="form-control emp-id-display" value="${generatedId}" readonly style="background: rgba(255,255,255,0.05); color: var(--accent-color); font-family: monospace; font-weight: 600; text-align: center;">
            `;
            employeesList.appendChild(empRow);

            const option = document.createElement('option');
            option.value = generatedId;
            option.id = `opt_dept${i}_emp${e}`;
            option.textContent = `Employee ${e}`;
            headSelect.appendChild(option);

            const nameInput = empRow.querySelector('.emp-name-input');
            nameInput.addEventListener('input', (eInput) => {
              const val = eInput.target.value.trim();
              const targetOption = headSelect.querySelector(`#opt_dept${i}_emp${e}`);
              if (targetOption) {
                targetOption.textContent = val ? val : `Employee ${e}`;
              }
            });
          }
        }
      });
      dynamicDepartments.appendChild(card);
    }
  });

  // Form Submission
  const setupForm = document.getElementById('setupForm');
  const successModal = document.getElementById('successModal');

  setupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = document.getElementById('completeBtn');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving Setup...';
    btn.disabled = true;

    // Collect Department Data
    const deptCards = document.querySelectorAll('.dept-card');
    const departments = Array.from(deptCards).map(card => {
      const name = card.querySelector('.dept-name').value;
      const empRows = card.querySelectorAll('.emp-row');
      const employees = Array.from(empRows).map(row => ({ 
        name: row.querySelector('.emp-name-input').value,
        role: row.querySelector('.emp-role-input').value,
        empId: row.querySelector('.emp-id-display').value
      }));
      return { name, employees, priority: 5 };
    });

    onboardCompany({
      companyName: pendingReg.companyName,
      departments
    })
    .then(data => {
      if (data.error) {
        alert('Onboarding failed: ' + data.message);
        btn.innerHTML = 'Complete Registration';
        btn.disabled = false;
      } else {
        successModal.classList.add('active');
        localStorage.removeItem('zoro_pending_reg');
        setTimeout(() => {
          window.location.href = '/login.html';
        }, 2000);
      }
    })
    .catch(err => {
      alert('Server connection failed');
      btn.innerHTML = 'Complete Registration';
      btn.disabled = false;
    });
  });
});
