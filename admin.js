// === CONFIGURATION ===
// Must match the exact same Apps Script URL you used in app.js
const GAS_URL = 'https://script.google.com/macros/s/AKfycbz4n6syDLljV5zGTvfFaIwS9bp6kYij43GKvRdfT5iv2ZoExEHbcEhu1OLAzVx31IM7/exec';
const MODEL_URL = './models'; 

const video = document.getElementById('admin-video');
const captureBtn = document.getElementById('capture-btn');
const submitBtn = document.getElementById('submit-btn');
const form = document.getElementById('enroll-form');
const captureStatus = document.getElementById('capture-status');

let currentEmbedding = null;

// 1. Initialize and load models
async function init() {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
  ]);
  
  document.getElementById('model-status').innerText = "Camera Active";
  captureBtn.disabled = false;
  startVideo();
}

// 2. Start Camera
async function startVideo() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
  } catch (err) {
    console.error(err);
    alert("Camera access is required to enroll an employee.");
  }
}

// 3. Scan face and extract descriptor
captureBtn.addEventListener('click', async () => {
  captureBtn.innerText = "Scanning...";
  captureBtn.disabled = true;

  const canvas = document.getElementById('admin-overlay');
  const displaySize = { width: video.videoWidth, height: video.videoHeight };
  faceapi.matchDimensions(canvas, displaySize);

  // Detect face
  const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (detections) {
    // Draw box around face to show success
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resizedDetections);

    // Convert Float32Array to standard JavaScript Array for JSON stringification
    currentEmbedding = Array.from(detections.descriptor);
    
    captureStatus.innerText = "Face Captured Successfully!";
    captureStatus.classList.add('success');
    captureStatus.classList.remove('error');
    submitBtn.disabled = false; // Enable form submission
    captureBtn.innerText = "Rescan Face";
  } else {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    captureStatus.innerText = "No face detected. Try again.";
    captureStatus.style.background = "#f44336";
    captureBtn.innerText = "Scan Face";
  }
  captureBtn.disabled = false;
});

// 4. Submit form and embedding to Google Sheets
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!currentEmbedding) {
    alert("Please scan the employee's face first.");
    return;
  }

  submitBtn.innerText = "Saving to Database...";
  submitBtn.disabled = true;

  const payload = {
    employeeId: document.getElementById('emp-id').value,
    name: document.getElementById('emp-name').value,
    lastName: document.getElementById('emp-lastname').value,
    pin: document.getElementById('emp-pin').value,
    department: document.getElementById('emp-dept').value,
    embedding: currentEmbedding
  };

  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'enrollEmployee',
        payload: payload
      })
    });
    
    const result = await response.json();
    
    if (result.status === 'success') {
      alert("Employee enrolled successfully!");
      form.reset();
      currentEmbedding = null;
      submitBtn.disabled = true;
      submitBtn.innerText = "Save Employee";
      captureStatus.innerText = "No face scanned yet";
      captureStatus.classList.remove('success');
      document.getElementById('admin-overlay').getContext('2d').clearRect(0, 0, video.videoWidth, video.videoHeight);
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error(error);
    alert("Error saving employee: " + error.message);
    submitBtn.innerText = "Save Employee";
    submitBtn.disabled = false;
  }
});

// Start application
window.onload = init;
