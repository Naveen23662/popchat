// client.js - live camera preview + chat wiring (minimal)
let localStream = null;
let currentVideoDeviceId = null;
let videoDevices = [];

// DOM elements
const previewVideo = document.getElementById('previewVideo');
const videoOverlay = document.getElementById('videoOverlay');
const startBtn = document.getElementById('startVideo');
const stopBtn = document.getElementById('stopVideo');
const flipBtn = document.getElementById('flipCamera');
const statusInfo = document.getElementById('statusInfo');
const userCountEl = document.getElementById('userCount');
const chatArea = document.getElementById('chatArea');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');

function setStatus(text, isError = false) {
  if (!statusInfo) return;
  statusInfo.textContent = text;
  statusInfo.style.color = isError ? '#b91c1c' : '#0b6cff';
}

// enumerate cameras (called once)
async function enumerateCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices = devices.filter(d => d.kind === 'videoinput');
    // default to first if none selected
    if (videoDevices.length && !currentVideoDeviceId) {
      currentVideoDeviceId = videoDevices[0].deviceId;
    }
    flipBtn.disabled = videoDevices.length <= 1;
  } catch (err) {
    console.warn('enumerateDevices error', err);
  }
}

// start camera with optional specific deviceId
async function startCamera(deviceId = null) {
  try {
    // stop existing
    stopCamera();

    const constraints = {
      audio: true,
      video: deviceId ? { deviceId: { exact: deviceId } } : { width: { ideal: 1280 }, height: { ideal: 720 } }
    };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);

    // attach to video element
    previewVideo.srcObject = localStream;
    previewVideo.style.display = 'block';
    videoOverlay.style.display = 'none';
    startBtn.disabled = true;
    stopBtn.disabled = false;
    flipBtn.disabled = videoDevices.length <= 1;

    setStatus('Video running');

    // remember deviceId if available
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack && videoTrack.getSettings) {
      const settings = videoTrack.getSettings();
      if (settings.deviceId) currentVideoDeviceId = settings.deviceId;
    }
  } catch (err) {
    console.error('getUserMedia error', err);
    const msg = err && err.name ? `${err.name}: ${err.message}` : 'Camera/mic error';
    setStatus(msg, true);
    previewVideo.style.display = 'none';
    videoOverlay.style.display = 'flex';
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

// stop and clean up stream
function stopCamera() {
  if (!localStream) return;
  localStream.getTracks().forEach(t => {
    try { t.stop(); } catch (e) {}
  });
  localStream = null;
  previewVideo.srcObject = null;
  previewVideo.style.display = 'none';
  videoOverlay.style.display = 'flex';
  startBtn.disabled = false;
  stopBtn.disabled = true;
  setStatus('Video stopped');
}

// flip camera (if multiple)
async function flipCamera() {
  if (!videoDevices || videoDevices.length <= 1) return;
  // find index of current device
  const idx = videoDevices.findIndex(d => d.deviceId === currentVideoDeviceId);
  const next = videoDevices[(idx + 1) % videoDevices.length];
  if (next) {
    await startCamera(next.deviceId);
  }
}

// basic chat send (local-only demo)
function appendMessage(text, who = 'Me') {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.justifyContent = 'flex-end';
  wrap.style.margin = '8px 0';

  const bubble = document.createElement('div');
  bubble.textContent = `${who}: ${text}`;
  bubble.style.background = '#e6f0ff';
  bubble.style.padding = '8px 12px';
  bubble.style.borderRadius = '12px';
  bubble.style.maxWidth = '60%';
  bubble.style.fontSize = '13px';

  wrap.appendChild(bubble);
  chatArea.appendChild(wrap);
  chatArea.scrollTop = chatArea.scrollHeight;
}

sendBtn && sendBtn.addEventListener('click', () => {
  const text = msgInput.value && msgInput.value.trim();
  if (!text) return;
  appendMessage(text, 'Me');
  msgInput.value = '';
  // TODO: here you'd emit message over socket
});

// wire video controls
startBtn && startBtn.addEventListener('click', async () => {
  setStatus('Requesting camera...');
  await enumerateCameras();
  await startCamera(currentVideoDeviceId);
});

stopBtn && stopBtn.addEventListener('click', () => stopCamera());
flipBtn && flipBtn.addEventListener('click', () => flipCamera());

// auto-enumerate devices early (helps flip button)
if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
  enumerateCameras().catch(console.warn);
} else {
  setStatus('Media devices API not available', true);
}

// small helpful hint: remove video on page unload
window.addEventListener('beforeunload', () => {
  try { stopCamera(); } catch (e) {}
});

