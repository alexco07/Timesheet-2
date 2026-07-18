const API_URL =
    'https://script.google.com/macros/s/AKfycbwBIoPttZR_stBYRxw79rYI743HYTo2cyfaNjcKkLFizGKvajJ4u4ln0sPv82QQrXAU/exec';

const MODEL_URL =
    './models';

const video =
    document.getElementById('video');

const statusElement =
    document.getElementById('status');

let modelsLoaded = false;
let modelsLoading = false;


/* =========================================================
   STATUS MESSAGE
========================================================= */

function setStatus(message) {

    if (statusElement) {

        statusElement.innerText =
            message;

    }

    console.log(message);

}


/* =========================================================
   LOAD FACE API MODELS
========================================================= */

async function loadModels() {

    if (modelsLoaded) {

        return;

    }

    if (modelsLoading) {

        return;

    }

    modelsLoading =
        true;

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


        modelsLoaded =
            true;

        modelsLoading =
            false;

        setStatus(
            'Models loaded successfully. Start the camera.'
        );

        console.log(
            'All face recognition models loaded successfully.'
        );

    } catch (error) {

        modelsLoading =
            false;

        modelsLoaded =
            false;

        console.error(
            'MODEL LOADING ERROR:',
            error
        );

        setStatus(
            'Error loading face recognition models.'
        );

    }

}


/* =========================================================
   START CAMERA
========================================================= */

async function startCamera() {

    try {

        setStatus(
            'Starting camera...'
        );


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


                setStatus(
                    'Camera ready. Look at the camera.'
                );

            };


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


/* =========================================================
   GET FACE DESCRIPTOR
========================================================= */

async function getFaceDescriptor() {


    if (!modelsLoaded) {

        setStatus(
            'Face recognition models are still loading...'
        );


        await waitForModels();


    }


    if (!video.srcObject) {

        throw new Error(
            'Please start the camera first.'
        );

    }


    setStatus(
        'Detecting face...'
    );


    const detection =

        await faceapi

            .detectSingleFace(

                video,

                new faceapi.TinyFaceDetectorOptions({

                    inputSize:
                        416,

                    scoreThreshold:
                        0.5

                })

            )

            .withFaceLandmarks()

            .withFaceDescriptor();


    if (!detection) {

        throw new Error(

            'No face detected. Please look directly at the camera.'

        );

    }


    setStatus(
        'Face detected successfully.'
    );


    return Array.from(

        detection.descriptor

    );

}


/* =========================================================
   WAIT FOR MODELS
========================================================= */

function waitForModels() {

    return new Promise(

        (resolve, reject) => {


            const startTime =
                Date.now();


            const timeout =
                30000;


            const interval =
                setInterval(

                    () => {


                        if (modelsLoaded) {

                            clearInterval(
                                interval
                            );

                            resolve();

                            return;

                        }


                        if (

                            Date.now() -
                            startTime >
                            timeout

                        ) {

                            clearInterval(
                                interval
                            );

                            reject(

                                new Error(

                                    'Face recognition models could not be loaded.'

                                )

                            );

                        }

                    },

                    100

                );

        }

    );

}


/* =========================================================
   REGISTER FACE
========================================================= */

async function registerFace() {

    try {


        const name =

            document

                .getElementById(
                    'name'
                )

                .value

                .trim();


        const email =

            document

                .getElementById(
                    'email'
                )

                .value

                .trim();


        if (!name) {

            alert(
                'Please enter a name.'
            );

            return;

        }


        setStatus(
            'Preparing face recognition...'
        );


        const descriptor =

            await getFaceDescriptor();


        setStatus(
            'Saving face descriptor...'
        );


        const response =

            await fetch(

                API_URL,

                {

                    method:
                        'POST',


                    body:

                        JSON.stringify({

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


/* =========================================================
   RECOGNIZE FACE
========================================================= */

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

                    method:
                        'POST',


                    body:

                        JSON.stringify({

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

                bestDistance.toFixed(
                    4
                )

            );


        } else {


            setStatus(

                'No match found. Best distance: ' +

                bestDistance.toFixed(
                    4
                )

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


/* =========================================================
   INITIALIZE APPLICATION
========================================================= */

loadModels();
