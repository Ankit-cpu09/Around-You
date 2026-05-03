const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');
let socket;
let currentPopupJobId = null;

if (!token || !userStr) {
  window.location.href = '/index.html';
}

const user = JSON.parse(userStr);
if (user.role !== 'worker') {
  window.location.href = '/index.html';
}

document.getElementById('user-name-display').textContent = user.name;

// Initialize Socket
function initSocket() {
  try {
    socket = io();
    socket.emit('join', { userId: user.id, role: user.role });

    socket.on('new_job_posted', (job) => {
      showJobPopup(job);
      loadAvailableJobs();
      updateAllStats();
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAD//w=='); 
        audio.play().catch(()=>{});
      } catch(e) {}
    });

    socket.on('job_accepted', (data) => {
      if(currentPopupJobId == data.jobId) {
        closePopup();
      }
      loadAvailableJobs();
      updateAllStats();
    });

    socket.on('payment_received', (data) => {
      alert(`You received ₹${data.amount} for Job #${data.jobId}!`);
      loadMyJobs();
      updateAllStats();
    });
  } catch(e) {
    console.log('Socket.io not available (serverless mode)');
  }
}

function showJobPopup(job) {
  currentPopupJobId = job.id;
  document.getElementById('popup-price').textContent = `₹${job.price}`;
  document.getElementById('popup-title').textContent = job.title;
  document.getElementById('popup-desc').textContent = job.description;
  document.getElementById('job-popup').classList.add('show');
}

function closePopup() {
  currentPopupJobId = null;
  document.getElementById('job-popup').classList.remove('show');
}

function switchTab(tabId) {
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('nav-' + tabId).classList.add('active');

  document.querySelectorAll('.tab-section').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');

  if (tabId === 'available-jobs') loadAvailableJobs();
  if (tabId === 'my-jobs') loadMyJobs();
  if (tabId === 'profile') loadProfile();
}

// Update all stat counters by fetching both available and worker jobs
async function updateAllStats() {
  try {
    // Fetch available jobs count
    const availRes = await fetch('/api/jobs/available', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const availJobs = await availRes.json();
    const availCount = Array.isArray(availJobs) ? availJobs.length : 0;

    // Fetch my jobs (accepted + completed)
    const myRes = await fetch('/api/jobs/worker-jobs', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const myJobs = await myRes.json();

    let acceptedCount = 0;
    let completedCount = 0;

    if (Array.isArray(myJobs)) {
      acceptedCount = myJobs.filter(j => j.status === 'accepted').length;
      completedCount = myJobs.filter(j => j.status === 'completed').length;
    }

    // Animate stat updates
    animateStat('stat-available', availCount);
    animateStat('stat-accepted', acceptedCount);
    animateStat('stat-completed', completedCount);

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

  // Quick animation
  const duration = 400;
  const startTime = performance.now();

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(currentValue + (targetValue - currentValue) * eased);
    el.textContent = value;
    
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = targetValue;
      // Flash effect on change
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

async function loadAvailableJobs() {
  try {
    const res = await fetch('/api/jobs/available', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const jobs = await res.json();
    const container = document.getElementById('jobs-container');
    
    if (!Array.isArray(jobs) || jobs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔎</div>
          <h3>No jobs available right now</h3>
          <p>New jobs will appear here in real-time as employers post them. Stay online to receive instant notifications!</p>
        </div>`;
      return;
    }

    container.innerHTML = jobs.map(job => `
      <div class="card job-card" id="job-card-${job.id}">
        <div>
          <span class="job-status status-${job.status}">${job.status}</span>
        </div>
        <div class="job-price">₹${job.price}</div>
        <h3>${job.title}</h3>
        <p style="font-size: 0.85rem; font-weight: bold; color: var(--primary);">Posted by: ${job.employer_name}</p>
        <p style="color: var(--text-muted); margin: 0.5rem 0;">${job.description}</p>
        <hr style="border: none; border-top: 1px solid var(--border-neon); margin: 1rem 0;" />
        <button class="btn btn-primary btn-block" onclick="acceptJob(${job.id})">ACCEPT JOB</button>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading available jobs:', error);
    document.getElementById('jobs-container').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Connection error</h3>
        <p>Couldn't load jobs. Please check your internet and try again.</p>
        <button class="btn btn-primary" onclick="loadAvailableJobs(); updateAllStats();" style="margin-top:1rem;">Retry</button>
      </div>`;
  }
}

async function loadMyJobs() {
  try {
    const res = await fetch('/api/jobs/worker-jobs', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const jobs = await res.json();
    const container = document.getElementById('my-jobs-container');
    
    if (!Array.isArray(jobs) || jobs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <h3>No jobs yet</h3>
          <p>Once you accept a job, it will appear here. Go to Available Jobs to find work near you.</p>
        </div>`;
      return;
    }

    container.innerHTML = jobs.map(job => `
      <div class="card job-card">
        <div>
          <span class="job-status status-${job.status}">${job.status}</span>
          <span class="payment-status-badge pay-${job.payment_status || 'pending'}">PAYMENT: ${(job.payment_status || 'PENDING').toUpperCase()}</span>
        </div>
        <div class="job-price">₹${job.price}</div>
        <h3>${job.title}</h3>
        <p style="font-size: 0.85rem; font-weight: bold; color: var(--primary);">Employer: ${job.employer_name} (${job.employer_phone})</p>
        <p style="color: var(--text-muted); margin: 0.5rem 0;">${job.description}</p>
        <hr style="border: none; border-top: 1px solid var(--border-neon); margin: 1rem 0;" />
        ${job.status === 'accepted' ? 
           `<button class="btn btn-primary btn-block" onclick="window.location.href='/map.html?jobId=${job.id}'">VIEW MAP</button>` : 
           `<p style="font-size: 0.85rem; color: var(--text-muted); text-align: center;">Done.</p>`
        }
      </div>
    `).join('');
  } catch(error) {
    console.error(error);
    document.getElementById('my-jobs-container').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Connection error</h3>
        <p>Couldn't load your jobs. Please try again.</p>
        <button class="btn btn-primary" onclick="loadMyJobs(); updateAllStats();" style="margin-top:1rem;">Retry</button>
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

async function acceptPopupJob() {
  if(currentPopupJobId) {
    await acceptJob(currentPopupJobId);
    closePopup();
  }
}

async function acceptJob(jobId) {
  try {
    const res = await fetch(`/api/jobs/${jobId}/accept`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await res.json();
    if(res.ok) {
      alert('Job accepted! Opening directions...');
      window.location.href = `/map.html?jobId=${jobId}`;
    } else {
      alert(data.message || 'This job was already taken by someone else.');
      loadAvailableJobs();
      updateAllStats();
    }
  } catch(error) {
    alert('Something went wrong. Check your connection.');
  }
}

function logout() {
  localStorage.clear();
  window.location.href = '/index.html';
}

// Initialize everything
initSocket();
loadAvailableJobs();
updateAllStats();

// Auto-refresh stats every 30 seconds
setInterval(updateAllStats, 30000);
