const API_URL =
    'https://script.google.com/macros/s/AKfycbwBIoPttZR_stBYRxw79rYI743HYTo2cyfaNjcKkLFizGKvajJ4u4ln0sPv82QQrXAU/exec';

const MODEL_URL =
    './models';

const video =
    document.getElementById('video');

const statusElement =
    document.getElementById('status');


async function loadModels() {

    statusElement.innerText =
        'Loading face recognition models...';

    await faceapi.nets.tinyFaceDetector.loadFromUri(
        MODEL_URL
    );

    await faceapi.nets.faceLandmark68Net.loadFromUri(
        MODEL_URL
    );

    await faceapi.nets.faceRecognitionNet.loadFromUri(
        MODEL_URL
    );

    statusElement.innerText =
        'Models loaded successfully';

}


async function startCamera() {

    try {

        const stream =
            await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });

        video.srcObject = stream;

        statusElement.innerText =
            'Camera started';

    } catch (error) {

        console.error(error);

        statusElement.innerText =
            'Unable to access camera';

    }

}


async function getFaceDescriptor() {

    const detection =
        await faceapi
            .detectSingleFace(
                video,
                new faceapi.TinyFaceDetectorOptions()
            )
            .withFaceLandmarks()
            .withFaceDescriptor();

    if (!detection) {

        throw new Error(
            'No face detected'
        );

    }

    return Array.from(
        detection.descriptor
    );

}


async function registerFace() {

    try {

        const name =
            document.getElementById('name')
                .value
                .trim();

        const email =
            document.getElementById('email')
                .value
                .trim();

        if (!name) {

            alert(
                'Please enter a name'
            );

            return;

        }

        statusElement.innerText =
            'Detecting face...';

        const descriptor =
            await getFaceDescriptor();

        statusElement.innerText =
            'Saving face...';

        const response =
            await fetch(API_URL, {

                method: 'POST',

                body: JSON.stringify({

                    action: 'register',

                    name: name,

                    email: email,

                    descriptor: descriptor

                })

            });

        const result =
            await response.json();

        if (result.success) {

            statusElement.innerText =
                'Face registered successfully';

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


async function recognizeFace() {

    try {

        statusElement.innerText =
            'Detecting face...';

        const currentDescriptor =
            await getFaceDescriptor();

        statusElement.innerText =
            'Loading registered faces...';

        const response =
            await fetch(API_URL, {

                method: 'POST',

                body: JSON.stringify({

                    action: 'getFaces'

                })

            });

        const result =
            await response.json();

        if (!result.success) {

            throw new Error(
                result.message
            );

        }

        if (result.faces.length === 0) {

            statusElement.innerText =
                'No registered faces found';

            return;

        }

        let bestMatch = null;

        let bestDistance = Infinity;

        result.faces.forEach(face => {

            const distance =
                faceapi.euclideanDistance(
                    currentDescriptor,
                    face.descriptor
                );

            if (distance < bestDistance) {

                bestDistance =
                    distance;

                bestMatch =
                    face;

            }

        });

        const MATCH_THRESHOLD =
            0.6;

        if (
            bestMatch &&
            bestDistance < MATCH_THRESHOLD
        ) {

            statusElement.innerText =
                `Match found: ${bestMatch.name}
                Distance: ${bestDistance.toFixed(4)}`;

        } else {

            statusElement.innerText =
                `No match found.
                Best distance: ${bestDistance.toFixed(4)}`;

        }

    } catch (error) {

        console.error(error);

        statusElement.innerText =
            error.message;

    }

}


loadModels();
