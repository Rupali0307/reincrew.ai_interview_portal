// recruiter.js – Recruiter Dashboard logic
import { supabase } from "./supabase.js";

// DOM Elements - General
const candidateContainer = document.getElementById("candidateContainer");
const searchInput = document.getElementById("searchInput");
const logoutBtn = document.getElementById("logoutBtn");
const candidatesPanel = document.getElementById("candidatesPanel");
const schedulesPanel = document.getElementById("schedulesPanel");
const schedulesTableBody = document.getElementById("schedulesTableBody");

// DOM Elements - Tabs
const candidatesTabBtn = document.getElementById("candidatesTabBtn");
const schedulesTabBtn = document.getElementById("schedulesTabBtn");

// DOM Elements - View Interviews Modal
const interviewModal = document.getElementById("interviewModal");
const modalTitle = document.getElementById("modalTitle");
const interviewList = document.getElementById("interviewList");
const closeViewModal = document.getElementById("closeViewModal");

// DOM Elements - Invite Candidate Modal
const inviteModal = document.getElementById("inviteModal");
const openInviteModalBtn = document.getElementById("openInviteModalBtn");
const closeInviteModal = document.getElementById("closeInviteModal");
const cancelInviteBtn = document.getElementById("cancelInviteBtn");
const inviteForm = document.getElementById("inviteForm");
const inviteLinkContainer = document.getElementById("inviteLinkContainer");
const inviteLinkInput = document.getElementById("inviteLinkInput");
const copyLinkBtn = document.getElementById("copyLinkBtn");

// DOM Elements - Reschedule Modal
const rescheduleModal = document.getElementById("rescheduleModal");
const closeRescheduleModal = document.getElementById("closeRescheduleModal");
const cancelRescheduleBtn = document.getElementById("cancelRescheduleBtn");
const rescheduleForm = document.getElementById("rescheduleForm");
const rescheduleInterviewId = document.getElementById("rescheduleInterviewId");
const rescheduleDate = document.getElementById("rescheduleDate");
const rescheduleNotes = document.getElementById("rescheduleNotes");

let allCandidates = [];
let currentCompanyId = null;

// Initialize Recruiter Portal
loadRecruiterDashboard();
setupNavigation();
setupModalControls();

// Setup Logout Action
logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("candidate");
    window.location.href = "index.html";
});

// Setup Candidates Search
searchInput.addEventListener("input", () => {
    const search = searchInput.value.toLowerCase();
    const filtered = allCandidates.filter(
        candidate => candidate.name.toLowerCase().includes(search)
    );
    renderCandidates(filtered);
});

// Navigation and tab controls
function setupNavigation() {
    candidatesTabBtn.addEventListener("click", () => {
        candidatesTabBtn.classList.add("active");
        schedulesTabBtn.classList.remove("active");
        candidatesPanel.style.display = "block";
        schedulesPanel.style.display = "none";
        loadCandidatesList();
    });

    schedulesTabBtn.addEventListener("click", () => {
        schedulesTabBtn.classList.add("active");
        candidatesTabBtn.classList.remove("active");
        schedulesPanel.style.display = "block";
        candidatesPanel.style.display = "none";
        loadScheduledInterviews();
    });
}

// Modal show/hide control handlers
function setupModalControls() {
    // Open Invite Modal
    openInviteModalBtn.addEventListener("click", () => {
        inviteForm.reset();
        inviteLinkContainer.style.display = "none";
        inviteModal.style.display = "flex";
    });

    // Close Invite Modal
    closeInviteModal.addEventListener("click", () => inviteModal.style.display = "none");
    cancelInviteBtn.addEventListener("click", () => inviteModal.style.display = "none");

    // Close View Modal
    closeViewModal.addEventListener("click", () => interviewModal.style.display = "none");

    // Close Reschedule Modal
    closeRescheduleModal.addEventListener("click", () => rescheduleModal.style.display = "none");
    cancelRescheduleBtn.addEventListener("click", () => rescheduleModal.style.display = "none");

    // Close on click outside modal content
    window.addEventListener("click", (e) => {
        if (e.target === inviteModal) inviteModal.style.display = "none";
        if (e.target === interviewModal) interviewModal.style.display = "none";
        if (e.target === rescheduleModal) rescheduleModal.style.display = "none";
    });

    // Copy Link Action
    copyLinkBtn.addEventListener("click", () => {
        inviteLinkInput.select();
        document.execCommand("copy");
        copyLinkBtn.innerText = "Copied!";
        setTimeout(() => {
            copyLinkBtn.innerText = "Copy Link";
        }, 1500);
    });

    // Handle invite form submission
    inviteForm.addEventListener("submit", handleInviteSubmit);
    
    // Handle reschedule form submission
    rescheduleForm.addEventListener("submit", handleRescheduleSubmit);
}

// Check role and retrieve recruiter company
async function loadRecruiterDashboard() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        location.href = "index.html";
        return;
    }

    const { data: recruiter } = await supabase
        .from("recruiters")
        .select("*")
        .eq("profile_id", user.id)
        .maybeSingle();

    if (!recruiter) {
        alert("Recruiter profile not associated with any company. Please contact an admin.");
        return;
    }

    currentCompanyId = recruiter.company_id;
    loadCandidatesList();
}

// Fetch and render candidates list
async function loadCandidatesList() {
    if (!currentCompanyId) return;

    const { data: candidates } = await supabase
        .from("candidates")
        .select("*")
        .eq("company_id", currentCompanyId);

    allCandidates = candidates || [];
    renderCandidates(allCandidates);
}

async function renderCandidates(candidates) {
    candidateContainer.innerHTML = "";

    if (candidates.length === 0) {
        candidateContainer.innerHTML = `<p style="text-align: center; color: #94a3b8; width: 100%; grid-column: 1/-1;">No candidates found.</p>`;
        return;
    }

    for (const candidate of candidates) {
        const { data: interviews } = await supabase
            .from("interviews")
            .select("id")
            .eq("candidate_id", candidate.id);

        const count = interviews ? interviews.length : 0;

        candidateContainer.innerHTML += `
            <div class="candidate-card">
                <div>
                    <h3>${candidate.name}</h3>
                    <p>${candidate.email}</p>
                    <p class="interview-count">Interviews Completed: <strong>${count}</strong></p>
                </div>
                <div class="actions">
                    <button class="view-interviews-btn" onclick="openInterviewsModal('${candidate.id}', '${candidate.name}')">
                        View Interviews (${count})
                    </button>
                </div>
            </div>
        `;
    }
}

// Open modal and load all interviews for candidate
window.openInterviewsModal = async function(candidateId, candidateName) {
    modalTitle.textContent = `${candidateName}'s Interviews`;
    interviewList.innerHTML = "<p>Loading interviews...</p>";
    interviewModal.style.display = "flex";

    const { data: interviews, error } = await supabase
        .from("interviews")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("completed_at", { ascending: false });

    if (error || !interviews || interviews.length === 0) {
        interviewList.innerHTML = "<p>No interviews found for this candidate.</p>";
        return;
    }

    interviewList.innerHTML = "";
    for (const interview of interviews) {
        let videoActions = "";
        
        if (interview.video_path) {
            const { data, error: urlError } = await supabase.storage
                .from("images")
                .createSignedUrl(interview.video_path, 3600);
            
            if (!urlError && data?.signedUrl) {
                videoActions = `
                    <button onclick="window.open('${data.signedUrl}')" style="background: #10b981; color: white;">
                        ▶ Watch Video
                    </button>
                    <button onclick="window.open('${data.signedUrl}')" style="background: rgba(255,255,255,0.1); color: white;">
                        📥 Download
                    </button>
                `;
            } else {
                videoActions = `<span style="color: #94a3b8; font-size: 0.9rem;">(Video file not found or inaccessible)</span>`;
            }
        } else {
            videoActions = `<span style="color: #94a3b8; font-size: 0.9rem;">(No video recorded)</span>`;
        }

        interviewList.innerHTML += `
            <div class="interview-card">
                <h4>Interview status: <span class="status-badge status-${interview.status}">${interview.status.toUpperCase()}</span></h4>
                <p><strong>Score:</strong> ${interview.score ?? "Not Scored"}</p>
                <p><strong>Feedback:</strong> ${interview.feedback ?? "No Feedback"}</p>
                <p><strong>Video Size:</strong> ${interview.video_size_mb ? interview.video_size_mb + " MB" : "N/A"}</p>
                
                <div class="interview-actions">
                    ${videoActions}
                    <button onclick="updateScore('${interview.id}', '${candidateId}', '${candidateName}')" style="background: #3b82f6; color: white;">
                        📝 Score
                    </button>
                    <button onclick="updateFeedback('${interview.id}', '${candidateId}', '${candidateName}')" style="background: #3b82f6; color: white;">
                        💬 Feedback
                    </button>
                </div>
            </div>
        `;
    }
};

window.updateScore = async function (interviewId, candidateId, candidateName) {
    const score = prompt("Enter candidate score (0-100):");
    if (score === null || score.trim() === "") return;

    const parsedScore = parseInt(score);
    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 100) {
        alert("Please enter a valid number between 0 and 100");
        return;
    }

    const { error } = await supabase
        .from("interviews")
        .update({ score: parsedScore })
        .eq("id", interviewId);

    if (error) {
        alert("Failed to update score: " + error.message);
    } else {
        openInterviewsModal(candidateId, candidateName);
    }
};

window.updateFeedback = async function (interviewId, candidateId, candidateName) {
    const feedback = prompt("Enter feedback:");
    if (feedback === null || feedback.trim() === "") return;

    const { error } = await supabase
        .from("interviews")
        .update({ feedback: feedback.trim() })
        .eq("id", interviewId);

    if (error) {
        alert("Failed to update feedback: " + error.message);
    } else {
        openInterviewsModal(candidateId, candidateName);
    }
};

// ----------------------------------------------------
// INVITATIONS & SCHEDULING SYSTEM LOGIC
// ----------------------------------------------------

// Handle invitation form submission
async function handleInviteSubmit(e) {
    e.preventDefault();
    const name = document.getElementById("inviteName").value.trim();
    const email = document.getElementById("inviteEmail").value.trim();
    const dateTime = document.getElementById("inviteDate").value;
    const notes = document.getElementById("inviteNotes").value.trim();

    if (!name || !email || !dateTime) return;

    try {
        // Helper to generate a simple random password
        const generatePassword = () => Math.random().toString(36).slice(-8);
        const password = generatePassword();
        let { data: candidate, error: candErr } = await supabase
            .from("candidates")
            .select("*")
            .eq("email", email)
            .maybeSingle();

        if (candErr) throw candErr;

        if (!candidate) {
            const { data: newCand, error: insErr } = await supabase
                .from("candidates")
                .insert([
                    {
                        name,
                        email,
                        company_id: currentCompanyId,
                        status: "scheduled",
                        password: password
                    }
                ])
                .select()
                .single();

            if (insErr) throw insErr;
            candidate = newCand;
        } else {
            // Update candidate status to scheduled
            await supabase
                .from("candidates")
                .update({ status: "scheduled" })
                .eq("id", candidate.id);
        }

        // 2. Insert interview schedule row (status: "scheduled", started_at: inviteDate, feedback: notes)
        const { error: intErr } = await supabase
            .from("interviews")
            .insert([
                {
                    candidate_id: candidate.id,
                    status: "scheduled",
                    started_at: new Date(dateTime).toISOString(),
                    feedback: notes
                }
            ]);

        if (intErr) throw intErr;

        // 3. Generate candidate join URL
        const joinUrl = window.location.origin + "/index.html?invite=" + candidate.id;
        inviteLinkInput.value = joinUrl;
        inviteLinkContainer.style.display = "block";

        // Refresh list
        loadCandidatesList();
    } catch (err) {
        console.error(err);
        alert("Failed to create invitation: " + err.message);
    }
}

// Fetch and render scheduled interviews tab
async function loadScheduledInterviews() {
    schedulesTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Loading schedules...</td></tr>`;

    try {
        // Fetch candidates for current company
        const { data: candidates } = await supabase
            .from("candidates")
            .select("id, name, email")
            .eq("company_id", currentCompanyId);

        if (!candidates || candidates.length === 0) {
            schedulesTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No scheduled candidates.</td></tr>`;
            return;
        }

        const candidateIds = candidates.map(c => c.id);

        // Fetch interviews for these candidates
        const { data: interviews, error } = await supabase
            .from("interviews")
            .select("*")
            .in("candidate_id", candidateIds)
            .order("started_at", { ascending: true });

        if (error) throw error;

        // Render rows
        let rows = "";
        let scheduledCount = 0;

        interviews.forEach(interview => {
            // Include scheduled and pending sessions
            if (interview.status === "scheduled" || interview.status === "pending") {
                scheduledCount++;
                const candidate = candidates.find(c => c.id === interview.candidate_id);
                const schedTime = interview.started_at 
                    ? new Date(interview.started_at).toLocaleString() 
                    : "Not set";
                const details = interview.feedback || "No meeting notes provided";

                rows += `
                    <tr>
                        <td><strong>${candidate.name}</strong></td>
                        <td>${candidate.email}</td>
                        <td><span class="status-badge status-${interview.status}">${interview.status.toUpperCase()}</span></td>
                        <td>${schedTime}</td>
                        <td style="max-width: 250px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${details}</td>
                        <td>
                            <button onclick="window.openRescheduleModal('${interview.id}', '${interview.started_at}', '${interview.feedback || ""}')" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.8rem; margin-right: 5px;">
                                Reschedule
                            </button>
                            <button onclick="window.cancelInterview('${interview.id}')" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 5px 11px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.8rem;">
                                Cancel
                            </button>
                        </td>
                    </tr>
                `;
            }
        });

        if (scheduledCount === 0) {
            schedulesTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No pending or scheduled interviews found.</td></tr>`;
        } else {
            schedulesTableBody.innerHTML = rows;
        }

    } catch (err) {
        console.error(err);
        schedulesTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444;">Failed to load schedules: ${err.message}</td></tr>`;
    }
}

// Open Reschedule Modal dialog
window.openRescheduleModal = function(id, currentDate, currentNotes) {
    rescheduleInterviewId.value = id;
    
    // Format timestamp for datetime-local value (yyyy-MM-ddThh:mm)
    if (currentDate) {
        const localDate = new Date(currentDate);
        const tzOffset = localDate.getTimezoneOffset() * 60000;
        const formatted = new Date(localDate - tzOffset).toISOString().slice(0, 16);
        rescheduleDate.value = formatted;
    } else {
        rescheduleDate.value = "";
    }
    
    rescheduleNotes.value = currentNotes;
    rescheduleModal.style.display = "flex";
};

// Handle Reschedule form submission
async function handleRescheduleSubmit(e) {
    e.preventDefault();
    const id = rescheduleInterviewId.value;
    const newDate = rescheduleDate.value;
    const newNotes = rescheduleNotes.value.trim();

    if (!id || !newDate) return;

    try {
        const { error } = await supabase
            .from("interviews")
            .update({
                started_at: new Date(newDate).toISOString(),
                feedback: newNotes,
                status: "scheduled" // enforce status remains scheduled
            })
            .eq("id", id);

        if (error) throw error;

        rescheduleModal.style.display = "none";
        loadScheduledInterviews();
    } catch (err) {
        console.error(err);
        alert("Failed to reschedule: " + err.message);
    }
}

// Cancel / delete scheduled interview
window.cancelInterview = async function(id) {
    if (!confirm("Are you sure you want to cancel and delete this interview schedule?")) return;

    try {
        const { error } = await supabase
            .from("interviews")
            .delete()
            .eq("id", id);

        if (error) throw error;

        loadScheduledInterviews();
    } catch (err) {
        console.error(err);
        alert("Cancel failed: " + err.message);
    }
};