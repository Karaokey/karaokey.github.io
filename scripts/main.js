/* Copyright 2013 Chris Wilson

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = new AudioContext();
var audioInput = null,
    realAudioInput = null,
    inputPoint = null,
    audioRecorder = null;
    partialRecorder = null;
var rafID = null;
var analyserContext = null;
var canvasWidth, canvasHeight;
var recIndex = 0;

// window.onload = initAudio;
var recording = false;
/* TODO:

- offer mono option
- "Monitor input" switch
*/


function saveAudio(partial) {
    // console.log("function saveAudio");
    audioRecorder.exportWAV( doneEncoding, partial );
    partialRecorder.exportWAV( doneEncoding, partial);
    // could get mono instead by saying
    // audioRecorder.exportMonoWAV( doneEncoding );
}

function gotBuffers(data) {
    var buffers = data.buffers;
    var partial = data.partial;
    // console.log("function gotBuffers", partial);
    // var canvas = document.getElementById( "wavedisplay" );

    // drawBuffer( canvas.width, canvas.height, canvas.getContext('2d'), buffers[0] );

    // the ONLY time gotBuffers is called is right after a new recording is completed - 
    // so here's where we should set up the download.
    if (partial == "partial")
        partialRecorder.exportWAV( doneEncoding, partial );
    if (partial == "full")
        audioRecorder.exportWAV( doneEncoding, partial );
}

function doneEncoding( data, type ) {
    var blob = data.blob;
    var partial = data.partial;
    // console.log("function doneEncoding", partial, blob, data);
    Recorder.setupDownload(blob, "myRecording" + ((recIndex<10)?"0":"") + recIndex + ".wav", partial );

    if (partial == "partial") {
        partialRecorder.clear();
        partialRecorder.record();
    }
    recIndex++;
}

function partial() {
    if (!recording)
        return;
    // console.log("function partial");
    partialRecorder.stop();
    partialRecorder.getBuffers( gotBuffers, "partial" );
    // partialRecorder.clear();
    // partialRecorder.record();
}

function toggleRecording() {
    console.log("function toggleRecording");
    if (recording) {
        // console.log("FIN-----");
        recording = false;
        // stop recording
        // document.getElementById('textbox').innerHTML = "Uploading!"
        audioRecorder.stop();
        partialRecorder.stop();
        audioRecorder.getBuffers( gotBuffers, "full" );
        partialRecorder.getBuffers( gotBuffers, "partial" );
    } else {
        // console.log("startrecording");
        // start recording
        recording = true;
        // document.getElementById('textbox').innerHTML = "Recording!"
        if (!audioRecorder)
            return;

        // console.log("initrecorder");
        audioRecorder.clear();
        audioRecorder.record();

        partialRecorder.clear();
        partialRecorder.record();

        // console.log("partialinterval");
        setInterval(partial, 10000);
    }
}

function convertToMono( input ) {
    var splitter = audioContext.createChannelSplitter(2);
    var merger = audioContext.createChannelMerger(2);

    input.connect( splitter );
    splitter.connect( merger, 0, 0 );
    splitter.connect( merger, 0, 1 );
    return merger;
}

function cancelAnalyserUpdates() {
    window.cancelAnimationFrame( rafID );
    rafID = null;
}

function updateAnalysers(time) {
    if (!analyserContext) {
        var canvas = document.getElementById("visualization");
        // console.log(2, canvas);
        canvasWidth = canvas.width;
        canvasHeight = canvas.height;
        analyserContext = canvas.getContext('2d');
    }

    // analyzer draw code here
    {
        var SPACING = 10;
        var BAR_WIDTH = 9;
        var numBars = Math.round(canvasWidth / SPACING)*7;
        var freqByteData = new Uint8Array(analyserNode.frequencyBinCount);

        analyserNode.getByteFrequencyData(freqByteData); 

        analyserContext.clearRect(0, 0, canvasWidth, canvasHeight);
        analyserContext.fillStyle = '#F6D565';
        analyserContext.lineCap = 'round';
        var multiplier = analyserNode.frequencyBinCount / numBars;

        // Draw rectangle for each frequency bin.
        for (var i = 0; i < numBars; ++i) {
            var magnitude = 0;
            var offset = Math.floor( i * multiplier );
            for (var j = 0; j< multiplier; j++)
                magnitude += freqByteData[offset + j];
            magnitude = magnitude / multiplier;
            if (!recording)
                magnitude = 0;
            var min = 40;
            var max = 60;
            var value = (max-min)/numBars*(i*15) + min;

            var min2 = 50;
            var max2 = 80;
            var sat = (max2-min2)/numBars*(i*30) + min2;

            // analyserContext.fillStyle = "hsl( " + Math.round((i*360*5)/numBars) + ", 100%, 50%)";
            analyserContext.fillStyle = "hsl(203, " + min2 + "%, " + value + "%)";
            analyserContext.fillRect(i * SPACING, canvasHeight, BAR_WIDTH, -2.5*magnitude);
        }
    }
    
    rafID = window.requestAnimationFrame( updateAnalysers );
}

function toggleMono() {
    if (audioInput != realAudioInput) {
        audioInput.disconnect();
        realAudioInput.disconnect();
        audioInput = realAudioInput;
    } else {
        realAudioInput.disconnect();
        audioInput = convertToMono( realAudioInput );
    }

    audioInput.connect(inputPoint);
}

function gotStream(stream) {
    inputPoint = audioContext.createGain();

    // Create an AudioNode from the stream.
    realAudioInput = audioContext.createMediaStreamSource(stream);
    audioInput = realAudioInput;
    audioInput.connect(inputPoint);

//    audioInput = convertToMono( input );

    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 2048;
    inputPoint.connect( analyserNode );

    audioRecorder = new Recorder( inputPoint );
    partialRecorder = new Recorder( inputPoint );

    zeroGain = audioContext.createGain();
    zeroGain.gain.value = 0.0;
    inputPoint.connect( zeroGain );
    zeroGain.connect( audioContext.destination );
    updateAnalysers();
}

function setUuid(uuid) {
    // audioRecorder.setUuid(uuid);
    // partialRecorder.setUuid(uuid);
    Recorder.setUuid(uuid);
}

function initAudio() {
        if (!navigator.getUserMedia)
            navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        if (!navigator.cancelAnimationFrame)
            navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
        if (!navigator.requestAnimationFrame)
            navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;


    // var canvas = document.getElementById( "wavedisplay" );
    // canvas.width = window.innerWidth;
    // canvas.height = window.innerHeight - 100;
    canvas = document.getElementById("visualization");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 100;
    console.log(canvas);

    navigator.getUserMedia(
        {
            "audio": {
                "mandatory": {
                    "googEchoCancellation": "false",
                    "googAutoGainControl": "false",
                    "googNoiseSuppression": "false",
                    "googHighpassFilter": "false"
                },
                "optional": []
            },
        }, gotStream, function(e) {
            alert('Error getting audio');
            console.log(e);
        });
}
