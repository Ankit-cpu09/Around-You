const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');
let socket;
let currentPopupJobId = null;
let allAvailableJobs = []; // Store for search/filter
let notifications = [];
let currentQAJobId = null;
let currentRatingJobId = null;
let selectedRating = 0;

if (!token || !userStr) {
  window.location.href = '/index.html';
}

const user = JSON.parse(userStr);
if (user.role !== 'worker') {
  window.location.href = '/index.html';
}

document.getElementById('user-name-display').textContent = user.name;

// ========== SOCKET INIT ==========
function initSocket() {
  try {
    socket = io();
    socket.emit('join', { userId: user.id, role: user.role });

    socket.on('new_job_posted', (job) => {
      showJobPopup(job);
      loadAvailableJobs();
      updateAllStats();
      addNotification('⚡ New Job', `${job.title} — ₹${job.price}`);
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
      addNotification('💰 Payment', `You received ₹${data.amount} for Job #${data.jobId}!`);
      loadMyJobs();
      updateAllStats();
    });

    socket.on('question_answered', (data) => {
      addNotification('💬 Answer', `Your question about a job was answered!`);
    });
  } catch(e) {
    console.log('Socket.io not available (serverless mode)');
  }
}

// ========== NOTIFICATIONS ==========
function addNotification(title, body) {
  notifications.unshift({ title, body, time: new Date().toLocaleTimeString() });
  if (notifications.length > 20) notifications.pop();
  renderNotifications();
}

function renderNotifications() {
  const badge = document.getElementById('notif-badge');
  const list = document.getElementById('notif-list');

  if (notifications.length === 0) {
    badge.style.display = 'none';
    list.innerHTML = '<div class="notif-empty">No notifications yet</div>';
    return;
  }

  badge.style.display = 'flex';
  badge.textContent = notifications.length;
  
  list.innerHTML = notifications.map(n => `
    <div class="notif-item">
      <div class="notif-item-title">${n.title}</div>
      <div class="notif-item-body">${n.body}</div>
      <div class="notif-item-time">${n.time}</div>
    </div>
  `).join('');
}

function toggleNotifPanel() {
  document.getElementById('notif-panel').classList.toggle('show');
}

function clearNotifications() {
  notifications = [];
  renderNotifications();
  document.getElementById('notif-panel').classList.remove('show');
}

// Close notif panel on outside click
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notif-panel');
  const bell = document.querySelector('.notif-bell-wrap');
  if (panel && !panel.contains(e.target) && !bell.contains(e.target)) {
    panel.classList.remove('show');
  }
});

// ========== POPUP ==========
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

// ========== TAB SWITCHING ==========
function switchTab(tabId) {
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('nav-' + tabId).classList.add('active');

  document.querySelectorAll('.tab-section').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');

  if (tabId === 'available-jobs') loadAvailableJobs();
  if (tabId === 'my-jobs') loadMyJobs();
  if (tabId === 'profile') loadProfile();
}

// ========== STATS ==========
async function updateAllStats() {
  try {
    const availRes = await fetch('/api/jobs/available', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const availJobs = await availRes.json();
    const availCount = Array.isArray(availJobs) ? availJobs.length : 0;

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

    animateStat('stat-available', availCount);
    animateStat('stat-accepted', acceptedCount);
    animateStat('stat-completed', completedCount);
  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

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
        setTimeout(() => { el.style.transform = 'scale(1)'; }, 300);
      }
    }
  }
  requestAnimationFrame(step);
}

// ========== LOAD AVAILABLE JOBS ==========
async function loadAvailableJobs() {
  try {
    const res = await fetch('/api/jobs/available', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const jobs = await res.json();
    allAvailableJobs = Array.isArray(jobs) ? jobs : [];
    filterJobs(); // Apply current filters
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

// ========== SEARCH / FILTER / SORT ==========
function filterJobs() {
  const searchTerm = (document.getElementById('search-jobs')?.value || '').toLowerCase();
  const category = document.getElementById('filter-category')?.value || '';
  const sortBy = document.getElementById('sort-jobs')?.value || 'newest';

  let filtered = [...allAvailableJobs];

  // Search
  if (searchTerm) {
    filtered = filtered.filter(j => 
      j.title.toLowerCase().includes(searchTerm) || 
      (j.description || '').toLowerCase().includes(searchTerm) ||
      (j.employer_name || '').toLowerCase().includes(searchTerm)
    );
  }

  // Category filter
  if (category) {
    filtered = filtered.filter(j => j.category === category);
  }

  // Sort
  if (sortBy === 'highest') {
    filtered.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  } else if (sortBy === 'lowest') {
    filtered.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  } else {
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  renderJobs(filtered);
}

function renderJobs(jobs) {
  const container = document.getElementById('jobs-container');

  if (jobs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔎</div>
        <h3>No jobs found</h3>
        <p>Try adjusting your search or filters. New jobs appear in real-time!</p>
      </div>`;
    return;
  }

  container.innerHTML = jobs.map(job => `
    <div class="card job-card" id="job-card-${job.id}">
      <div class="job-card-top">
        <span class="job-status status-${job.status}">${job.status}</span>
        ${job.category && job.category !== 'General' ? `<span class="category-badge">${job.category}</span>` : ''}
      </div>
      <div class="job-price">₹${job.price}</div>
      <h3>${job.title}</h3>
      <p class="job-employer">
        <span>👤 ${job.employer_name}</span>
        <a href="tel:${job.employer_phone}" class="phone-link">📞 ${job.employer_phone}</a>
      </p>
      <p style="color: var(--text-muted); margin: 0.5rem 0; font-size: 0.9rem;">${job.description}</p>
      <hr style="border: none; border-top: 1px solid var(--border-neon); margin: 1rem 0;" />
      <div class="job-card-actions">
        <button class="btn btn-outline btn-sm" onclick="openQAModal(${job.id}, '${job.title.replace(/'/g, "\\'")}')">❓ Ask Question</button>
        <button class="btn btn-primary btn-sm" onclick="acceptJob(${job.id})">✅ ACCEPT JOB</button>
      </div>
    </div>
  `).join('');
}

// ========== LOAD MY JOBS ==========
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
        <div class="job-card-top">
          <span class="job-status status-${job.status}">${job.status}</span>
          <span class="payment-status-badge pay-${job.payment_status || 'pending'}">PAYMENT: ${(job.payment_status || 'PENDING').toUpperCase()}</span>
        </div>
        <div class="job-price">₹${job.price}</div>
        <h3>${job.title}</h3>
        <p class="job-employer">
          <span>👤 ${job.employer_name}</span>
          <a href="tel:${job.employer_phone}" class="phone-link">📞 ${job.employer_phone}</a>
        </p>
        <p style="color: var(--text-muted); margin: 0.5rem 0; font-size: 0.9rem;">${job.description}</p>
        <hr style="border: none; border-top: 1px solid var(--border-neon); margin: 1rem 0;" />
        <div class="job-card-actions">
          ${job.status === 'accepted' ? 
             `<button class="btn btn-primary btn-block" onclick="window.location.href='/map.html?jobId=${job.id}'">🗺️ VIEW MAP</button>` : 
             `<button class="btn btn-outline btn-sm" onclick="openRatingModal(${job.id})">⭐ Rate Employer</button>
              <span style="font-size: 0.85rem; color: var(--green);">✓ Completed</span>`
          }
        </div>
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

// ========== PROFILE ==========
function loadProfile() {
  document.getElementById('profile-container').innerHTML = `
    <div class="profile-avatar">${user.name.charAt(0).toUpperCase()}</div>
    <h3 style="margin-bottom: 0.5rem; color: var(--text-main)">${user.name}</h3>
    <div class="profile-details">
      <p><strong>📞 Phone:</strong> ${user.phone}</p>
      <p><strong>👷 Role:</strong> ${user.role.toUpperCase()}</p>
    </div>
  `;
}

// ========== Q&A SYSTEM ==========
function openQAModal(jobId, jobTitle) {
  currentQAJobId = jobId;
  document.getElementById('qa-job-title').textContent = jobTitle;
  document.getElementById('qa-question-input').value = '';
  document.getElementById('qaModal').classList.add('active');
  loadQuestions(jobId);
}

function closeQAModal() {
  document.getElementById('qaModal').classList.remove('active');
  currentQAJobId = null;
}

async function loadQuestions(jobId) {
  const list = document.getElementById('qa-list');
  try {
    const res = await fetch(`/api/jobs/${jobId}/questions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const questions = await res.json();
    
    if (!Array.isArray(questions) || questions.length === 0) {
      list.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center;">No questions yet. Be the first to ask!</p>';
      return;
    }

    list.innerHTML = questions.map(q => `
      <div class="qa-item">
        <div class="qa-question">
          <span class="qa-label">Q</span>
          <div>
            <strong>${q.worker_name}</strong>
            <p>${q.question}</p>
          </div>
        </div>
        ${q.answer ? `
          <div class="qa-answer">
            <span class="qa-label qa-label-a">A</span>
            <div>
              <strong>Employer</strong>
              <p>${q.answer}</p>
            </div>
          </div>
        ` : `
          <div class="qa-pending">⏳ Waiting for employer's response...</div>
        `}
      </div>
    `).join('');
  } catch (error) {
    list.innerHTML = '<p style="color: var(--secondary);">Failed to load questions</p>';
  }
}

async function submitQuestion() {
  if (!currentQAJobId) return;
  const input = document.getElementById('qa-question-input');
  const question = input.value.trim();

  if (!question) {
    alert('Please type a question');
    return;
  }

  try {
    const res = await fetch(`/api/jobs/${currentQAJobId}/ask`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ question })
    });

    const data = await res.json();
    if (res.ok) {
      input.value = '';
      loadQuestions(currentQAJobId);
    } else {
      alert(data.message || 'Failed to submit question');
    }
  } catch (error) {
    alert('Network error');
  }
}

// ========== RATING SYSTEM ==========
function openRatingModal(jobId) {
  currentRatingJobId = jobId;
  selectedRating = 0;
  document.querySelectorAll('#star-rating .star').forEach(s => s.classList.remove('active'));
  document.getElementById('rating-review').value = '';
  document.getElementById('ratingModal').classList.add('active');
}

function closeRatingModal() {
  document.getElementById('ratingModal').classList.remove('active');
  currentRatingJobId = null;
}

function setRating(value) {
  selectedRating = value;
  document.querySelectorAll('#star-rating .star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.value) <= value);
  });
}

async function submitRating() {
  if (!currentRatingJobId || selectedRating === 0) {
    alert('Please select a rating');
    return;
  }

  const review = document.getElementById('rating-review').value.trim();

  try {
    const res = await fetch(`/api/jobs/${currentRatingJobId}/rate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ rating: selectedRating, review })
    });

    const data = await res.json();
    if (res.ok) {
      alert('Rating submitted! Thank you.');
      closeRatingModal();
    } else {
      alert(data.message || 'Failed to submit rating');
    }
  } catch (error) {
    alert('Network error');
  }
}

// ========== ACCEPT JOB ==========
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
      addNotification('✅ Job Accepted', 'Opening directions...');
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

// ========== INITIALIZE ==========
initSocket();
loadAvailableJobs();
updateAllStats();

// Auto-refresh stats every 30 seconds
setInterval(updateAllStats, 30000);
