const startCameraBtn = document.getElementById("startCameraBtn");
const localVideo = document.getElementById("localVideo");

let localStream = null;

startCameraBtn.addEventListener("click", async () => {
  try {
    if (localStream) {
      console.log("Camera already running");
      return;
    }

    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 500 },
        height: { ideal: 400 }
      },
      audio: true
    });

    localVideo.srcObject = localStream;

    console.log("Camera started");
  } catch (err) {
    console.error("Camera error:", err);
    alert("Camera permission denied or not available");
  }
});

