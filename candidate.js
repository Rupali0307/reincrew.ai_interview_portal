// candidate.js – handles Candidate Interview workflow
import { supabase } from "./supabase.js";

const flowContainer = document.getElementById("flowContainer");
const logoutBtn = document.getElementById("logoutBtn");

let mediaRecorder;
let recordedChunks = [];
let recordingStream;
let candidateInfo = null;

// Handle user logout
logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  localStorage.removeItem("candidate");
  window.location.href = "index.html";
});

// Load candidate details & check session
async function checkCandidateSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  // Load from localStorage or database
  let stored = localStorage.getItem("candidate");
  if (stored) {
    candidateInfo = JSON.parse(stored);
  } else {
    // Attempt database load
    const { data: candidate } = await supabase
      .from("candidates")
      .select("*")
      .eq("email", user.email)
      .maybeSingle();
      
    if (candidate) {
      candidateInfo = candidate;
      localStorage.setItem("candidate", JSON.stringify(candidate));
    }
  }

  if (!candidateInfo) {
    // Onboard candidate under first available company
    let companyId = null;
    const { data: companies } = await supabase.from("companies").select("id").limit(1);
    if (companies && companies.length > 0) {
      companyId = companies[0].id;
    }

    const { data: newCandidate, error } = await supabase
      .from("candidates")
      .insert([
        {
          name: user.user_metadata?.full_name || user.user_metadata?.name || "Candidate",
          email: user.email,
          company_id: companyId
        }
      ])
      .select()
      .single();

    if (error) {
      console.error("Failed to register candidate:", error);
      flowContainer.innerHTML = `
        <div class="card">
          <h2>Registration Failed</h2>
          <p class="subtitle">Please contact the administrator or recruiter to invite your account.</p>
        </div>
      `;
      return;
    }
    candidateInfo = newCandidate;
    localStorage.setItem("candidate", JSON.stringify(newCandidate));
  }

  showInstructionsPage();
}

function showInstructionsPage() {
  flowContainer.innerHTML = `
    <div class="card">
      <h2>Welcome, ${candidateInfo.name}</h2>
      <p class="subtitle">ReinCrew.ai Interview Instructions</p>
      
      <div class="instruction-list">
        <div class="instruction-item">
          <span class="icon-check">✓</span> Stable internet connection is required
        </div>
        <div class="instruction-item">
          <span class="icon-check">✓</span> Camera and microphone permissions enabled
        </div>
        <div class="instruction-item">
          <span class="icon-check">✓</span> A quiet, well-lit environment
        </div>
        <div class="instruction-item">
          <span class="icon-check">✓</span> Entire session will be recorded and sent to recruiters
        </div>
      </div>

      <button id="startInterviewBtn" class="primary-btn">Start Setup & Check Camera</button>
    </div>
  `;

  document.getElementById("startInterviewBtn").addEventListener("click", launchCameraPreview);
}

async function launchCameraPreview() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 24 }
      },
      audio: true
    });

    flowContainer.innerHTML = `
      <div class="card">
        <h2>Camera & Microphone Check</h2>
        <p class="subtitle">Position yourself in the center and click Begin Recording when ready.</p>
        
        <video id="previewVideo" autoplay muted playsinline></video>
        
        <button id="beginRecordingBtn" class="primary-btn">Begin Recording</button>
      </div>
    `;

    const previewVideo = document.getElementById("previewVideo");
    previewVideo.srcObject = stream;

    document.getElementById("beginRecordingBtn").addEventListener("click", () => startRecording(stream));
  } catch (err) {
    alert("Camera or microphone permission denied. Please grant permissions and reload.");
    console.error(err);
  }
}

async function startRecording(stream) {
  recordingStream = stream;
  recordedChunks = [];

  const recorderOptions = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 800000, audioBitsPerSecond: 64000 }
    : { videoBitsPerSecond: 800000, audioBitsPerSecond: 64000 };

  mediaRecorder = new MediaRecorder(stream, recorderOptions);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.start();

  flowContainer.innerHTML = `
    <div class="card">
      <h2>Interview In Progress</h2>
      <p class="subtitle">Please respond clearly. Speak into your microphone.</p>
      
      <div class="recording-indicator">
        🔴 RECORDING LIVE
      </div>

      <video id="recordingPreview" autoplay muted playsinline></video>
      
      <button id="finishInterviewBtn" class="primary-btn" style="background: linear-gradient(135deg, #ef4444, #dc2626); box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);">
        Finish Interview
      </button>
    </div>
  `;

  document.getElementById("recordingPreview").srcObject = stream;
  document.getElementById("finishInterviewBtn").addEventListener("click", finishInterview);
}

async function finishInterview() {
  mediaRecorder.stop();

  if (recordingStream) {
    recordingStream.getTracks().forEach((track) => track.stop());
  }

  mediaRecorder.onstop = async () => {
    const videoBlob = new Blob(recordedChunks, { type: "video/webm" });
    await uploadInterviewVideo(videoBlob);
  };
}

async function uploadInterviewVideo(videoBlob) {
  try {
    const videoSizeMB = (videoBlob.size / (1024 * 1024)).toFixed(2);
    console.log("Interview Blob Size:", videoSizeMB, "MB");

    flowContainer.innerHTML = `
      <div class="card">
        <h2>Uploading Interview...</h2>
        <p class="subtitle">Please keep this browser window open until uploading finishes.</p>
        <p class="status-msg">${videoSizeMB} MB</p>
        <div class="progress-bar-container">
          <div class="progress-bar" id="progressBar"></div>
        </div>
      </div>
    `;

    const fileName = `candidate-media/interviews/${Date.now()}.webm`;
    const progressBar = document.getElementById("progressBar");

    // Supabase JS upload (simulate progress since default upload doesn't provide progress callback in basic api)
    progressBar.style.width = "40%";
    
    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(fileName, videoBlob);

    if (uploadError) throw uploadError;

    progressBar.style.width = "80%";

    const { error: dbError } = await supabase
      .from("interviews")
      .insert([
        {
          candidate_id: candidateInfo.id,
          status: "completed",
          video_path: fileName,
          video_size_mb: parseFloat(videoSizeMB),
          completed_at: new Date().toISOString()
        }
      ]);

    if (dbError) throw dbError;
    
    progressBar.style.width = "100%";

    flowContainer.innerHTML = `
      <div class="card">
        <h2 style="color: #10b981;">✓ Interview Submitted</h2>
        <p class="subtitle">Thank you for completing your interview at ReinCrew.ai.</p>
        <p class="status-msg">Your video recording (${videoSizeMB} MB) has been uploaded successfully. Recruiters will review it shortly.</p>
      </div>
    `;
  } catch (err) {
    console.error(err);
    alert("Upload failed: " + err.message);
    flowContainer.innerHTML = `
      <div class="card">
        <h2 style="color: #ef4444;">Upload Failed</h2>
        <p class="subtitle">${err.message}</p>
        <button id="retryBtn" class="primary-btn">Retry Upload</button>
      </div>
    `;
    
    document.getElementById("retryBtn").addEventListener("click", () => uploadInterviewVideo(videoBlob));
  }
}

checkCandidateSession();
