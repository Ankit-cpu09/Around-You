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
      alert(data.message || 'Login failed');
    }
  } catch (error) {
    console.error('Network error:', error);
    alert('An error occurred during login.');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const phone = document.getElementById('reg-phone').value;
  const password = document.getElementById('reg-password').value;
  const role = document.getElementById('reg-role').value;
  const skills = document.getElementById('reg-skills').value;

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
      body: JSON.stringify({ name, phone, password, role, skills, latitude, longitude })
    });
    
    const data = await res.json();
    if (res.ok) {
      alert('Registration successful! Please login.');
      toggleAuth('login');
      // Auto fill phone
      document.getElementById('login-phone').value = phone;
    } else {
      alert(data.message || 'Registration failed');
    }
  } catch (error) {
    console.error('Network error:', error);
    alert('An error occurred during registration.');
  }
}

// Auto redirect if already logged in
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
