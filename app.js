/* =========================================================
   CONFIGURATION
========================================================= */
const API_URL = 'https://script.google.com/macros/s/AKfycbzF5wHjpS2JhgVydZnSFWc0-D9rR-F_XTBw01notxBcP7HffpF365vwhaDXtRTytcJ9/exec';
const MODEL_URL = './models';

/* =========================================================
   APPLICATION ELEMENTS
========================================================= */
const video = document.getElementById('video');
const statusElement = document.getElementById('status');

/* =========================================================
   APPLICATION STATE
========================================================= */
let modelsLoaded = false;
let modelsLoading = false;
let cameraStarted = false;
let cameraStream = null;

/* =========================================================
   FACE RECOGNITION CONFIGURATION
========================================================= */
const FACE_RECOGNITION_CONFIG = {
    registrationSamples: 5,
    sampleDelay: 500,
    detectionInputSize: 416,
    detectionScoreThreshold: 0.5,
    recognitionThreshold: 0.6,
    minimumFaceBoxWidth: 80,
    minimumFaceBoxHeight: 80
};

/* =========================================================
   STATUS MESSAGE
========================================================= */
function setStatus(message) {
    if (statusElement) statusElement.innerText = message;
    console.log('[FACE APP]', message);
}

/* =========================================================
   LOAD MODELS
========================================================= */
async function loadModels() {
    if (modelsLoaded || modelsLoading) return;
    modelsLoading = true;
    try {
        setStatus('Loading face detection model...');
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        setStatus('Loading face recognition model...');
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        
        modelsLoaded = true;
        modelsLoading = false;
        setStatus('Models loaded successfully. Start the camera.');
        console.log('Face recognition models loaded successfully.');
    } catch (error) {
        modelsLoading = false;
        modelsLoaded = false;
        console.error('MODEL LOADING ERROR:', error);
        setStatus('Error loading face recognition models.');
    }
}

/* =========================================================
   WAIT FOR MODELS
========================================================= */
async function waitForModels() {
    if (modelsLoaded) return;
    if (!modelsLoading) loadModels();

    const maximumWaitTime = 30000;
    const startTime = Date.now();

    while (!modelsLoaded) {
        if (Date.now() - startTime > maximumWaitTime) {
            throw new Error('Face recognition models could not be loaded.');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

/* =========================================================
   START CAMERA
========================================================= */
async function startCamera() {
    try {
        setStatus('Starting camera...');
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }

        cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.srcObject = cameraStream;
        cameraStarted = true;

        await new Promise(resolve => {
            if (video.readyState >= 1) {
                resolve();
                return;
            }
            video.onloadedmetadata = () => resolve();
        });

        await video.play();
        setStatus('Camera ready. Look directly at the camera.');
        console.log('Camera started successfully.');
    } catch (error) {
        cameraStarted = false;
        console.error('CAMERA ERROR:', error);
        setStatus('Camera error: ' + error.message);
    }
}

/* =========================================================
   STOP CAMERA
========================================================= */
function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    video.srcObject = null;
    cameraStarted = false;
    setStatus('Camera stopped.');
}

/* =========================================================
   CHECK CAMERA
========================================================= */
function validateCamera() {
    if (!cameraStarted) throw new Error('Please start the camera first.');
    if (!video.srcObject) throw new Error('Camera stream is not available.');
    if (video.videoWidth === 0 || video.videoHeight === 0) throw new Error('Camera video is not ready yet.');
}

/* =========================================================
   DETECT ONE FACE
========================================================= */
async function detectFace() {
    await waitForModels();
    validateCamera();

    const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({
        inputSize: FACE_RECOGNITION_CONFIG.detectionInputSize,
        scoreThreshold: FACE_RECOGNITION_CONFIG.detectionScoreThreshold
    }));

    if (!detection) throw new Error('No face detected. Look directly at the camera.');

    const box = detection.box;
    if (box.width < FACE_RECOGNITION_CONFIG.minimumFaceBoxWidth || box.height < FACE_RECOGNITION_CONFIG.minimumFaceBoxHeight) {
        throw new Error('Your face is too far from the camera.');
    }

    return detection;
}

/* =========================================================
   GET FACE DESCRIPTOR
========================================================= */
async function getFaceDescriptor() {
    await waitForModels();
    validateCamera();
    setStatus('Detecting face...');

    const result = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({
        inputSize: FACE_RECOGNITION_CONFIG.detectionInputSize,
        scoreThreshold: FACE_RECOGNITION_CONFIG.detectionScoreThreshold
    }))
    .withFaceLandmarks()
    .withFaceDescriptor();

    if (!result) throw new Error('No face detected. Please look directly at the camera.');
    setStatus('Face detected successfully.');
    return Array.from(result.descriptor);
}

/* =========================================================
   CAPTURE MULTIPLE FACE DESCRIPTORS
========================================================= */
async function captureMultipleFaceDescriptors() {
    await waitForModels();
    validateCamera();

    const descriptors = [];
    const totalSamples = FACE_RECOGNITION_CONFIG.registrationSamples;

    for (let i = 0; i < totalSamples; i++) {
        setStatus('Registration sample ' + (i + 1) + ' of ' + totalSamples + '. Keep your face centered.');
        await new Promise(resolve => setTimeout(resolve, FACE_RECOGNITION_CONFIG.sampleDelay));

        const result = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({
            inputSize: FACE_RECOGNITION_CONFIG.detectionInputSize,
            scoreThreshold: FACE_RECOGNITION_CONFIG.detectionScoreThreshold
        }))
        .withFaceLandmarks()
        .withFaceDescriptor();

        if (!result) {
            setStatus('Face not detected. Retrying sample...');
            i--;
            continue;
        }

        const faceBox = result.detection.box;
        if (faceBox.width < FACE_RECOGNITION_CONFIG.minimumFaceBoxWidth) {
            setStatus('Face is too far away. Move closer.');
            i--;
            continue;
        }

        descriptors.push(Array.from(result.descriptor));
        setStatus('Sample ' + (i + 1) + ' captured successfully.');
    }

    if (descriptors.length === 0) throw new Error('No valid face samples were captured.');
    return descriptors;
}

/* =========================================================
   CREATE AVERAGE FACE DESCRIPTOR
========================================================= */
function averageFaceDescriptors(descriptors) {
    if (!descriptors || descriptors.length === 0) throw new Error('No face descriptors available.');

    const descriptorLength = descriptors[0].length;
    const averageDescriptor = new Array(descriptorLength).fill(0);

    descriptors.forEach(descriptor => {
        for (let i = 0; i < descriptorLength; i++) {
            averageDescriptor[i] += descriptor[i];
        }
    });

    for (let i = 0; i < descriptorLength; i++) {
        averageDescriptor[i] /= descriptors.length;
    }

    return averageDescriptor;
}

/* =========================================================
   REGISTER FACE
========================================================= */
async function registerFace() {
    try {
        const nameElement = document.getElementById('name');
        const emailElement = document.getElementById('email');
        const name = nameElement ? nameElement.value.trim() : '';
        const email = emailElement ? emailElement.value.trim() : '';

        if (!name) {
            alert('Please enter a name.');
            return;
        }

        await waitForModels();
        validateCamera();
        setStatus('Preparing face registration...');

        const descriptors = await captureMultipleFaceDescriptors();
        setStatus('Creating stable face profile...');
        
        const averageDescriptor = averageFaceDescriptors(descriptors);
        setStatus('Saving face profile...');

        const data = {
            action: 'register',
            name: name,
            email: email,
            descriptor: averageDescriptor
        };

        const response = await fetch(API_URL, {
            method: "POST",
            mode: "cors",
            redirect: "follow",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        console.log('Registration result:', result);

        if (result.success) {
            setStatus('Face registered successfully!');
        } else {
            throw new Error(result.message || 'Unable to register face.');
        }
    } catch (error) {
        console.error('REGISTRATION ERROR:', error);
        setStatus('Registration error: ' + error.message);
    }
}

/* =========================================================
   LOAD REGISTERED FACES
========================================================= */
async function loadRegisteredFaces() {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getFaces' })
    });

    const result = await response.json();
    if (!result.success) {
        throw new Error(result.message || 'Unable to load registered faces.');
    }
    return result.faces || [];
}

/* =========================================================
   RECOGNIZE FACE
========================================================= */
async function recognizeFace() {
    try {
        await waitForModels();
        validateCamera();
        setStatus('Detecting face...');

        const currentDescriptor = await getFaceDescriptor();
        setStatus('Loading registered faces...');

        const registeredFaces = await loadRegisteredFaces();
        if (registeredFaces.length === 0) {
            setStatus('No registered faces found.');
            return;
        }

        let bestMatch = null;
        let bestDistance = Infinity;

        registeredFaces.forEach(face => {
            if (!face.descriptor) return;
            const distance = faceapi.euclideanDistance(currentDescriptor, face.descriptor);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestMatch = face;
            }
        });

        if (!bestMatch) {
            setStatus('No valid registered face profiles found.');
            return;
        }

        const threshold = FACE_RECOGNITION_CONFIG.recognitionThreshold;
        if (bestDistance < threshold) {
            setStatus('MATCH FOUND: ' + bestMatch.name + ' | Distance: ' + bestDistance.toFixed(4));
            console.log('Recognized face:', bestMatch);
        } else {
            setStatus('No match found. Best distance: ' + bestDistance.toFixed(4));
        }
    } catch (error) {
        console.error('RECOGNITION ERROR:', error);
        setStatus('Recognition error: ' + error.message);
    }
}

/* =========================================================
   CLOCK IN / OUT WITH PHOTO
========================================================= */
async function submitClock(type) {
    try {
        const pinElement = document.getElementById('pin');
        const pin = pinElement ? pinElement.value.trim() : '';

        if (!pin) {
            alert('Please enter your PIN.');
            return;
        }

        validateCamera();
        setStatus('Capturing photo for ' + type + '...');

        // Create a canvas to extract the current video frame as an image
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Compress the image to Base64 (60% JPEG quality to save transmission/storage size)
        const photoData = canvas.toDataURL('image/jpeg', 0.6);

        setStatus('Saving ' + type + ' record...');

        const payload = {
            action: 'clockAction',
            type: type,
            pin: pin,
            photo: photoData
        };

        const response = await fetch(API_URL, {
            method: "POST",
            mode: "cors",
            redirect: "follow",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('Clock action result:', result);

        if (result.success) {
            setStatus(type + ' successful for PIN: ' + pin);
            pinElement.value = ''; // clear the PIN
        } else {
            throw new Error(result.message || 'Unable to record ' + type + '.');
        }
    } catch (error) {
        console.error('CLOCK ACTION ERROR:', error);
        setStatus('Error: ' + error.message);
    }
}

/* =========================================================
   INITIALIZE APPLICATION
========================================================= */
loadModels();
