const video = document.getElementById('video');
const regStatus = document.getElementById('reg-status');
const btnRegister = document.getElementById('btn-register');

let currentDescriptor = null;

async function initRegistration() {
  try {
    // Updated to use the absolute model repository URL
    const MODEL_URL = 'https://alexco07.github.io/alexco07/models/';
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    
    regStatus.innerText = "Looking for face...";
    startVideo();
  } catch(e) {
    regStatus.innerText = "Error loading models: " + e.message;
  }
}

function startVideo() {
  navigator.mediaDevices.getUserMedia({ video: {} })
    .then(stream => { video.srcObject = stream; })
    .catch(err => { regStatus.innerText = "Camera error: " + err; });
}

video.addEventListener('play', () => {
  setInterval(async () => {
    const detection = await faceapi.detectSingleFace(video)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (detection) {
      currentDescriptor = Array.from(detection.descriptor);
      regStatus.innerText = "Face detected! Ready to register.";
      regStatus.style.color = "green";
      btnRegister.disabled = false;
    } else {
      currentDescriptor = null;
      regStatus.innerText = "No face detected in frame.";
      regStatus.style.color = "red";
      btnRegister.disabled = true;
    }
  }, 1000);
});

async function captureAndRegister() {
  const id = document.getElementById('emp-id').value;
  const name = document.getElementById('emp-name').value;
  const email = document.getElementById('emp-email').value;

  if (!id || !name || !currentDescriptor) {
    alert("Please fill all fields and ensure face is detected.");
    return;
  }

  btnRegister.disabled = true;
  regStatus.innerText = "Saving to database...";

  const payload = {
    employeeId: id,
    name: name,
    email: email,
    descriptor: currentDescriptor
  };

  const res = await callAPI('registerEmployee', payload);
  
  if(res.status === 'success') {
    alert("Employee registered successfully!");
    document.getElementById('emp-id').value = '';
    document.getElementById('emp-name').value = '';
    document.getElementById('emp-email').value = '';
  } else {
    alert("Error: " + res.message);
  }
}

initRegistration();
