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
  socket = io();
  socket.emit('join', { userId: user.id, role: user.role });

  socket.on('new_job_posted', (job) => {
    showJobPopup(job);
    loadAvailableJobs();
    try {
      // Small futuristic beep
      const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAD//w=='); 
      audio.play().catch(()=>{});
    } catch(e) {}
  });

  socket.on('job_accepted', (data) => {
    if(currentPopupJobId == data.jobId) {
      closePopup();
    }
    loadAvailableJobs();
  });

  socket.on('payment_received', (data) => {
    alert(`You received ₹${data.amount} for Job #${data.jobId}!`);
    loadMyJobs(); // refresh if they are on my jobs
  });
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
  // Update navs
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('nav-' + tabId).classList.add('active');

  // Update tabs
  document.querySelectorAll('.tab-section').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');

  // Fetch logic
  if (tabId === 'available-jobs') loadAvailableJobs();
  if (tabId === 'my-jobs') loadMyJobs();
  if (tabId === 'profile') loadProfile();
}

async function loadAvailableJobs() {
  try {
    const res = await fetch('/api/jobs/available', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const jobs = await res.json();
    const container = document.getElementById('jobs-container');
    
    if (jobs.length === 0) {
      container.innerHTML = `<div class="card"><p>No jobs available right now. Check back soon!</p></div>`;
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
  }
}

async function loadMyJobs() {
  try {
    const res = await fetch('/api/jobs/worker-jobs', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const jobs = await res.json();
    const container = document.getElementById('my-jobs-container');
    
    if (jobs.length === 0) {
      container.innerHTML = `<div class="card"><p>You haven't taken any jobs yet.</p></div>`;
      return;
    }

    container.innerHTML = jobs.map(job => `
      <div class="card job-card">
        <div>
          <span class="job-status status-${job.status}">${job.status}</span>
          <span class="payment-status-badge pay-${job.payment_status || 'pending'}">PAYMENT: ${job.payment_status || 'PENDING'}</span>
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
    }
  } catch(error) {
    alert('Something went wrong. Check your connection.');
  }
}

function logout() {
  localStorage.clear();
  window.location.href = '/index.html';
}

initSocket();
loadAvailableJobs();
