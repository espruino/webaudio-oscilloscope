
// ----------------------------------------------------------------------------------

var bufferSize = 256;
var drawSamples = new Array(bufferSize);
for (var i=0;i<bufferSize;i++) drawSamples[i]=0;
var samplesChanged = true;
var lastData = undefined;
var lastSample = 0;
var lastTriggered = 0;

function draw() {
  if (!samplesChanged) return;
  samplesChanged = false;

  var canvas = document.getElementById("canvas");
  var ctx = canvas.getContext("2d");

  var W = window.innerWidth;
  var H = window.innerHeight;

  canvas.width = W;
  canvas.height = H; 
  ctx.fillstyle = "black";
  ctx.fillRect(0,0,W,H);

  function getX(v) { return v*W/drawSamples.length; }
  function getY(v) { return (v+1)*H/2; }

  ctx.beginPath();
  ctx.moveTo(getX(0),getY(drawSamples[0]));
  for (var i = 0; i < drawSamples.length; ++i) {
    ctx.lineTo(getX(i), getY(drawSamples[i]));
  }
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
}  


// ----------------------------------------------------------------------------------

function processAudio(e) { 
  // console.log("Foo");
  var data = e.inputBuffer.getChannelData(0);

  // find trigger
  var triggerIdx = undefined;
  if (lastData!==undefined) {
    for (var i = lastData.length - (bufferSize/2); i < lastData.length; ++i) {
      var sample = lastData[i];
 
      lastTriggered++;
      if (sample>0 && lastSample<=0) {
        triggerIdx = 0;
        lastTriggered = 0;
      }
      lastSample = sample;
    }
  }
  for (var i = 0; i < data.length - (bufferSize/2); ++i) {
    var sample = data[i];

    lastTriggered++;
    if (sample>0 && lastSample<=0) {
      triggerIdx = 0;
      lastTriggered = 0;
    }
    lastSample = sample;
  }
  // auto-trigger
  if (triggerIdx===undefined) {
    lastTriggered++;
    if (lastTriggered>10) { 
      triggerIdx = data.length - (bufferSize/2);
    }
  }

  // if triggered, copy data
  if (triggerIdx!==undefined) {
    samplesChanged = true;
    for (var i=0;i<bufferSize;i++) {
      var idx = triggerIdx+i-(bufferSize/2);
      if (idx<0) {
        if (lastData!==undefined)
          drawSamples[i] = lastData[idx + lastData.length];
      } else drawSamples[i] = data[idx];
    }
    draw();
  }

  lastData = data;
}

function startRecord() {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!window.AudioContext) {
    console.log("No window.AudioContext");
    return; // no audio available
  }
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
  if (!navigator.getUserMedia) {
    console.log("No navigator.getUserMedia");
    return; // no audio available
  }

  var context = new AudioContext();

  var userMediaStream;
  var inputNode = context.createScriptProcessor(1024, 1/*in*/, 1/*out*/);
  window.dontGarbageCollectMePlease = inputNode;
  console.log("Audio Sample rate : "+context.sampleRate);

  inputNode.onaudioprocess = processAudio;

  navigator.getUserMedia({
      video:false,
      audio:{
        mandatory:[],
        optional:[{ echoCancellation:false },{ sampleRate:22050 /* 44100 */ }]
      }
    }, function(stream) {
      var inputStream = context.createMediaStreamSource(stream);
      inputStream.connect(inputNode);
      inputNode.connect(context.destination);  
      console.log("Record start successful");
    }, function(e) {
      console.log('getUserMedia error', e);
  });
}


window.onload = function() {
  startRecord();
};
