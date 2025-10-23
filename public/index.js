// public/index.js — PopChat client (replace SIGNALING_URL after Render deploy)
const SIGNALING_URL = 'wss://<RENDER_DOMAIN>'; // ← replace with your Render domain later
const ws = new WebSocket(SIGNALING_URL);

const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
let pc = null, localStream = null;
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const popNow = document.getElementById('popNow');
const nextButton = document.getElementById('nextButton');

function log(...args){ console.log('[PopChat]', ...args); }

ws.onopen = () => log('WS open');
ws.onclose = () => log('WS closed');
ws.onerror = (e) => log('WS error', e);
ws.onmessage = async (ev) => {
  log('WS rx', ev.data);
  const msg = JSON.parse(ev.data);
  if (msg.type === 'waiting') log('waiting for partner');
  if (msg.type === 'paired') { log('paired'); await startAsCaller(); }
  if (msg.type === 'offer') await handleOffer(msg.offer);
  if (msg.type === 'answer') await handleAnswer(msg.answer);
  if (msg.type === 'ice') await handleIce(msg.candidate);
  if (msg.type === 'leave') endCall();
};

async function ensureLocalStream(){
  if (!localStream){
    localStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
    localVideo.srcObject = localStream;
  }
}

async function startAsCaller(){
  if (pc) return;
  pc = new RTCPeerConnection(config);
  pc.onicecandidate = (e) => { if (e.candidate) ws.send(JSON.stringify({type:'ice', candidate: e.candidate})); };
  pc.ontrack = (e) => { log('ontrack', e); remoteVideo.srcObject = e.streams[0]; };

  await ensureLocalStream();
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify({ type: 'offer', offer }));
}

async function handleOffer(offer){
  if (pc) pc.close();
  pc = new RTCPeerConnection(config);
  pc.onicecandidate = (e) => { if (e.candidate) ws.send(JSON.stringify({type:'ice', candidate: e.candidate})); };
  pc.ontrack = (e) => { remoteVideo.srcObject = e.streams[0]; };

  await ensureLocalStream();
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  ws.send(JSON.stringify({ type: 'answer', answer }));
}

async function handleAnswer(answer){
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

async function handleIce(candidate){
  if (!pc) return;
  try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
  catch(e){ console.error('addIceCandidate failed', e); }
}

function endCall(){
  if (pc) { pc.close(); pc = null; }
  if (remoteVideo) remoteVideo.srcObject = null;
}

popNow.addEventListener('click', () => {
  if (ws.readyState !== WebSocket.OPEN) { console.warn('WS not open'); return; }
  ws.send(JSON.stringify({ type: 'join' }));
});

nextButton.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'leave' }));
  endCall();
  ws.send(JSON.stringify({ type: 'join' }));
});

