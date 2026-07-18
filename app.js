// === CONFIGURATION ===
// REPLACE THIS with your deployed Google Apps Script Web App URL
const GAS_URL = 'https://script.google.com/macros/s/AKfycbz4n6syDLljV5zGTvfFaIwS9bp6kYij43GKvRdfT5iv2ZoExEHbcEhu1OLAzVx31IM7/exec';
// Model path based on your GitHub Repo structure
const MODEL_URL = './models'; 

let labeledFaceDescriptors = [];
let currentAction = '';
let faceMatcher = null;
let isScanning = false;

const video = document.getElementById('video');

// 1. Initialize Application
async function init() {
  document.querySelector('.subtitle').innerText = "Loading AI Models...";
  
  // Load Models
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
  ]);

  document.querySelector('.subtitle').innerText = "Fetching Employee Data...";
  
  // Fetch known employees from Google Sheets
  await fetchEmployeeData();
  
  document.querySelector('.subtitle').innerText = "Ready";
}

// 2. Fetch Employee Embeddings from Backend
async function fetchEmployeeData() {
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getEmployees' })
    });
    const result = await response.json();
    
    if (result.status === 'success' && result.data.length > 0) {
      labeledFaceDescriptors = result.data.map(emp => {
        // Convert the standard array back to a Float32Array for face-api
        const floatArray = new Float32Array(emp.embedding);
        return new faceapi.LabeledFaceDescriptors(
          `${emp.id}||${emp.name} ${emp.lastName}`, // Store ID and Name together
          [floatArray]
        );
      });
      // Threshold 0.45 as requested
      faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.45);
    }
  } catch (error) {
    console.error("Error fetching employees:", error);
    alert("Could not load employee data. Check connection.");
  }
}

// 3. Start Camera & UI Flow
async function startFlow(action) {
  if (!faceMatcher) {
    alert("Employee data not loaded yet. Please wait.");
    return;
  }
  
  currentAction = action;
  document.getElementById('action-title').innerText = action;
  document.getElementById('main-menu').classList.add('hidden');
  document.getElementById('camera-screen').classList.remove('hidden');
  document.getElementById('status-message').innerText = "Position your face in the frame...";
  
  isScanning = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
  } catch (err) {
    console.error("Camera access denied", err);
    alert("Camera access is required.");
  }
}

// 4. Perform Face Recognition Frame-by-Frame
video.addEventListener('play', () => {
  const canvas = document.getElementById('overlay');
  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  const scanInterval = setInterval(async () => {
    if (!isScanning) {
      clearInterval(scanInterval);
      return;
    }

    const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (detections) {
      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      faceapi.draw.drawDetections(canvas, resizedDetections);

      const bestMatch = faceMatcher.findBestMatch(detections.descriptor);
      
      if (bestMatch.label !== 'unknown') {
        // MATCH FOUND
        isScanning = false; // Stop scanning
        clearInterval(scanInterval);
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        
        const [empId, empName] = bestMatch.label.split('||');
        document.getElementById('status-message').innerText = `Identified as ${empName}. Logging...`;
        
        await recordLog(empId, empName, bestMatch.distance);
      } else {
        document.getElementById('status-message').innerText = "Unknown face. Try moving closer.";
      }
    } else {
      document.getElementById('status-message').innerText = "Position your face in the frame...";
    }
  }, 300); // Check every 300ms
});

// 5. Send Time Log to Backend
async function recordLog(empId, empName, distance) {
  // Stop camera
  video.srcObject.getTracks().forEach(track => track.stop());
  
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'logTime',
        payload: {
          employeeId: empId,
          type: currentAction,
          confidence: (1 - distance).toFixed(2), // Convert distance to confidence %
          device: navigator.userAgent.includes('Mobile') ? 'Mobile/Tablet' : 'Desktop'
        }
      })
    });
    
    const result = await response.json();
    
    if (result.status === 'success') {
      showSuccess(empName, result.time);
    }
  } catch (error) {
    console.error(error);
    alert("Failed to save log to database.");
    resetUI();
  }
}

function showSuccess(name, time) {
  document.getElementById('camera-screen').classList.add('hidden');
  document.getElementById('success-screen').classList.remove('hidden');
  
  document.getElementById('success-name').innerText = `Welcome ${name}`;
  document.getElementById('success-action').innerText = `${currentAction} Successful`;
  document.getElementById('success-time').innerText = time;
  
  // Auto return to menu after 4 seconds
  setTimeout(resetUI, 4000);
}

function cancelFlow() {
  isScanning = false;
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
  }
  resetUI();
}

function resetUI() {
  document.getElementById('success-screen').classList.add('hidden');
  document.getElementById('camera-screen').classList.add('hidden');
  document.getElementById('main-menu').classList.remove('hidden');
  currentAction = '';
}

// Start application
window.onload = init;
