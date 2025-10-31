// client.js — dark UI behavior: local preview + simple chat messages + Next/PopNow controls
let localStream = null;
let videoDevices = [];
let currentDeviceId = null;
const localPreview = document.getElementById('localPreview');
const camState = document.getElementById('camState');
const miniPreview = document.getElementById('miniPreview');

const nextBtn = document.getElementById('nextBtn');
const popNowBtn = document.getElementById('popNowBtn');
const filtersBtn = document.getElementById('filtersBtn');
const muteBtn = document.getElementById('muteBtn');

const chatBox = document.getElementById('chatBox');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');

function appendLocalMessage(text, who = 'Me') {
  const el = document.createElement('div');
  el.style.margin = '10px 0';
  el.style.textAlign = 'right';
  el.innerHTML = `<span style="display:inline-block; background:linear-gradient(90deg,#09202a,#0b2b3c); padding:8px 12px; border-radius:12px; color:#dbeeff; max-width:80%;">${who}: ${escapeHtml(text)}</span>`;
  chatBox.appendChild(el);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

sendBtn.addEventListener('click', () => {
  const t = msgInput.value && msgInput.value.trim();
  if (!t) return;
  appendLocalMessage(t);
  msgInput.value = '';
  // TODO: emit to socket
});

// enumerate devices to enable flip if needed
async function enumerate() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices = devices.filter(d => d.kind === 'videoinput');
    if (videoDevices.length && !currentDeviceId) currentDeviceId = videoDevices[0].deviceId;
  } catch (e) {
    console.warn('enumerate error', e);
  }
}

// start local preview
async function startLocal(deviceId = null) {
  try {
    stopLocal();
    const constraints = {
      audio: true,
      video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } : { facingMode: 'user', width:{ ideal:1280 }, height:{ ideal:720 } }
    };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localPreview.srcObject = localStream;
    camState.textContent = 'On';
    // auto mirror for front cameras if available
    try {
      const settings = localStream.getVideoTracks()[0].getSettings();
      if (settings && settings.facingMode && settings.facingMode === 'user') {
        localPreview.style.transform = 'scaleX(-1)';
      } else {
        localPreview.style.transform = '';
      }
      if (settings && settings.deviceId) currentDeviceId = settings.deviceId;
    } catch(e){}
  } catch (err) {
    console.error('camera error', err);
    camState.textContent = 'Error';
  }
}

function stopLocal(){
  if (!localStream) return;
  localStream.getTracks().forEach(t => { try{ t.stop(); }catch(e){} });
  localStream = null;
  localPreview.srcObject = null;
  camState.textContent = 'Off';
  localPreview.style.transform = '';
}

// flip camera: cycle devices
async function flipCamera(){
  if (!videoDevices || videoDevices.length <= 1) return;
  const idx = videoDevices.findIndex(d => d.deviceId === currentDeviceId);
  const next = videoDevices[(idx + 1) % videoDevices.length];
  if (next) await startLocal(next.deviceId);
}

// wiring buttons
popNowBtn.addEventListener('click', () => {
  // For demo: append a message that pop happened
  appendLocalMessage('Pop Now pressed', 'System');
});

nextBtn.addEventListener('click', () => {
  appendLocalMessage('Next pressed', 'System');
});

// filters/mute demo behaviours
filtersBtn.addEventListener('click', () => {
  appendLocalMessage('Filters toggled (demo)', 'System');
});
let muted = false;
muteBtn.addEventListener('click', () => {
  if (!localStream) {
    appendLocalMessage('No local stream', 'System');
    return;
  }
  muted = !muted;
  localStream.getAudioTracks().forEach(t => t.enabled = !muted);
  muteBtn.textContent = muted ? 'Unmute' : 'Mute';
  appendLocalMessage(muted ? 'Muted mic' : 'Unmuted mic', 'System');
});

// autorun: enumerate and start local preview by default (so UI matches your screenshot)
(async function init(){
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    appendLocalMessage('Media devices API not available', 'System');
    return;
  }
  await enumerate();
  // start preview automatically (you can remove this if you want Start button instead)
  await startLocal(currentDeviceId);
})();

