import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = "https://uqftzdizpusdmvrszkyw.supabase.co";
const SUPABASE_ANON_KEY =
  "sb_publishable_0FHnonvY1H--liXKAtQgrQ_FqJZEd9Q";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let mediaRecorder;
let recordedChunks = [];
let recordingStream;

/*const emailInput =
  document.getElementById("email");

const passwordInput =
  document.getElementById("password");

const loginBtn =
  document.getElementById("loginBtn");

const message =
  document.getElementById("message");

loginBtn.addEventListener(
  "click",
  loginCandidate
);*/

/*async function loginCandidate() {

  const email =
    emailInput.value.trim();

  const password =
    passwordInput.value.trim();

  if (!email || !password) {

    message.textContent =
      "Please enter email and password";

    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Signing In...";

  const { data, error } =
    await supabase
      .from("candidates")
      .select("*")
      .eq("email", email)
      .eq("password", password)
      .single();

  if (error || !data) {

    message.textContent =
      "Invalid email or password";

    loginBtn.disabled = false;
    loginBtn.textContent = "Sign In";

    return;
  }

  localStorage.setItem(
    "candidate",
    JSON.stringify(data)
  );

  message.textContent =
    "Login successful";

  setTimeout(() => {

    showInstructionsPage(data);

  }, 1000);
}*/

const message =
  document.getElementById("message");
const googleLoginBtn =
  document.getElementById(
    "googleLoginBtn"
  );

googleLoginBtn.addEventListener(
  "click",
  signInWithGoogle
);

async function signInWithGoogle() {

  const { error } =
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          "http://localhost:5173"
      }
    });

  if (error) {

    console.error(error);

    message.textContent =
      "Google login failed";
  }
}

async function ensureProfile() {

  const {
    data: { user }
  } =
    await supabase.auth.getUser();

  if (!user) return null;

  const {
    data: existingProfile
  } =
    await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

  if (!existingProfile) {

    await supabase
      .from("profiles")
      .insert([
        {
          id: user.id,
          email: user.email,
          full_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            "Candidate",
          role: "candidate"
        }
      ]);
  }

  return user;
}
function showInstructionsPage(candidate) {

  document.body.innerHTML = `
  
  <div class="auth-container">

    <div class="login-card">

      <h2>
        Welcome, ${candidate.name}
      </h2>

      <p class="card-subtitle">
        ReinCrew.ai Interview Instructions
      </p>

      <div style="
        color:#cbd5e1;
        line-height:2;
        margin-bottom:25px;
      ">
      
        <p>✓ Stable internet connection</p>
        <p>✓ Camera enabled</p>
        <p>✓ Microphone enabled</p>
        <p>✓ Quiet environment</p>
        <p>✓ Interview recording required</p>

      </div>

      <button id="startInterviewBtn">
        Start Interview
      </button>

    </div>

  </div>
  `;

  document
    .getElementById("startInterviewBtn")
    .addEventListener(
      "click",
      launchCameraPreview
    );
}

async function launchCameraPreview() {

  try {

    const stream =
      await navigator.mediaDevices
        .getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 24 }
          },
          audio: true
        });

    document.body.innerHTML = `

      <div class="auth-container">

        <div class="login-card">

          <h2>
            ReinCrew.ai Interview
          </h2>

          <p class="card-subtitle">
            Camera & Microphone Check
          </p>

          <video
            id="previewVideo"
            autoplay
            muted
            playsinline
            style="
              width:100%;
              border-radius:16px;
              margin-bottom:20px;
            ">
          </video>

          <button id="beginRecordingBtn">
            Begin Recording
          </button>

        </div>

      </div>
    `;

    const previewVideo =
      document.getElementById(
        "previewVideo"
      );

    previewVideo.srcObject =
      stream;

    document
      .getElementById(
        "beginRecordingBtn"
      )
      .addEventListener(
        "click",
        () => startRecording(stream)
      );

  } catch (err) {

    alert(
      "Camera or microphone permission denied."
    );

    console.error(err);
  }
}

async function startRecording(stream) {

  recordingStream = stream;

  recordedChunks = [];

  const recorderOptions =
    MediaRecorder.isTypeSupported(
      "video/webm;codecs=vp9"
    )
      ? {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 800000,
        audioBitsPerSecond: 64000
      }
      : {
        videoBitsPerSecond: 800000,
        audioBitsPerSecond: 64000
      };

  mediaRecorder =
    new MediaRecorder(
      stream,
      recorderOptions
    );

  mediaRecorder.ondataavailable =
    event => {

      if (event.data.size > 0) {

        recordedChunks.push(
          event.data
        );
      }
    };

  mediaRecorder.start();

  document.body.innerHTML = `

    <div class="auth-container">

      <div class="login-card">

        <h2>
          ReinCrew.ai Interview
        </h2>

        <p class="card-subtitle">
          Recording In Progress
        </p>

        <div style="
          color:red;
          font-size:18px;
          margin-bottom:20px;
        ">
          🔴 Recording
        </div>

        <video
          id="recordingPreview"
          autoplay
          muted
          playsinline
          style="
            width:100%;
            border-radius:16px;
            margin-bottom:20px;
          ">
        </video>

        <button id="finishInterviewBtn">
          Finish Interview
        </button>

      </div>

    </div>
  `;

  document
    .getElementById(
      "recordingPreview"
    )
    .srcObject = stream;

  document
    .getElementById(
      "finishInterviewBtn"
    )
    .addEventListener(
      "click",
      finishInterview
    );
}

async function finishInterview() {

  mediaRecorder.stop();

  recordingStream
    .getTracks()
    .forEach(
      track => track.stop()
    );

  mediaRecorder.onstop =
    async () => {

      const videoBlob =
        new Blob(
          recordedChunks,
          {
            type: "video/webm"
          }
        );

      await uploadInterviewVideo(
        videoBlob
      );
    };
}

async function uploadInterviewVideo(
  videoBlob
) {

  try {

    const videoSizeMB =
      (
        videoBlob.size /
        (1024 * 1024)
      ).toFixed(2);

    console.log(
      "Interview Size:",
      videoSizeMB,
      "MB"
    );

    document.body.innerHTML = `
      <div class="auth-container">
        <div class="login-card">
          <h2>Uploading Interview...</h2>
          <p>${videoSizeMB} MB</p>
        </div>
      </div>
    `;

    const candidate =
      JSON.parse(
        localStorage.getItem(
          "candidate"
        )
      );

    const fileName =
      `candidate-media/interviews/${Date.now()}.webm`;

    const { error: uploadError } =
      await supabase.storage
        .from("images")
        .upload(
          fileName,
          videoBlob
        );

    if (uploadError)
      throw uploadError;

    const { error: dbError } =
      await supabase
        .from("interviews")
        .insert([
          {
            candidate_id:
              candidate.id,

            status:
              "completed",

            video_path:
              fileName,

            video_size_mb:
              videoSizeMB,

            completed_at:
              new Date()
                .toISOString()
          }
        ]);

    if (dbError)
      throw dbError;

    document.body.innerHTML = `
      <div class="auth-container">
        <div class="login-card">

          <h2>
            Interview Submitted
          </h2>

          <p class="card-subtitle">
            Thank you for completing your interview.
          </p>

          <p>
            Video Size:
            ${videoSizeMB} MB
          </p>

        </div>
      </div>
    `;

  } catch (err) {

    console.error(err);

    alert(
      "Upload failed: " +
      err.message
    );
  }
}

checkSession();

async function checkSession() {

  const {
    data: { session }
  } =
    await supabase.auth.getSession();

  if (!session) return;

  const user =
    await ensureProfile();

  if (!user) return;

  const { data: profile } =
    await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

  console.log("Auth User ID:", user.id);
  console.log("Profile:", profile);

  if (!profile) return;

  console.log(
    "User Role:",
    profile.role
  );

  if (profile.role === "admin") {

    window.location.href =
      "admin.html";

    return;
  }

  if (
    profile.role === "recruiter"
  ) {

    window.location.href =
      "recruiter.html";

    return;
  }

  if (
    profile.role === "candidate"
  ) {

    showInstructionsPage({
      name:
        profile.full_name ||
        user.user_metadata?.full_name ||
        "Candidate"
    });
  }

}




export { supabase };