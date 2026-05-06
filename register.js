// CSS handled via HTML link
import { initAurora } from './anoai.js';
import { registerUser } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  // Sticky Navbar Logic
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // Form Elements
  const registerForm = document.getElementById('registerForm');
  const companyName = document.getElementById('companyName');
  const mobileNumber = document.getElementById('mobileNumber');
  const email = document.getElementById('email');
  const password = document.getElementById('password');
  
  // Error Elements
  const companyNameError = document.getElementById('companyNameError');
  const mobileNumberError = document.getElementById('mobileNumberError');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');

  // Plan Selection Logic
  const planCards = document.querySelectorAll('.plan-card');
  let selectedPlan = 'monthly';

  planCards.forEach(card => {
    card.addEventListener('click', () => {
      planCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedPlan = card.getAttribute('data-plan');
    });
  });

  // Form Validation and Register
  registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let isValid = true;

    companyNameError.textContent = '';
    mobileNumberError.textContent = '';
    emailError.textContent = '';
    passwordError.textContent = '';

    if (!companyName.value.trim()) {
      companyNameError.textContent = 'Company Name is required';
      isValid = false;
    }

    const mobileRegex = /^[0-9]{10,15}$/;
    if (!mobileRegex.test(mobileNumber.value.trim())) {
      mobileNumberError.textContent = 'Please enter a valid numeric mobile number';
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.value.trim())) {
      emailError.textContent = 'Please enter a valid email address';
      isValid = false;
    }

    if (!password.value || password.value.length < 6) {
      passwordError.textContent = 'Password must be at least 6 characters';
      isValid = false;
    }

    if (isValid && selectedPlan) {
      const btn = document.getElementById('continueBtn');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registering...';
      btn.disabled = true;

      registerUser({
        companyName: companyName.value.trim(),
        password: password.value.trim(),
        role: 'Admin'
      })
      .then(data => {
        if (data.error) {
          companyNameError.textContent = data.message;
          btn.innerHTML = originalText;
          btn.disabled = false;
        } else {
          // Success
          btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Success!';
          
          // Save registration data temporarily for onboarding
          localStorage.setItem('zoro_pending_reg', JSON.stringify({
            empId: data.empId,
            companyName: companyName.value.trim(),
            password: password.value.trim()
          }));

          setTimeout(() => {
            window.location.href = '/onboarding.html';
          }, 1000);
        }
      })
      .catch(err => {
        companyNameError.textContent = 'Server connection failed';
        btn.innerHTML = originalText;
        btn.disabled = false;
      });
    } else if (!selectedPlan) {
      alert('Please select a subscription plan to continue.');
    }
  });
});
