const token = localStorage.getItem('token');
let user = null;
try {
  user = JSON.parse(localStorage.getItem('user'));
} catch (e) {}

let socket;
let currentPaymentJobId = null;

if (!token || !user || user.role !== 'employer') {
  window.location.href = '/index.html';
} else {
  document.getElementById('user-name-display').textContent = user.name;
}


// Initialize Socket
function initSocket() {
  try {
    socket = io();
    socket.emit('join', { userId: user.id, role: user.role });

    socket.on('job_accepted', (data) => {
      loadJobs();
      updateAllStats();
      alert('A worker has accepted your job!');
    });
  } catch(e) {
    console.log('Socket.io not available (serverless mode)');
  }
}

function switchTab(tabId) {
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('nav-' + tabId).classList.add('active');

  document.querySelectorAll('.tab-section').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');

  if (tabId === 'my-jobs') loadJobs();
  if (tabId === 'history') loadHistory();
  if (tabId === 'profile') loadProfile();
}

// Update all stat counters
async function updateAllStats() {
  try {
    const res = await fetch('/api/jobs/employer', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }
      return;
    }

    const jobs = await res.json();
    if (!Array.isArray(jobs)) return;

    const activeCount = jobs.filter(j => j.status === 'accepted').length;
    const pendingCount = jobs.filter(j => j.status === 'pending').length;
    const completedCount = jobs.filter(j => j.status === 'completed').length;
    const totalSpent = jobs
      .filter(j => j.payment_status === 'paid')
      .reduce((sum, j) => sum + parseFloat(j.price || 0), 0);

    animateStat('stat-active', activeCount);
    animateStat('stat-pending', pendingCount);
    animateStat('stat-completed', completedCount);

    // Special handling for ₹ prefix
    const spentEl = document.getElementById('stat-spent');
    if (spentEl) spentEl.textContent = `₹${totalSpent.toLocaleString('en-IN')}`;

  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

// Smooth number animation for stats
function animateStat(elementId, targetValue) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const currentValue = parseInt(el.textContent) || 0;
  if (currentValue === targetValue) return;

  const duration = 400;
  const startTime = performance.now();

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(currentValue + (targetValue - currentValue) * eased);
    el.textContent = value;
    
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = targetValue;
      if (currentValue !== targetValue) {
        el.style.transform = 'scale(1.2)';
        el.style.transition = 'transform 0.3s ease';
        setTimeout(() => {
          el.style.transform = 'scale(1)';
        }, 300);
      }
    }
  }
  requestAnimationFrame(step);
}

async function loadJobs() {
  try {
    const res = await fetch('/api/jobs/employer', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }
      throw new Error(`HTTP error: ${res.status}`);
    }

    const jobs = await res.json();
    const container = document.getElementById('jobs-container');
    
    // Filter out completed ones for Active Jobs tab
    const activeJobs = Array.isArray(jobs) ? jobs.filter(j => j.status !== 'completed') : [];

    if (activeJobs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>No active jobs</h3>
          <p>You haven't posted any jobs yet. Click "+ Post a Job" to create your first listing and find skilled workers nearby.</p>
        </div>`;
      return;
    }

    container.innerHTML = activeJobs.map(job => `
      <div class="card job-card">
        <div>
          <span class="job-status status-${job.status}">${job.status}</span>
        </div>
        <div class="job-price">₹${job.price}</div>
        <h3>${job.title}</h3>
        <p style="color: var(--text-muted); margin: 0.5rem 0;">${job.description}</p>
        <hr style="border: none; border-top: 1px solid var(--border-neon); margin: 1rem 0;" />
        ${job.status === 'accepted' ? 
          `<button class="btn btn-primary btn-block" onclick="openPaymentModal(${job.id}, ${job.price})">PAY WORKER</button>` : 
          `<p style="font-size: 0.85rem; color: var(--text-muted); text-align: center;">Waiting for a worker to accept...</p>`}
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading jobs:', error);
    const container = document.getElementById('jobs-container');
    if (container) container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Connection error</h3>
        <p>Couldn't load jobs. Please try again.</p>
        <button class="btn btn-primary" onclick="loadJobs(); updateAllStats();" style="margin-top:1rem;">Retry</button>
      </div>`;
  }
}

async function loadHistory() {
  try {
    const res = await fetch('/api/jobs/employer', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        logout();
        return;
      }
      throw new Error(`HTTP error: ${res.status}`);
    }

    const jobs = await res.json();
    const container = document.getElementById('history-container');
    
    const historyJobs = Array.isArray(jobs) ? jobs.filter(j => j.status === 'completed') : [];

    if (historyJobs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <h3>No completed jobs yet</h3>
          <p>Your completed job history will appear here once jobs are finished and paid.</p>
        </div>`;
      return;
    }

    container.innerHTML = historyJobs.map(job => `
      <div class="card job-card">
        <div>
          <span class="job-status status-${job.status}">${job.status}</span>
          <span class="payment-status-badge pay-${job.payment_status || 'pending'}">PAYMENT: ${(job.payment_status || 'PENDING').toUpperCase()}</span>
        </div>
        <div class="job-price">₹${job.price}</div>
        <h3>${job.title}</h3>
        <p style="color: var(--text-muted); margin: 0.5rem 0; font-size: 0.85rem;">${job.description}</p>
      </div>
    `).join('');
  } catch(error) {
    console.error(error);
    const container = document.getElementById('history-container');
    if (container) container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Connection error</h3>
        <p>Couldn't load history. Please try again.</p>
        <button class="btn btn-primary" onclick="loadHistory();" style="margin-top:1rem;">Retry</button>
      </div>`;
  }
}

function loadProfile() {
  document.getElementById('profile-container').innerHTML = `
    <h3 style="margin-bottom: 1rem; color: var(--text-main)">${user.name}</h3>
    <p><strong>Phone:</strong> ${user.phone}</p>
    <p><strong>Role:</strong> ${user.role.toUpperCase()}</p>
  `;
}

// Payment Logic
function openPaymentModal(jobId, price) {
  currentPaymentJobId = jobId;
  document.getElementById('payment-amount').textContent = `₹${price}`;
  document.getElementById('payment-scanner').style.display = 'none';
  document.getElementById('payment-status-text').textContent = 'Click below to proceed with payment.';
  document.getElementById('confirm-pay-btn').style.display = 'inline-block';
  document.getElementById('paymentModal').classList.add('active');
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.remove('active');
}

async function executePayment() {
  if(!currentPaymentJobId) return;

  const btn = document.getElementById('confirm-pay-btn');
  const scanner = document.getElementById('payment-scanner');
  const statusTxt = document.getElementById('payment-status-text');

  btn.style.display = 'none';
  scanner.style.display = 'block';
  statusTxt.textContent = 'Setting up payment...';

  try {
    const res = await fetch(`/api/jobs/${currentPaymentJobId}/create-checkout-session`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    if(res.ok && data.session_url) {
      statusTxt.textContent = 'Redirecting to Stripe...';
      window.location.href = data.session_url;
    } else {
      scanner.style.display = 'none';
      statusTxt.textContent = data.message || 'Payment failed. Please try again.';
      statusTxt.style.color = 'var(--secondary)';
      btn.style.display = 'inline-block';
      btn.textContent = 'Retry';
    }
  } catch(e) {
    scanner.style.display = 'none';
    statusTxt.textContent = 'Connection error. Please check your internet.';
    btn.style.display = 'inline-block';
  }
}

// On Load Payment Verification
async function checkPaymentReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');
  const jobId = urlParams.get('job_id');

  if (sessionId && jobId) {
    alert("Verifying your payment...");
    
    try {
      const res = await fetch('/api/jobs/verify-payment', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ session_id: sessionId, job_id: jobId })
      });
      
      const data = await res.json();
      if(res.ok && data.success) {
        alert("Payment done! The job is marked as complete.");
        switchTab('history');
        updateAllStats();
      } else {
        alert("Payment wasn't completed.");
      }
    } catch(e) {
      console.error(e);
      alert("Error verifying payment.");
    }
    
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function openPostJobModal() {
  document.getElementById('postJobModal').classList.add('active');
}

function closePostJobModal() {
  document.getElementById('postJobModal').classList.remove('active');
}

function captureLocation(btn) {
  btn.textContent = 'Getting location...';
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        document.getElementById('job-lat').value = pos.coords.latitude;
        document.getElementById('job-lng').value = pos.coords.longitude;
        document.getElementById('location-status').style.display = 'block';
        btn.style.display = 'none';
      },
      (err) => {
        alert('Could not get your location. Please allow location access in your browser.');
        btn.textContent = 'Share My Location';
      }
    );
  } else {
    alert('Your browser does not support location sharing.');
  }
}

async function handlePostJob(e) {
  e.preventDefault();
  
  const title = document.getElementById('job-title').value;
  const description = document.getElementById('job-desc').value;
  const price = document.getElementById('job-price').value;
  const latitude = document.getElementById('job-lat').value;
  const longitude = document.getElementById('job-lng').value;

  if (!latitude || !longitude) {
    alert('Please share your location first!');
    return;
  }

  try {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title, description, price, latitude, longitude })
    });

    if (res.ok) {
      closePostJobModal();
      e.target.reset();
      document.getElementById('location-status').style.display = 'none';
      document.querySelector('button[onclick="captureLocation(this)"]').style.display = 'block';
      loadJobs();
      updateAllStats();
    } else {
      const data = await res.json();
      alert(data.message || 'Error posting job.');
    }
  } catch (err) {
    console.error(err);
    alert('Network error.');
  }
}

function logout() {
  localStorage.clear();
  window.location.href = '/index.html';
}

// Initialize everything
initSocket();
loadJobs();
updateAllStats();
checkPaymentReturn();

// Auto-refresh stats every 30 seconds
setInterval(updateAllStats, 30000);
