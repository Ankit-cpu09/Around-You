/**
 * Firebase Phone Authentication for Around You
 * Handles: Send OTP → Verify OTP → Login/Register via backend
 */

// ========== FIREBASE INIT ==========
const firebaseConfig = {
  apiKey: "AIzaSyBBUkHfO3jcDkTXrheEuON__bMMlkLgjmE",
  authDomain: "around-a0f2f.firebaseapp.com",
  projectId: "around-a0f2f",
  storageBucket: "around-a0f2f.firebasestorage.app",
  messagingSenderId: "376448828398",
  appId: "1:376448828398:web:9cc5655feb4b930525c4ff"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Disable reCAPTCHA verification for localhost testing
// This works with test phone numbers added in Firebase Console
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  auth.settings.appVerificationDisabledForTesting = true;
  console.log('🔧 Firebase: reCAPTCHA disabled for localhost testing');
}

// State
let confirmationResult = null;
let firebaseIdToken = null;

// ========== reCAPTCHA ==========

function setupRecaptcha() {
  // On localhost with testing mode, reCAPTCHA is bypassed automatically
  if (auth.settings.appVerificationDisabledForTesting) {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'invisible'
      });
    }
    return;
  }

  // Production: use invisible reCAPTCHA
  if (window.recaptchaVerifier) return;

  window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
    size: 'invisible',
    callback: (response) => {
      console.log('reCAPTCHA solved');
    },
    'expired-callback': () => {
      console.log('reCAPTCHA expired');
      showFirebaseAlert('firebase-otp-alert', 'reCAPTCHA expired. Please try again.', 'error');
    }
  });
}

// ========== ALERT HELPERS ==========

function showFirebaseAlert(elementId, message, type) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.style.display = 'block';
  el.className = `auth-alert auth-alert-${type === 'error' ? 'error' : 'success'}`;
  el.textContent = message;
  // Auto-hide after 8s
  setTimeout(() => { el.style.display = 'none'; }, 8000);
}

// ========== STEP 1: SEND OTP ==========

async function handleFirebaseSendOTP(event) {
  event.preventDefault();

  let phone = document.getElementById('otp-login-phone').value.trim();
  const sendBtn = document.getElementById('otp-send-btn');

  // Ensure phone starts with +
  if (!phone.startsWith('+')) {
    phone = '+91' + phone.replace(/^0+/, '');
  }

  // Basic validation
  if (phone.length < 10) {
    showFirebaseAlert('firebase-otp-alert', 'Please enter a valid phone number with country code', 'error');
    return;
  }

  sendBtn.textContent = '⏳ Sending...';
  sendBtn.disabled = true;

  try {
    setupRecaptcha();
    const appVerifier = window.recaptchaVerifier;

    confirmationResult = await auth.signInWithPhoneNumber(phone, appVerifier);

    console.log('✅ OTP sent via Firebase to', phone);

    // Show step 2
    document.getElementById('otp-step-1').style.display = 'none';
    document.getElementById('otp-step-2').style.display = 'block';
    document.getElementById('auth-modal-title').textContent = 'Enter SMS Code';

    showFirebaseAlert('firebase-verify-alert', `OTP sent to ${phone}. Check your SMS.`, 'success');

    // Focus first OTP box
    const firstBox = document.querySelector('#otp-step-2 .otp-box[data-index="0"]');
    if (firstBox) firstBox.focus();

  } catch (error) {
    console.error('Firebase OTP error:', error);
    let msg = 'Failed to send OTP. ';
    if (error.code === 'auth/invalid-phone-number') {
      msg += 'Invalid phone number format. Use +91XXXXXXXXXX';
    } else if (error.code === 'auth/too-many-requests') {
      msg += 'Too many attempts. Please wait and try again later.';
    } else if (error.code === 'auth/captcha-check-failed') {
      msg += 'reCAPTCHA verification failed. Please refresh the page.';
    } else {
      msg += error.message || 'Please try again.';
    }
    showFirebaseAlert('firebase-otp-alert', msg, 'error');

    // Reset reCAPTCHA instead of destroying it
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.reset();
    }
  } finally {
    sendBtn.textContent = '📲 Send OTP';
    sendBtn.disabled = false;
  }
}

// ========== STEP 2: VERIFY OTP ==========

async function handleFirebaseVerifyOTP(event) {
  event.preventDefault();

  // Collect 6-digit code from OTP boxes
  const boxes = document.querySelectorAll('#otp-step-2 .otp-box');
  let code = '';
  boxes.forEach(box => { code += box.value; });

  if (code.length !== 6) {
    showFirebaseAlert('firebase-verify-alert', 'Please enter all 6 digits', 'error');
    return;
  }

  const verifyBtn = document.getElementById('otp-verify-btn');
  verifyBtn.textContent = '⏳ Verifying...';
  verifyBtn.disabled = true;

  try {
    // Verify with Firebase
    const result = await confirmationResult.confirm(code);
    const user = result.user;
    console.log('✅ Firebase phone auth successful:', user.phoneNumber);

    // Get the Firebase ID token
    const idToken = await user.getIdToken();
    firebaseIdToken = idToken;

    // Send to our backend for login/register
    const response = await fetch('/api/auth/firebase-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });

    const data = await response.json();

    if (data.needsRegistration) {
      // New user — show profile completion step
      document.getElementById('otp-step-2').style.display = 'none';
      document.getElementById('otp-step-3').style.display = 'block';
      document.getElementById('auth-modal-title').textContent = 'Complete Profile';
      return;
    }

    if (data.token) {
      // Existing user — login successful
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      showFirebaseAlert('firebase-verify-alert', '✅ Login successful! Redirecting...', 'success');

      setTimeout(() => {
        window.location.href = data.user.role === 'employer' 
          ? '/employer-dashboard.html' 
          : '/worker-dashboard.html';
      }, 1000);
    } else {
      showFirebaseAlert('firebase-verify-alert', data.message || 'Login failed', 'error');
    }

  } catch (error) {
    console.error('Firebase verify error:', error);
    let msg = 'Verification failed. ';
    if (error.code === 'auth/invalid-verification-code') {
      msg += 'Invalid OTP code. Please check and try again.';
    } else if (error.code === 'auth/code-expired') {
      msg += 'OTP expired. Please request a new one.';
    } else {
      msg += error.message || 'Please try again.';
    }
    showFirebaseAlert('firebase-verify-alert', msg, 'error');
  } finally {
    verifyBtn.textContent = '✅ Verify & Login';
    verifyBtn.disabled = false;
  }
}

// ========== STEP 3: COMPLETE PROFILE (NEW USER) ==========

async function handleFirebaseCompleteProfile(event) {
  event.preventDefault();

  const name = document.getElementById('firebase-reg-name').value.trim();
  const role = document.getElementById('firebase-reg-role').value;
  const skills = document.getElementById('firebase-reg-skills').value.trim();

  if (!name) {
    alert('Please enter your name');
    return;
  }

  try {
    const response = await fetch('/api/auth/firebase-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: firebaseIdToken, name, role, skills })
    });

    const data = await response.json();

    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      alert('🎉 Account created successfully!');

      window.location.href = role === 'employer' 
        ? '/employer-dashboard.html' 
        : '/worker-dashboard.html';
    } else {
      alert(data.message || 'Registration failed');
    }
  } catch (error) {
    console.error('Profile completion error:', error);
    alert('Failed to create account. Please try again.');
  }
}

// ========== RESEND OTP ==========

async function handleFirebaseResend() {
  // Reset reCAPTCHA
  if (window.recaptchaVerifier) {
    window.recaptchaVerifier.reset();
  }

  // Go back to step 1
  document.getElementById('otp-step-2').style.display = 'none';
  document.getElementById('otp-step-1').style.display = 'block';
  document.getElementById('auth-modal-title').textContent = 'Login with OTP';

  showFirebaseAlert('firebase-otp-alert', 'Please re-enter your phone number to resend OTP', 'success');
}

console.log('🔥 Firebase Auth module loaded');
