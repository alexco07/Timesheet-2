const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const statusMsg = document.getElementById('status-msg');
const empName = document.getElementById('employee-name');
const empIdText = document.getElementById('employee-id');
const actionButtons = document.getElementById('action-buttons');

let loadedEmployees = [];
let currentIdentifiedEmployee = null;
let detectionInterval;

async function initKiosk() {
  try {
    statusMsg.innerText = "Loading face models...";
    
    // Updated to use the absolute model repository URL
    const MODEL_URL = 'https://alexco07.github.io/face-api-models/';
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

    statusMsg.innerText = "Fetching employees from database...";
    const res = await callAPI('getEmployees');
    if (res.status === 'success') {
      loadedEmployees = res.data;
    } else {
      statusMsg.innerText = "Error loading employees: " + res.message;
    }

    statusMsg.innerText = "Starting camera...";
    startVideo();
  } catch (e) {
    statusMsg.innerText = "Initialization error: " + e.message;
  }
}

function startVideo() {
  navigator.mediaDevices.getUserMedia({ video: {} })
    .then(stream => { video.srcObject = stream; })
    .catch(err => { statusMsg.innerText = "Camera error: " + err; });
}

video.addEventListener('play', () => {
  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(overlay, displaySize);
  statusMsg.style.display = 'none';

  detectionInterval = setInterval(async () => {
    const detection = await faceapi.detectSingleFace(video)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (detection) {
      const resizedDetection = faceapi.resizeResults(detection, displaySize);
      overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
      faceapi.draw.drawDetections(overlay, resizedDetection);

      identifyFace(detection.descriptor);
    } else {
      resetUI();
    }
  }, 1000);
});

function identifyFace(descriptor) {
  if (loadedEmployees.length === 0) return;

  let bestMatch = null;
  let lowestDistance = Infinity;

  loadedEmployees.forEach(emp => {
    if(emp.faceDescriptor.length > 0) {
      const storedDescriptor = new Float32Array(emp.faceDescriptor);
      const distance = faceapi.euclideanDistance(descriptor, storedDescriptor);
      if (distance < lowestDistance) {
        lowestDistance = distance;
        bestMatch = emp;
      }
    }
  });

  // 0.6 is a standard threshold for face-api.js euclidean distance
  if (lowestDistance < 0.6 && bestMatch) {
    currentIdentifiedEmployee = bestMatch;
    empName.innerText = `Welcome, ${bestMatch.name}`;
    empIdText.innerText = `ID: ${bestMatch.employeeId}`;
    actionButtons.classList.remove('disabled');
  } else {
    resetUI();
    empName.innerText = "Face not recognized";
  }
}

function resetUI() {
  currentIdentifiedEmployee = null;
  empName.innerText = "Please look at the camera";
  empIdText.innerText = "ID: ---";
  actionButtons.classList.add('disabled');
  overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
}

async function handleClockAction(action) {
  if (!currentIdentifiedEmployee) return;
  
  actionButtons.classList.add('disabled');
  empName.innerText = "Processing...";
  
  const res = await callAPI(action, {
    employeeId: currentIdentifiedEmployee.employeeId,
    name: currentIdentifiedEmployee.name
  });

  if (res.status === 'success') {
    empName.innerText = res.message;
    setTimeout(resetUI, 3000);
  } else {
    empName.innerText = "Error: " + res.message;
    setTimeout(resetUI, 3000);
  }
}

// Boot up
initKiosk();
