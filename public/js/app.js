// ========== AUTH TAB TOGGLE ==========
function toggleAuth(type) {
  if (type === 'register') {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
  } else {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
  }
}

function toggleSkills() {
  const role = document.getElementById('reg-role').value;
  if (role === 'worker') {
    document.getElementById('skills-group').style.display = 'block';
  } else {
    document.getElementById('skills-group').style.display = 'none';
  }
}

// ========== OTP INPUT HANDLERS ==========
function handleOTPInput(input, group) {
  const value = input.value;
  if (value && value.length === 1) {
    // Move to next input
    const idx = parseInt(input.dataset.index);
    const container = input.closest('.otp-input-group') || input.parentElement;
    const boxes = container.querySelectorAll('.otp-box');
    if (idx < 5 && boxes[idx + 1]) {
      boxes[idx + 1].focus();
    }
  }
}

function handleOTPKeydown(e, input, group) {
  if (e.key === 'Backspace' && !input.value) {
    const idx = parseInt(input.dataset.index);
    const container = input.closest('.otp-input-group') || input.parentElement;
    const boxes = container.querySelectorAll('.otp-box');
    if (idx > 0 && boxes[idx - 1]) {
      boxes[idx - 1].focus();
      boxes[idx - 1].value = '';
    }
  }
}

function getOTPValue(containerSelector) {
  const boxes = document.querySelectorAll(containerSelector + ' .otp-box');
  let code = '';
  boxes.forEach(b => code += b.value);
  return code;
}

function clearOTPBoxes(containerSelector) {
  const boxes = document.querySelectorAll(containerSelector + ' .otp-box');
  boxes.forEach(b => b.value = '');
  if (boxes[0]) boxes[0].focus();
}

// ========== OTP TOAST NOTIFICATION ==========
let otpToastTimer = null;

function showOTPToast(code) {
  const toast = document.getElementById('otp-toast');
  const codeEl = document.getElementById('otp-toast-code');
  const bar = document.getElementById('otp-toast-bar');
  
  if (!toast || !codeEl) return;

  codeEl.textContent = code;
  toast.classList.add('show');
  
  // Reset and animate timer bar
  bar.style.transition = 'none';
  bar.style.width = '100%';
  setTimeout(() => {
    bar.style.transition = 'width 30s linear';
    bar.style.width = '0%';
  }, 50);

  // Auto-hide after 30 seconds
  if (otpToastTimer) clearTimeout(otpToastTimer);
  otpToastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 30000);
}

// ========== STANDARD LOGIN ==========
async function handleLogin(e) {
  e.preventDefault();
  const phone = document.getElementById('login-phone').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      if (data.user.role === 'employer') {
        window.location.href = '/employer-dashboard.html';
      } else {
        window.location.href = '/worker-dashboard.html';
      }
    } else {
      showAuthError(data.message || 'Login failed');
    }
  } catch (error) {
    console.error('Network error:', error);
    showAuthError('An error occurred during login.');
  }
}

// ========== REGISTRATION ==========
async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const phone = document.getElementById('reg-phone').value;
  const email = document.getElementById('reg-email')?.value || '';
  const password = document.getElementById('reg-password').value;
  const role = document.getElementById('reg-role').value;
  const skills = document.getElementById('reg-skills').value;

  if (password.length < 6) {
    showAuthError('Password must be at least 6 characters');
    return;
  }

  let latitude = null, longitude = null;
  // Try to get location
  if(navigator.geolocation) {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch(err) {
      console.log('Could not get location during register');
    }
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, password, role, skills, latitude, longitude })
    });
    
    const data = await res.json();
    if (res.ok) {
      showAuthSuccess('Registration successful! Please login.');
      if (typeof switchAuthTab === 'function') switchAuthTab('login');
      else toggleAuth('login');
      // Auto fill phone
      document.getElementById('login-phone').value = phone;
    } else {
      showAuthError(data.message || 'Registration failed');
    }
  } catch (error) {
    console.error('Network error:', error);
    showAuthError('An error occurred during registration.');
  }
}

// ========== OTP LOGIN ==========
let otpLoginPhone = '';

async function handleSendLoginOTP(e) {
  e.preventDefault();
  const phone = document.getElementById('otp-login-phone').value;
  const btn = document.getElementById('otp-send-btn');

  if (!phone || phone.length < 10) {
    showAuthError('Please enter a valid phone number');
    return;
  }

  btn.textContent = 'Sending...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });

    const data = await res.json();
    if (res.ok) {
      otpLoginPhone = phone;
      document.getElementById('otp-step-1').style.display = 'none';
      document.getElementById('otp-step-2').style.display = 'block';
      
      // Show OTP in toast for simulated mode
      if (data.otp_code) {
        showOTPToast(data.otp_code);
      }

      // Focus first OTP box
      const firstBox = document.querySelector('#otp-step-2 .otp-box');
      if (firstBox) firstBox.focus();
    } else {
      showAuthError(data.message || 'Failed to send OTP');
    }
  } catch (error) {
    showAuthError('Network error. Please try again.');
  } finally {
    btn.textContent = 'Send OTP';
    btn.disabled = false;
  }
}

async function handleVerifyLoginOTP(e) {
  e.preventDefault();
  const code = getOTPValue('#otp-step-2');
  const btn = document.getElementById('otp-verify-btn');

  if (code.length !== 6) {
    showAuthError('Please enter the complete 6-digit code');
    return;
  }

  btn.textContent = 'Verifying...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: otpLoginPhone, code })
    });

    const data = await res.json();
    if (res.ok) {
      // Hide OTP toast
      const toast = document.getElementById('otp-toast');
      if (toast) toast.classList.remove('show');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      if (data.user.role === 'employer') {
        window.location.href = '/employer-dashboard.html';
      } else {
        window.location.href = '/worker-dashboard.html';
      }
    } else {
      showAuthError(data.message || 'Invalid OTP');
      clearOTPBoxes('#otp-step-2');
    }
  } catch (error) {
    showAuthError('Verification failed. Please try again.');
  } finally {
    btn.textContent = 'Verify & Login';
    btn.disabled = false;
  }
}

// ========== FORGOT PASSWORD ==========
let forgotPhone = '';
let forgotOTPCode = '';

async function handleForgotPassword(e) {
  e.preventDefault();
  const phone = document.getElementById('forgot-phone').value;
  const method = document.querySelector('input[name="reset-method"]:checked')?.value || 'sms';
  const btn = document.getElementById('forgot-send-btn');

  if (!phone || phone.length < 10) {
    showAuthError('Please enter a valid phone number');
    return;
  }

  btn.textContent = 'Sending...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, method })
    });

    const data = await res.json();
    if (res.ok) {
      forgotPhone = phone;
      document.getElementById('forgot-step-1').style.display = 'none';
      document.getElementById('forgot-step-2').style.display = 'block';

      if (data.otp_code) {
        showOTPToast(data.otp_code);
      }

      // Focus first OTP box
      const firstBox = document.querySelector('#forgot-step-2 .otp-box');
      if (firstBox) firstBox.focus();
    } else {
      showAuthError(data.message || 'Failed to send reset code');
    }
  } catch (error) {
    showAuthError('Network error. Please try again.');
  } finally {
    btn.textContent = 'Send Reset Code';
    btn.disabled = false;
  }
}

function handleVerifyResetOTP() {
  const code = getOTPValue('#forgot-step-2');

  if (code.length !== 6) {
    showAuthError('Please enter the complete 6-digit code');
    return;
  }

  forgotOTPCode = code;
  document.getElementById('forgot-step-2').style.display = 'none';
  document.getElementById('forgot-step-3').style.display = 'block';
}

async function handleResetPassword(e) {
  e.preventDefault();
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (newPassword !== confirmPassword) {
    showAuthError('Passwords do not match!');
    return;
  }

  if (newPassword.length < 6) {
    showAuthError('Password must be at least 6 characters');
    return;
  }

  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: forgotPhone, code: forgotOTPCode, newPassword })
    });

    const data = await res.json();
    if (res.ok) {
      // Hide OTP toast
      const toast = document.getElementById('otp-toast');
      if (toast) toast.classList.remove('show');

      showAuthSuccess('Password reset successful! Please login.');
      if (typeof switchAuthTab === 'function') switchAuthTab('login');
      document.getElementById('login-phone').value = forgotPhone;
    } else {
      showAuthError(data.message || 'Reset failed. Please try again.');
      // Go back to step 1
      document.getElementById('forgot-step-3').style.display = 'none';
      document.getElementById('forgot-step-1').style.display = 'block';
    }
  } catch (error) {
    showAuthError('Network error. Please try again.');
  }
}

// ========== RESEND OTP ==========
async function handleResendOTP(type) {
  if (type === 'login') {
    clearOTPBoxes('#otp-step-2');
    // Trigger resend
    const fakeEvent = { preventDefault: () => {} };
    document.getElementById('otp-login-phone').value = otpLoginPhone;
    await handleSendLoginOTP(fakeEvent);
  } else if (type === 'reset') {
    clearOTPBoxes('#forgot-step-2');
    document.getElementById('forgot-step-2').style.display = 'none';
    document.getElementById('forgot-step-1').style.display = 'block';
  }
}

// ========== UI HELPERS ==========
function showAuthError(message) {
  // Remove existing
  const existing = document.querySelector('.auth-alert');
  if (existing) existing.remove();

  const alert = document.createElement('div');
  alert.className = 'auth-alert auth-alert-error';
  alert.innerHTML = `<span>⚠️ ${message}</span>`;
  
  const modalBody = document.querySelector('.modal-body');
  if (modalBody) modalBody.insertBefore(alert, modalBody.firstChild);
  
  setTimeout(() => alert.remove(), 5000);
}

function showAuthSuccess(message) {
  const existing = document.querySelector('.auth-alert');
  if (existing) existing.remove();

  const alert = document.createElement('div');
  alert.className = 'auth-alert auth-alert-success';
  alert.innerHTML = `<span>✅ ${message}</span>`;
  
  const modalBody = document.querySelector('.modal-body');
  if (modalBody) modalBody.insertBefore(alert, modalBody.firstChild);
  
  setTimeout(() => alert.remove(), 5000);
}

// ========== AUTO REDIRECT IF LOGGED IN ==========
window.onload = () => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  if (token && userStr) {
    const user = JSON.parse(userStr);
    // Simple verification
    if (user.role === 'employer') {
      window.location.href = '/employer-dashboard.html';
    } else if (user.role === 'worker') {
      window.location.href = '/worker-dashboard.html';
    }
  }
};
