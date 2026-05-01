const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
  window.location.href = '/index.html';
}

const user = JSON.parse(userStr);

// Get Job ID from URL
const urlParams = new URLSearchParams(window.location.search);
const jobId = urlParams.get('jobId');

if(!jobId) {
  alert('No Job ID provided');
  window.location.href = '/worker-dashboard.html';
}

let map, directionsService, directionsRenderer;
let employerLat, employerLng, workerLat, workerLng;

async function loadJobDetailsAndMap() {
  try {
    // 1. Fetch Job Details
    const res = await fetch(`/api/jobs/${jobId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if(!res.ok) throw new Error('Could not fetch job info');
    const job = await res.json();
    
    document.getElementById('job-title-display').textContent = job.title;
    employerLat = parseFloat(job.latitude);
    employerLng = parseFloat(job.longitude);

    // 2. Get Worker Location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          workerLat = pos.coords.latitude;
          workerLng = pos.coords.longitude;
          initMap();
        },
        () => {
          alert("Couldn't get your location. Map cannot be drawn.");
        }
      );
    } else {
      alert("Browser doesn't support Geolocation");
    }
  } catch(e) {
    console.error(e);
    alert('Error loading map data.');
  }
}

function initMap() {
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer();
  
  const workerLoc = { lat: workerLat, lng: workerLng };
  const employerLoc = { lat: employerLat, lng: employerLng };

  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 13,
    center: workerLoc,
  });
  
  directionsRenderer.setMap(map);
  calculateAndDisplayRoute(workerLoc, employerLoc);

  // Setup external map button
  const externalBtn = document.getElementById('external-map-btn');
  externalBtn.disabled = false;
  externalBtn.onclick = () => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${workerLat},${workerLng}&destination=${employerLat},${employerLng}&travelmode=driving`;
    window.open(url, '_blank');
  };
}

function calculateAndDisplayRoute(origin, destination) {
  directionsService.route({
    origin: origin,
    destination: destination,
    travelMode: google.maps.TravelMode.DRIVING
  })
  .then((response) => {
    directionsRenderer.setDirections(response);
    
    const route = response.routes[0].legs[0];
    document.getElementById('dist-text').textContent = route.distance.text;
    document.getElementById('time-text').textContent = route.duration.text;
  })
  .catch((e) => window.alert('Directions request failed due to ' + status));
}

// Dynamically load Google Maps script
function loadGoogleMapsScript() {
  // In a real app we'd fetch this key securely or inject it via template.
  // We'll try to fetch it from an endpoint if we made one, or use a placeholder here.
  fetch('/api/jobs/mapkey').then(r => r.json()).then(data => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${data.key}&callback=loadJobDetailsAndMap&v=weekly`;
    script.defer = true;
    script.async = true;
    window.loadJobDetailsAndMap = loadJobDetailsAndMap;
    document.head.appendChild(script);
  }).catch(() => {
    alert('Failed to get map key');
  });
}

loadGoogleMapsScript();
