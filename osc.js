
// ----------------------------------------------------------------------------------

var bufferSize = 256;
var drawSamples = new Array(bufferSize);
for (var i=0;i<bufferSize;i++) drawSamples[i]=0;
var samplesChanged = true;
var lastData = new Array(bufferSize);
var lastTriggered = 0;
var autoTrigger = false;
var averageSampleMagnitude = 1;

function draw() {
  if (!samplesChanged) return;
  samplesChanged = false;

  var canvas = document.getElementById("canvas");
  var ctx = canvas.getContext("2d");
  var W = canvas.width;
  var H = canvas.height;
  var scale = 1;

  // Work out what scale to render at
  var sampleMagnitude = 0;
  for (var i = 0; i < drawSamples.length; ++i) {
    var s = Math.abs(drawSamples[i]);
    if (s>sampleMagnitude) sampleMagnitude = s;
  }
  averageSampleMagnitude = averageSampleMagnitude*0.9 + sampleMagnitude*0.1;
  while (scale<16 && averageSampleMagnitude*scale<0.4) scale *= 2;

  // work out the interpreted 'digital' line
  var interp = new Array(bufferSize);
  var state;
  for (var i=0; i<drawSamples.length; ++i) {
    var wasUndefined = state===undefined;
    if (drawSamples[i] < -averageSampleMagnitude*0.5)
      state = 0;
    if (drawSamples[i] > averageSampleMagnitude*0.5)
      state = 1;
    if (state !== undefined) {
      // now we've seen a state change, we hopefully know what
      // state the line was at the start
      if (wasUndefined)
        for (var j=0; j<i; ++j) 
          interp[j] = 1-state;
      interp[i] = state;
    }    
  }

  // mapping for rendering data
  function getX(v) { return v*W/drawSamples.length; }
  function getY(v) { return (1 - v*scale)*H/2; }
  function getIY(v) { return H - (5+v*10); }

  ctx.fillStyle = "#000000";
  ctx.fillRect(0,0,W,H);

  // crosshairs
  ctx.beginPath();
  ctx.moveTo(getX(drawSamples.length/2),0);
  ctx.lineTo(getX(drawSamples.length/2),H);
  ctx.moveTo(0,getY(0));
  ctx.lineTo(W,getY(0));
  ctx.strokeStyle = '#404040';
  ctx.stroke();

  // the actual line
  ctx.beginPath();
  ctx.moveTo(getX(0),getY(drawSamples[0]));
  for (var i = 0; i < drawSamples.length; ++i) {
    ctx.lineTo(getX(i), getY(drawSamples[i]));
  }
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // the interpreted line
  if (state!==undefined) {
    ctx.beginPath();
    ctx.moveTo(getX(0),getIY(state));
    for (var i=0; i<drawSamples.length; ++i) {
      ctx.lineTo(getX(i), getIY(interp[i]));
    }
    ctx.strokeStyle = '#00ffff';
    ctx.stroke();
  }

  ctx.font = "20px sans-serif";
  ctx.textBaseline = "top";
  ctx.fillStyle = autoTrigger ? '#ff0000' : '#00ff00';
  ctx.textAlign = "left";
  ctx.fillText(autoTrigger ? "AUTO" : "Triggered", 10, 10);

  ctx.fillStyle = '#A0A0A0';
  ctx.textAlign = "right";
  ctx.fillText(scale+"x", W-10, 10);
}  


// ----------------------------------------------------------------------------------

function processAudio(e) { 
  // console.log("Foo");
  var data = e.inputBuffer.getChannelData(0);

  var triggerPt = averageSampleMagnitude * 0.5;
  if (triggerPt < 0.01) triggerPt = 0.01;

  // find trigger
  var triggerIdx = undefined;
  var lastSample = lastData[bufferSize/2]
  for (var i = -(bufferSize/2); i < bufferSize/2; ++i) {
    var sample = (i<0) ? lastData[i+bufferSize] : data[i];

    lastTriggered++;
    if (sample>triggerPt && lastSample<=triggerPt) {
      triggerPt = sample;
      triggerIdx = i;
      lastTriggered = 0;
    }
    lastSample = sample;
  }
  // auto-trigger
  autoTrigger = false;
  if (triggerIdx===undefined) {   
    lastTriggered++;
    // if we haven't triggered for a while, turn it on...
    if (lastTriggered>50) { 
      autoTrigger = true;
      triggerIdx = data.length - (bufferSize/2);
    }
  }

  // if triggered, copy data
  if (triggerIdx!==undefined) {
    samplesChanged = true;
    for (var i=0;i<bufferSize;i++) {
      var idx = triggerIdx+i-(bufferSize/2);
      if (idx<0) {
        drawSamples[i] = lastData[idx + bufferSize];
      } else drawSamples[i] = data[idx];
    }
    setTimeout(draw, 1);
  }

  for (var i=0;i<bufferSize;++i) {
    lastData[i] = data[i];
  }
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
        optional:[{ 
          echoCancellation:false
        }, {
          googEchoCancellation: false,
        }, {
          googAutoGainControl: false,
        }, {
          googNoiseSuppression: false,
        }, {
          googHighpassFilter: false
        },{ sampleRate:22050 /* 44100 */ }]
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


window.onresize = function() {
  var canvas = document.getElementById("canvas");
  var ctx = canvas.getContext("2d");

  var W = window.innerWidth;
  var H = window.innerHeight;
  canvas.width = 512;
  canvas.height = 512*H/W; 

  canvas.style.width = W+"px";
  canvas.style.height = H+"px;";

  startRecord();
};

window.onload = function() {
  window.onresize();

  startRecord();
};


