// === CONFIGURATION ===
const GAS_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL';
const MODEL_URL = './models'; 

let labeledFaceDescriptors = [];
let currentAction = '';
let faceMatcher = null;
let isScanning = false;
let scanInterval = null;

const video = document.getElementById('video');

// Initialize Application
async function init() {
  document.querySelector('.subtitle').innerText = "Loading AI Models...";
  
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
  ]);

  document.querySelector('.subtitle').innerText = "Fetching Employee Data...";
  await fetchEmployeeData();
  
  document.querySelector('.subtitle').innerText = "Ready";
}

// Fetch Employee Embeddings
async function fetchEmployeeData() {
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getEmployees' })
    });
    const result = await response.json();
    
    if (result.status === 'success' && result.data.length > 0) {
      labeledFaceDescriptors = result.data.map(emp => {
        const floatArray = new Float32Array(emp.embedding);
        return new faceapi.LabeledFaceDescriptors(
          `${emp.id}||${emp.name} ${emp.lastName}`,
          [floatArray]
        );
      });
      faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.45);
    }
  } catch (error) {
    console.error("Error fetching employees:", error);
    alert("Could not load employee data. Check connection.");
  }
}

// Start Camera Flow
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

// Face Recognition Loop
video.addEventListener('play', () => {
  const canvas = document.getElementById('overlay');
  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  scanInterval = setInterval(async () => {
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
        isScanning = false;
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
  }, 300);
});

// Save Log to Database
async function recordLog(empId, empName, distance) {
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
  }
  
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'logTime',
        payload: {
          employeeId: empId,
          type: currentAction,
          confidence: (1 - distance).toFixed(2),
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
  
  setTimeout(resetUI, 4000);
}

function cancelFlow() {
  isScanning = false;
  if (scanInterval) clearInterval(scanInterval);
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

window.onload = init;
