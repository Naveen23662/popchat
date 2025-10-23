// index.js - PopChat MVP Logic

// WebRTC Setup
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
let peerConnection = null;
let dataChannel = null;

function startConnection() {
  peerConnection = new RTCPeerConnection(configuration);

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('ICE candidate', event.candidate);
      // Send to signaling server (simplified placeholder)
    }
  };

  // Handle stream
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then((stream) => {
      const localVideo = document.getElementById('localVideo');
      localVideo.srcObject = stream;
      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
    })
    .catch(err => console.error('Media error:', err));

  // Data channel for signaling (simplified)
  dataChannel = peerConnection.createDataChannel('chat');
  dataChannel.onopen = () => console.log('Channel open');
  dataChannel.onmessage = (event) => console.log('Message:', event.data);

  // Simplified offer (replace with real signaling)
  peerConnection.createOffer()
    .then(offer => peerConnection.setLocalDescription(offer))
    .then(() => console.log('Offer created', peerConnection.localDescription))
    .catch(err => console.error('Offer error:', err));
}

function startNewConnection() {
  if (peerConnection) {
    peerConnection.close(); // End current connection
  }
  startConnection(); // Start a new one
}

// Button Handlers
document.getElementById('popNow').addEventListener('click', startConnection);
document.getElementById('nextButton').addEventListener('click', () => {
  console.log('Next clicked');
  if (peerConnection) {
    peerConnection.close();
    startNewConnection();
  }
});

// Ensure UI loads (fallback)
window.onload = () => {
  if (!document.getElementById('nextButton')) {
    document.body.innerHTML += `
      <video id="localVideo" autoplay playsinline></video>
      <button id="popNow">Pop Now</button>
      <button id="nextButton">Next</button>
    `;
  }
};