const API_URL =
    'https://script.google.com/macros/s/AKfycbwBIoPttZR_stBYRxw79rYI743HYTo2cyfaNjcKkLFizGKvajJ4u4ln0sPv82QQrXAU/exec';

const MODEL_URL =
    './models';

const video =
    document.getElementById('video');

const statusElement =
    document.getElementById('status');

let modelsLoaded = false;
let cameraStarted = false;


/* ================================
   STATUS
================================ */

function setStatus(message) {

    console.log(message);

    statusElement.innerText =
        message;

}


/* ================================
   LOAD MODELS
================================ */

async function loadModels() {

    try {

        setStatus(
            'Loading face detection model...'
        );

        await faceapi.nets.tinyFaceDetector.loadFromUri(
            MODEL_URL
        );

        setStatus(
            'Loading face landmark model...'
        );

        await faceapi.nets.faceLandmark68Net.loadFromUri(
            MODEL_URL
        );

        setStatus(
            'Loading face recognition model...'
        );

        await faceapi.nets.faceRecognitionNet.loadFromUri(
            MODEL_URL
        );

        modelsLoaded = true;

        setStatus(
            'Models loaded successfully. Start the camera.'
        );

        console.log(
            'All face recognition models loaded'
        );

    } catch (error) {

        console.error(
            'MODEL LOADING ERROR:',
            error
        );

        setStatus(
            'ERROR loading models. Open browser console.'
        );

    }

}


/* ================================
   START CAMERA
================================ */

async function startCamera() {

    try {

        if (!modelsLoaded) {

            setStatus(
                'Please wait until the models finish loading.'
            );

            return;

        }

        setStatus(
            'Requesting camera permission...'
        );

        const stream =
            await navigator.mediaDevices.getUserMedia({

                video: {

                    facingMode: 'user',

                    width: {
                        ideal: 640
                    },

                    height: {
                        ideal: 480
                    }

                },

                audio: false

            });

        video.srcObject =
            stream;

        await new Promise((resolve) => {

            video.onloadedmetadata =
                () => {

                    resolve();

                };

        });

        await video.play();

        cameraStarted =
            true;

        setStatus(
            'Camera ready. Look at the camera.'
        );

        console.log(
            'Video width:',
            video.videoWidth
        );

        console.log(
            'Video height:',
            video.videoHeight
        );

    } catch (error) {

        console.error(
            'CAMERA ERROR:',
            error
        );

        setStatus(
            'Camera error: ' +
            error.message
        );

    }

}


/* ================================
   GET FACE DESCRIPTOR
================================ */

async function getFaceDescriptor() {

    if (!modelsLoaded) {

        throw new Error(
            'Models are not loaded yet.'
        );

    }

    if (!cameraStarted) {

        throw new Error(
            'Camera is not started.'
        );

    }

    if (
        video.readyState <
        HTMLMediaElement.HAVE_CURRENT_DATA
    ) {

        throw new Error(
            'Video is not ready yet.'
        );

    }

    if (
        video.videoWidth === 0 ||
        video.videoHeight === 0
    ) {

        throw new Error(
            'Camera video has no dimensions.'
        );

    }

    setStatus(
        'Detecting face...'
    );

    console.log(
        'Starting face detection...'
    );

    const detection =
        await faceapi
            .detectSingleFace(

                video,

                new faceapi.TinyFaceDetectorOptions({

                    inputSize: 320,

                    scoreThreshold: 0.5

                })

            )
            .withFaceLandmarks()
            .withFaceDescriptor();

    console.log(
        'Detection result:',
        detection
    );

    if (!detection) {

        throw new Error(
            'No face detected. Move closer and face the camera.'
        );

    }

    setStatus(
        'Face detected successfully.'
    );

    return Array.from(
        detection.descriptor
    );

}


/* ================================
   REGISTER FACE
================================ */

async function registerFace() {

    try {

        const name =
            document
                .getElementById('name')
                .value
                .trim();

        const email =
            document
                .getElementById('email')
                .value
                .trim();

        if (!name) {

            alert(
                'Please enter a name.'
            );

            return;

        }

        const descriptor =
            await getFaceDescriptor();

        setStatus(
            'Saving face descriptor...'
        );

        const response =
            await fetch(

                API_URL,

                {

                    method: 'POST',

                    body: JSON.stringify({

                        action:
                            'register',

                        name:
                            name,

                        email:
                            email,

                        descriptor:
                            descriptor

                    })

                }

            );

        const result =
            await response.json();

        console.log(
            'Registration result:',
            result
        );

        if (result.success) {

            setStatus(
                'Face registered successfully!'
            );

        } else {

            throw new Error(
                result.message
            );

        }

    } catch (error) {

        console.error(
            'REGISTRATION ERROR:',
            error
        );

        setStatus(
            'Registration error: ' +
            error.message
        );

    }

}


/* ================================
   RECOGNIZE FACE
================================ */

async function recognizeFace() {

    try {

        const currentDescriptor =
            await getFaceDescriptor();

        setStatus(
            'Loading registered faces...'
        );

        const response =
            await fetch(

                API_URL,

                {

                    method: 'POST',

                    body: JSON.stringify({

                        action:
                            'getFaces'

                    })

                }

            );

        const result =
            await response.json();

        if (!result.success) {

            throw new Error(
                result.message
            );

        }

        if (
            result.faces.length === 0
        ) {

            setStatus(
                'No registered faces found.'
            );

            return;

        }

        let bestMatch =
            null;

        let bestDistance =
            Infinity;

        result.faces.forEach(

            face => {

                const distance =
                    faceapi.euclideanDistance(

                        currentDescriptor,

                        face.descriptor

                    );

                if (
                    distance <
                    bestDistance
                ) {

                    bestDistance =
                        distance;

                    bestMatch =
                        face;

                }

            }

        );

        const MATCH_THRESHOLD =
            0.6;

        if (

            bestMatch &&
            bestDistance <
            MATCH_THRESHOLD

        ) {

            setStatus(

                'MATCH FOUND: ' +
                bestMatch.name +
                ' | Distance: ' +
                bestDistance.toFixed(4)

            );

        } else {

            setStatus(

                'No match found. Best distance: ' +
                bestDistance.toFixed(4)

            );

        }

    } catch (error) {

        console.error(
            'RECOGNITION ERROR:',
            error
        );

        setStatus(
            'Recognition error: ' +
            error.message
        );

    }

}


/* ================================
   START
================================ */

loadModels();
