// CSS handled via HTML link
import { initAurora } from './anoai.js';
import { loginUser } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  // initAurora();
  // Sticky Navbar Logic (reused from main.js)
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // Password Toggle
  const togglePassword = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');

  if (togglePassword) {
    togglePassword.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      
      // Toggle icon
      const icon = togglePassword.querySelector('i');
      if (type === 'text') {
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    });
  }

  // Form Validation and Mock Auth
  const loginForm = document.getElementById('loginForm');
  const companyName = document.getElementById('companyName');
  const employeeId = document.getElementById('employeeId');
  const password = document.getElementById('password');

  const loginCompanyError = document.getElementById('loginCompanyError');
  const loginEmpError = document.getElementById('loginEmpError');
  const loginPasswordError = document.getElementById('loginPasswordError');

  const roleModal = document.getElementById('roleModal');
  const roleTitle = document.getElementById('roleTitle');
  const roleMessage = document.getElementById('roleMessage');

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let isValid = true;

    // Reset Errors
    loginCompanyError.textContent = '';
    loginEmpError.textContent = '';
    loginPasswordError.textContent = '';

    if (!companyName.value.trim()) {
      loginCompanyError.textContent = 'Company Name is required';
      isValid = false;
    }

    if (!employeeId.value.trim()) {
      loginEmpError.textContent = 'Employee ID is required';
      isValid = false;
    }

    if (!password.value.trim()) {
      loginPasswordError.textContent = 'Password is required';
      isValid = false;
    }

    if (isValid) {
      const btn = document.getElementById('loginBtn');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';
      btn.disabled = true;

      loginUser({
        companyName: companyName.value.trim(),
        empId: employeeId.value.trim(),
        password: password.value.trim()
      })
      .then(data => {
        if (data.error) {
          loginEmpError.textContent = data.message;
          btn.innerHTML = originalText;
          btn.disabled = false;
        } else {
          // Success
          roleTitle.textContent = `Welcome, ${data.role}`;
          roleMessage.textContent = data.role === 'Admin' 
            ? 'Redirecting to Master Dashboard (Full Access)...' 
            : 'Redirecting to Departmental Dashboard (Restricted Access)...';
            
          roleModal.classList.add('active');

          // Save user state
          localStorage.setItem('zoro_user', JSON.stringify({
            empId: data.empId,
            role: data.role,
            dept: data.department,
            companyName: data.companyName
          }));

          setTimeout(() => {
            if (data.role === 'Admin') {
              window.location.href = '/admin.html';
            } else {
              window.location.href = '/dashboard.html';
            }
          }, 1500);
        }
      })
      .catch(err => {
        loginEmpError.textContent = 'Server connection failed';
        btn.innerHTML = originalText;
        btn.disabled = false;
      });
    }
  });
});
