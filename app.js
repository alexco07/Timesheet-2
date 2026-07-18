const API_URL =
    'https://script.google.com/macros/s/AKfycbwBIoPttZR_stBYRxw79rYI743HYTo2cyfaNjcKkLFizGKvajJ4u4ln0sPv82QQrXAU/exec';

const MODEL_URL =
    './models';

const video =
    document.getElementById('video');

const statusElement =
    document.getElementById('status');

let modelsLoaded = false;


/* =========================
   LOAD MODELS
========================= */

async function loadModels() {

    try {

        statusElement.innerText =
            'Loading models...';

        await faceapi.nets.tinyFaceDetector.loadFromUri(
            MODEL_URL
        );

        await faceapi.nets.faceLandmark68Net.loadFromUri(
            MODEL_URL
        );

        await faceapi.nets.faceRecognitionNet.loadFromUri(
            MODEL_URL
        );

        modelsLoaded = true;

        statusElement.innerText =
            'Models loaded. Click Start Camera.';

    } catch (error) {

        console.error(error);

        statusElement.innerText =
            'Error loading models. Check console.';

    }

}


/* =========================
   START CAMERA
========================= */

async function startCamera() {

    try {

        statusElement.innerText =
            'Starting camera...';

        const stream =
            await navigator.mediaDevices.getUserMedia({

                video: true,

                audio: false

            });

        video.srcObject =
            stream;

        video.onloadedmetadata =
            () => {

                video.play();

                statusElement.innerText =
                    'Camera ready.';

            };

    } catch (error) {

        console.error(error);

        statusElement.innerText =
            'Camera error: ' +
            error.message;

    }

}


/* =========================
   DETECT FACE
========================= */

async function getFaceDescriptor() {

    if (!modelsLoaded) {

        throw new Error(
            'Models are still loading.'
        );

    }

    if (!video.srcObject) {

        throw new Error(
            'Start the camera first.'
        );

    }

    statusElement.innerText =
        'Detecting face...';

    const detection =
        await faceapi.detectSingleFace(

            video,

            new faceapi.TinyFaceDetectorOptions({

                inputSize: 416,

                scoreThreshold: 0.5

            })

        )
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (!detection) {

        throw new Error(
            'No face detected.'
        );

    }

    return Array.from(
        detection.descriptor
    );

}


/* =========================
   REGISTER FACE
========================= */

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

        statusElement.innerText =
            'Saving face...';

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

        if (result.success) {

            statusElement.innerText =
                'Face registered successfully!';

        } else {

            statusElement.innerText =
                result.message;

        }

    } catch (error) {

        console.error(error);

        statusElement.innerText =
            error.message;

    }

}


/* =========================
   RECOGNIZE FACE
========================= */

async function recognizeFace() {

    try {

        const currentDescriptor =
            await getFaceDescriptor();

        statusElement.innerText =
            'Loading registered faces...';

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

        if (
            !result.success
        ) {

            throw new Error(
                result.message
            );

        }

        if (
            result.faces.length === 0
        ) {

            statusElement.innerText =
                'No registered faces found.';

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

        if (
            bestDistance < 0.6
        ) {

            statusElement.innerText =
                'Match found: ' +
                bestMatch.name +
                ' | Distance: ' +
                bestDistance.toFixed(4);

        } else {

            statusElement.innerText =
                'No match found. Best distance: ' +
                bestDistance.toFixed(4);

        }

    } catch (error) {

        console.error(error);

        statusElement.innerText =
            error.message;

    }

}


/* =========================
   INITIALIZE
========================= */

loadModels();
