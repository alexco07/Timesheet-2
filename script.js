// =========================================================
// CONFIGURATION
// =========================================================
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const MODEL_URL = "https://alexco07.github.io/Timesheet-2/models";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const video = document.getElementById('video');
const statusElement = document.getElementById('status');

// Application State
let modelsLoaded = false;
let cameraStarted = false;
let cameraStream = null;

const FACE_RECOGNITION_CONFIG = {
    registrationSamples: 5,
    sampleDelay: 500,
    detectionInputSize: 416,
    detectionScoreThreshold: 0.5,
    recognitionThreshold: 0.6,
    minimumFaceBoxWidth: 80,
    minimumFaceBoxHeight: 80
};

// =========================================================
// UTILITIES
// =========================================================
function setStatus(message) {
    if (statusElement) statusElement.innerText = message;
    console.log('[FACE APP]', message);
}

async function loadModels() {
    try {
        setStatus('Loading models...');
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        modelsLoaded = true;
        setStatus('Models loaded. Ready.');
    } catch (error) {
        console.error(error);
        setStatus('Error loading models.');
    }
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        video.srcObject = stream;
        cameraStream = stream;
        cameraStarted = true;
        setStatus('Camera started.');
    } catch (err) {
        alert("Camera error: " + err.message);
    }
}

function validateCamera() {
    if (!cameraStarted) throw new Error('Please start the camera first.');
}

// =========================================================
// SUPABASE OPERATIONS
// =========================================================
async function saveFaceToSupabase(name, email, descriptor) {
    const { data, error } = await supabase
        .from('faces')
        .insert([{ name, email, descriptor }]);
    
    if (error) throw error;
    return data;
}

async function getFacesFromSupabase() {
    const { data, error } = await supabase
        .from('faces')
        .select('*');
    
    if (error) throw error;
    return data;
}

// =========================================================
// CORE LOGIC
// =========================================================
async function registerFace() {
    try {
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        if (!name) return alert('Enter a name');

        validateCamera();
        setStatus('Capturing samples...');
        
        // This is a simplified capture; reuse your existing logic if needed
        const result = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!result) throw new Error('No face detected.');

        setStatus('Saving to database...');
        await saveFaceToSupabase(name, email, Array.from(result.descriptor));
        
        setStatus('Registered successfully!');
    } catch (err) {
        setStatus('Registration failed: ' + err.message);
    }
}

async function recognizeFace() {
    try {
        validateCamera();
        setStatus('Detecting...');
        
        const result = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!result) throw new Error('No face detected.');

        setStatus('Searching...');
        const faces = await getFacesFromSupabase();
        
        let bestMatch = null;
        let bestDistance = Infinity;

        faces.forEach(face => {
            const dist = faceapi.euclideanDistance(result.descriptor, face.descriptor);
            if (dist < bestDistance) {
                bestDistance = dist;
                bestMatch = face;
            }
        });

        if (bestDistance < FACE_RECOGNITION_CONFIG.recognitionThreshold) {
            setStatus('Welcome, ' + bestMatch.name);
        } else {
            setStatus('Unknown user.');
        }
    } catch (err) {
        setStatus('Error: ' + err.message);
    }
}

// Init
loadModels();
