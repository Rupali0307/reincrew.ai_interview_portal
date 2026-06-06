// admin.js – Admin Dashboard controller
import { supabase } from "./supabase.js";

const contentArea = document.getElementById("contentArea");
const logoutBtn = document.getElementById("logoutBtn");
const crudModal = document.getElementById("crudModal");
const crudForm = document.getElementById("crudForm");
const dynamicFormFields = document.getElementById("dynamicFormFields");
const modalTitle = document.getElementById("modalTitle");
const closeModalBtn = document.getElementById("closeModalBtn");

let currentTab = "analytics";
let editItem = null;
let dropdownData = { companies: [], profiles: [], candidates: [] };

// Session & role verification
async function checkAdminSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  // Get user role from profiles
  let { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    let { data: profileByUserId } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    profile = profileByUserId;
  }

  if (!profile || profile.role !== "admin") {
    alert("Unauthorized. Admin role required.");
    window.location.href = "index.html";
    return;
  }

  setupEventListeners();
  loadCurrentTab();
  fetchDropdownData();
}

// Load dropdown reference options
async function fetchDropdownData() {
  const [comp, prof, cand] = await Promise.all([
    supabase.from("companies").select("id, name"),
    supabase.from("profiles").select("id, email, role"),
    supabase.from("candidates").select("id, name")
  ]);

  dropdownData.companies = comp.data || [];
  dropdownData.profiles = prof.data || [];
  dropdownData.candidates = cand.data || [];
}

function setupEventListeners() {
  // Logout action
  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("candidate");
    window.location.href = "index.html";
  });

  // Sidebar tab switching
  document.querySelectorAll(".sidebar-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".sidebar-btn").forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      currentTab = e.target.dataset.tab;
      loadCurrentTab();
    });
  });

  // Close modal
  closeModalBtn.addEventListener("click", () => {
    crudModal.style.display = "none";
  });

  // Handle Form Submission
  crudForm.addEventListener("submit", handleFormSubmit);
}

// Load specific view based on selected tab
async function loadCurrentTab() {
  contentArea.innerHTML = `<h2>Loading...</h2>`;
  
  if (currentTab === "analytics") {
    await renderAnalytics();
  } else if (currentTab === "companies") {
    await renderCompanies();
  } else if (currentTab === "recruiters") {
    await renderRecruiters();
  } else if (currentTab === "candidates") {
    await renderCandidates();
  } else if (currentTab === "interviews") {
    await renderInterviews();
  }
}

// 1. Render Analytics
async function renderAnalytics() {
  const [compCount, recCount, candCount, intCount] = await Promise.all([
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("recruiters").select("id", { count: "exact", head: true }),
    supabase.from("candidates").select("id", { count: "exact", head: true }),
    supabase.from("interviews").select("id", { count: "exact", head: true })
  ]);

  contentArea.innerHTML = `
    <h2>System Analytics</h2>
    <p class="subtitle">Platform performance and record counts overview.</p>
    
    <div class="analytics-grid">
      <div class="stat-card">
        <div class="stat-label">Companies</div>
        <div class="stat-number">${compCount.count || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Recruiters</div>
        <div class="stat-number">${recCount.count || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Candidates</div>
        <div class="stat-number">${candCount.count || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Interviews</div>
        <div class="stat-number">${intCount.count || 0}</div>
      </div>
    </div>
  `;
}

// 2. Render Companies List
async function renderCompanies() {
  const { data: companies } = await supabase.from("companies").select("*").order("name");
  
  let rows = "";
  if (companies && companies.length > 0) {
    companies.forEach((company) => {
      rows += `
        <tr>
          <td>${company.id}</td>
          <td>${company.name}</td>
          <td>${new Date(company.created_at || Date.now()).toLocaleDateString()}</td>
          <td>
            <button class="btn-icon btn-delete" onclick="window.deleteItem('companies', '${company.id}')">🗑️</button>
          </td>
        </tr>
      `;
    });
  } else {
    rows = `<tr><td colspan="4" style="text-align: center;">No companies found</td></tr>`;
  }

  contentArea.innerHTML = `
    <div class="table-controls">
      <h2>Companies Management</h2>
      <button class="action-btn" id="addCompanyBtn">Add Company</button>
    </div>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Company Name</th>
          <th>Created At</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;

  document.getElementById("addCompanyBtn").addEventListener("click", () => openCrudModal("companies"));
}

// 3. Render Recruiters List
async function renderRecruiters() {
  const { data: recruiters } = await supabase.from("recruiters").select("*");
  
  let rows = "";
  if (recruiters && recruiters.length > 0) {
    recruiters.forEach((recruiter) => {
      const company = dropdownData.companies.find(c => c.id === recruiter.company_id)?.name || recruiter.company_id;
      const profile = dropdownData.profiles.find(p => p.id === recruiter.profile_id)?.email || recruiter.profile_id;
      
      rows += `
        <tr>
          <td>${recruiter.id}</td>
          <td>${profile}</td>
          <td>${company}</td>
          <td>
            <button class="btn-icon btn-delete" onclick="window.deleteItem('recruiters', '${recruiter.id}')">🗑️</button>
          </td>
        </tr>
      `;
    });
  } else {
    rows = `<tr><td colspan="4" style="text-align: center;">No recruiters found</td></tr>`;
  }

  contentArea.innerHTML = `
    <div class="table-controls">
      <h2>Recruiters Management</h2>
      <button class="action-btn" id="addRecruiterBtn">Add Recruiter</button>
    </div>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Recruiter Profile (Email)</th>
          <th>Assigned Company</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;

  document.getElementById("addRecruiterBtn").addEventListener("click", () => openCrudModal("recruiters"));
}

// 4. Render Candidates List
async function renderCandidates() {
  const { data: candidates } = await supabase.from("candidates").select("*").order("name");
  
  let rows = "";
  if (candidates && candidates.length > 0) {
    candidates.forEach((cand) => {
      const company = dropdownData.companies.find(c => c.id === cand.company_id)?.name || cand.company_id;
      rows += `
        <tr>
          <td>${cand.id}</td>
          <td>${cand.name}</td>
          <td>${cand.email}</td>
          <td>${company || "None"}</td>
          <td>
            <button class="btn-icon btn-delete" onclick="window.deleteItem('candidates', '${cand.id}')">🗑️</button>
          </td>
        </tr>
      `;
    });
  } else {
    rows = `<tr><td colspan="5" style="text-align: center;">No candidates found</td></tr>`;
  }

  contentArea.innerHTML = `
    <div class="table-controls">
      <h2>Candidates Management</h2>
      <button class="action-btn" id="addCandidateBtn">Add Candidate</button>
    </div>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Email</th>
          <th>Company</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;

  document.getElementById("addCandidateBtn").addEventListener("click", () => openCrudModal("candidates"));
}

// 5. Render Interviews List
async function renderInterviews() {
  const { data: interviews } = await supabase.from("interviews").select("*").order("completed_at", { ascending: false });
  
  let rows = "";
  if (interviews && interviews.length > 0) {
    interviews.forEach((interview) => {
      const candidateName = dropdownData.candidates.find(c => c.id === interview.candidate_id)?.name || interview.candidate_id;
      rows += `
          <tr>
            <td>${interview.id}</td>
            <td>${candidateName}</td>
            <td>${interview.status}</td>
            <td>${interview.score !== null ? interview.score : "Not scored"}</td>
            <td>${interview.video_url ? `<video src="${interview.video_url}" controls width="200"></video>` : "N/A"}</td>
            <td>${interview.video_url ? `<a href="${interview.video_url}" target="_blank" style="color:#3b82f6; text-decoration:underline;">Watch</a>` : "N/A"}</td>
            <td>${new Date(interview.completed_at).toLocaleString()}</td>
            <td>
              <button class="btn-icon btn-delete" onclick="window.deleteItem('interviews', '${interview.id}')">🗑️</button>
            </td>
          </tr>
      `;
    });
  } else {
    rows = `<tr><td colspan="7" style="text-align: center;">No interviews found</td></tr>`;
  }

  contentArea.innerHTML = `
    <div class="table-controls">
      <h2>Interviews Management</h2>
    </div>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Candidate</th>
          <th>Status</th>
          <th>Score</th>
          <th>Video</th>
          <th>Video URL</th>
          <th>Completed At</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

// Modal Form setup based on Table type
function openCrudModal(table) {
  editItem = { table };
  modalTitle.textContent = `Add new ${table.slice(0, -1)}`;
  dynamicFormFields.innerHTML = "";

  if (table === "companies") {
    dynamicFormFields.innerHTML = `
      <div class="form-group">
        <label for="compName">Company Name</label>
        <input type="text" id="compName" required placeholder="Enter company name">
      </div>
    `;
  } else if (table === "recruiters") {
    const compOptions = dropdownData.companies.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    const profOptions = dropdownData.profiles
      .filter(p => p.role === "recruiter")
      .map(p => `<option value="${p.id}">${p.email}</option>`).join("");

    dynamicFormFields.innerHTML = `
      <div class="form-group">
        <label for="recProfile">Select Profile (Recruiter role)</label>
        <select id="recProfile" required>
          <option value="">-- Choose Profile --</option>
          ${profOptions}
        </select>
        <p style="font-size: 0.8rem; color: #94a3b8; margin: 4px 0 0 0;">Only users with 'recruiter' role in profiles table are shown.</p>
      </div>
      <div class="form-group">
        <label for="recCompany">Select Company</label>
        <select id="recCompany" required>
          <option value="">-- Choose Company --</option>
          ${compOptions}
        </select>
      </div>
    `;
  } else if (table === "candidates") {
    const compOptions = dropdownData.companies.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    dynamicFormFields.innerHTML = `
      <div class="form-group">
        <label for="candName">Candidate Name</label>
        <input type="text" id="candName" required placeholder="Enter candidate name">
      </div>
      <div class="form-group">
        <label for="candEmail">Candidate Email</label>
        <input type="email" id="candEmail" required placeholder="name@domain.com">
      </div>
      <div class="form-group">
        <label for="candCompany">Assigned Company</label>
        <select id="candCompany" required>
          <option value="">-- Choose Company --</option>
          ${compOptions}
        </select>
      </div>
    `;
  }

  crudModal.style.display = "flex";
}

// Handle Add Submission
async function handleFormSubmit(e) {
  e.preventDefault();
  const table = editItem.table;

  try {
    let payload = {};
    if (table === "companies") {
      payload = { name: document.getElementById("compName").value.trim() };
    } else if (table === "recruiters") {
      payload = {
        profile_id: document.getElementById("recProfile").value,
        company_id: document.getElementById("recCompany").value
      };
    } else if (table === "candidates") {
      payload = {
        name: document.getElementById("candName").value.trim(),
        email: document.getElementById("candEmail").value.trim(),
        company_id: document.getElementById("candCompany").value
      };
    }

    const { error } = await supabase.from(table).insert([payload]);
    if (error) throw error;

    crudModal.style.display = "none";
    await fetchDropdownData();
    await loadCurrentTab();
  } catch (err) {
    console.error(err);
    alert("Failed to save: " + err.message);
  }
}

// Global function to handle deletes
window.deleteItem = async (table, id) => {
  if (!confirm(`Are you sure you want to delete this ${table.slice(0, -1)}?`)) return;

  try {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
    
    await fetchDropdownData();
    await loadCurrentTab();
  } catch (err) {
    console.error(err);
    alert("Delete failed: " + err.message);
  }
};

checkAdminSession();
