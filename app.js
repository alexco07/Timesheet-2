// COMPLETE FILE
const API_URL = 'https://script.google.com/macros/s/AKfycbwBIoPttZR_stBYRxw79rYI743HYTo2cyfaNjcKkLFizGKvajJ4u4ln0sPv82QQrXAU/exec'; 

// DOM Elements
const video = document.getElementById('video');
const statusElement = document.getElementById('status');

// Configuration
const NUM_CAPTURES = 5; 
let modelsLoaded = false;

/**
 * Initializes the camera and loads face-api.js models.
 */
async function init() {
    setStatus('Loading models...');
    try {
        // Load the required models from the models directory
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        modelsLoaded = true;
        
        setStatus('Models loaded. Starting camera...');
        startVideo();
    } catch (error) {
        console.error('Error loading models:', error);
        setStatus('Failed to load models.');
    }
}

/**
 * Starts the webcam video stream.
 */
function startVideo() {
    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => {
            video.srcObject = stream;
            setStatus('Camera active. Ready for registration.');
        })
        .catch(err => {
            console.error("Camera access denied:", err);
            setStatus('Please allow camera access.');
        });
}

/**
 * Helper: Updates the UI status text.
 */
function setStatus(message) {
    if (statusElement) {
        statusElement.innerText = message;
    }
    console.log(message);
}

/**
 * Helper: Ensures models are fully loaded before proceeding.
 */
async function waitForModels() {
    if (modelsLoaded) return;
    return new Promise(resolve => {
        const checkInterval = setInterval(() => {
            if (modelsLoaded) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);
    });
}

/**
 * Helper: Validates that the video stream is active and playing.
 */
function validateCamera() {
    if (!video || !video.srcObject || video.paused || video.ended) {
        throw new Error("Camera is not active or video feed is missing.");
    }
}

/**
 * Helper: Captures multiple face descriptors to create a robust profile.
 */
async function captureMultipleFaceDescriptors() {
    const descriptors = [];
    let captures = 0;

    while (captures < NUM_CAPTURES) {
        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (detection) {
            descriptors.push(detection.descriptor);
            captures++;
            setStatus(`Capturing face data... (${captures}/${NUM_CAPTURES})`);
        } else {
            setStatus('No face detected. Please look at the camera.');
        }
        
        // Brief pause between captures to get slight variations
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    return descriptors;
}

/**
 * Helper: Averages multiple 128-value descriptors into a single stable descriptor.
 */
function averageFaceDescriptors(descriptors) {
    if (!descriptors || descriptors.length === 0) {
        throw new Error("No descriptors provided to average.");
    }

    const numDescriptors = descriptors.length;
    const descriptorLength = descriptors[0].length; // Should be 128
    const average = new Float32Array(descriptorLength);

    for (let i = 0; i < descriptorLength; i++) {
        let sum = 0;
        for (let j = 0; j < numDescriptors; j++) {
            sum += descriptors[j][i];
        }
        average[i] = sum / numDescriptors;
    }

    // Convert Float32Array to standard array for JSON serialization
    return Array.from(average);
}

/**
 * Core function provided by user: Registers the face.
 */
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

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
                action: 'register',
                name: name,
                email: email,
                descriptor: averageDescriptor
            })
        });

        const result = await response.json();
        console.log('Registration result:', result);

        if (result.success) {
            setStatus('Face registered successfully!');
            if (nameElement) nameElement.value = '';
            if (emailElement) emailElement.value = '';
        } else {
            throw new Error(result.message || 'Unable to register face.');
        }
    } catch (error) {
        console.error('REGISTRATION ERROR:', error);
        setStatus('Registration error: ' + error.message);
    }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', init);
