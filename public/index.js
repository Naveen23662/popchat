// public/index.js — PopChat client (uses initiator flag so only one side creates offer)

let SIGNALING_URL = 'wss://<RENDER_DOMAIN>';
if (SIGNALING_URL.includes('<RENDER_DOMAIN>')) {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    SIGNALING_URL = 'ws://localhost:3000';
  } else {
    SIGNALING_URL = (location.protocol === 'https:') ? `wss://${location.hostname}` : `ws://${location.hostname}`;
  }
}
console.log('[PopChat] SIGNALING_URL =', SIGNALING_URL);

const popNowBtn = document.getElementById('popNow');
const nextBtn = document.getElementById('nextButton');
const statusEl = document.getElementById('status');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

function showStatus(t){ console.log('[status]', t); if(statusEl) statusEl.textContent = t; }

popNowBtn.disabled = true;
nextBtn.disabled = true;

let ws = null;
let pc = null;
let localStream = null;

const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function connectSignaling(){
  try {
    ws = new WebSocket(SIGNALING_URL);
  } catch(e){
    showStatus('WebSocket create failed: ' + e);
    console.error(e);
    return;
  }

  ws.onopen = () => {
    showStatus('Signaling connected');
    popNowBtn.textContent = 'Pop Now';
    popNowBtn.disabled = false;
    nextBtn.disabled = false;
    console.log('WS open');
  };

  ws.onclose = () => {
    showStatus('Signaling disconnected');
    popNowBtn.disabled = true;
    nextBtn.disabled = true;
    console.log('WS closed');
  };

  ws.onerror = (e) => {
    showStatus('Signaling error — check console');
    console.error('WS error', e);
  };

  ws.onmessage = async (ev) => {
    console.log('WS rx', ev.data);
    let msg;
    try { msg = JSON.parse(ev.data); } catch(e){ console.warn('invalid JSON', e); return; }

    if (msg.type === 'waiting') {
      showStatus('Waiting for partner...');
    } else if (msg.type === 'paired') {
      // server includes initiator boolean
      if (msg.initiator) {
        showStatus('Paired — you will create the offer (initiator)');
        // initiator should create offer
        await ensureLocalStream();
        if (!pc) await startAsCaller();
      } else {
        showStatus('Paired — waiting for offer (answerer)');
        // answerer waits for incoming "offer" message then will answer in handleOffer()
      }
    } else if (msg.type === 'offer') {
      showStatus('Received offer — answering...');
      await handleOffer(msg.offer);
    } else if (msg.type === 'answer') {
      showStatus('Received answer — finalizing...');
      await handleAnswer(msg.answer);
    } else if (msg.type === 'ice') {
      await handleIce(msg.candidate);
    } else if (msg.type === 'leave') {
      showStatus('Partner left');
      cleanup();
    }
  };
}

async function ensureLocalStream(){
  if (localStream) return;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
    localVideo.srcObject = localStream;
    console.log('Local stream set');
  } catch(e){
    showStatus('Camera/microphone access required');
    console.error('getUserMedia', e);
    throw e;
  }
}

async function startAsCaller(){
  if (pc) return;
  pc = new RTCPeerConnection(config);

  pc.onicecandidate = (e) => {
    if (e.candidate && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type:'ice', candidate: e.candidate }));
    }
  };

  pc.ontrack = (e) => {
    remoteVideo.srcObject = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]);
    showStatus('Connected');
  };

  await ensureLocalStream();
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify({ type:'offer', offer }));
}

async function handleOffer(offer){
  // answerer path
  if (pc) cleanup();
  pc = new RTCPeerConnection(config);

  pc.onicecandidate = (e) => {
    if (e.candidate && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type:'ice', candidate: e.candidate }));
    }
  };
  pc.ontrack = (e) => {
    remoteVideo.srcObject = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]);
    showStatus('Connected');
  };

  await ensureLocalStream();
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  ws.send(JSON.stringify({ type:'answer', answer }));
}

async function handleAnswer(answer){
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
  showStatus('Connected');
}

async function handleIce(candidate){
  if (!candidate || !pc) return;
  try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
  catch(e){ console.error('addIce failed', e); }
}

function cleanup(){
  if (pc) { try{ pc.close(); }catch{} pc = null; }
  remoteVideo.srcObject = null;
}

popNowBtn.addEventListener('click', () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn('WS not open, attempting reconnect...');
    showStatus('Reconnecting...');
    connectSignaling();
    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'join' }));
          showStatus('Joining...');
          console.log('join sent after reconnect');
        } catch (e) {
          console.error('failed to send join after reconnect', e);
          showStatus('Join failed — see console');
        }
      } else {
        showStatus('Unable to connect to signaling server');
      }
    }, 800);
  } else {
    try {
      ws.send(JSON.stringify({ type:'join' }));
      showStatus('Joining...');
      console.log('join sent');
    } catch (e) {
      console.error('send join error', e);
      showStatus('Join failed — see console');
    }
  }
});

nextBtn.addEventListener('click', () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) { showStatus('Signaling not ready'); return; }
  ws.send(JSON.stringify({ type:'leave' }));
  cleanup();
  ws.send(JSON.stringify({ type:'join' }));
  showStatus('Skipping...');
});

// show camera immediately
navigator.mediaDevices.getUserMedia({ video:true, audio:true })
  .then(stream => {
    localVideo.srcObject = stream;
    localStream = stream;
    console.log('✅ Camera permission granted and preview shown');
  })
  .catch(err => {
    console.error('Camera error', err);
    showStatus('Camera blocked — allow camera & mic in the browser');
  });

popNowBtn.textContent = 'Connecting...';
showStatus('Connecting to signaling...');
connectSignaling();

