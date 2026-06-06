// index.js – handles Google OAuth and role‑based redirect
import { supabase } from "./supabase.js";

// Save invitation details to localStorage before logging in
// Helper to generate a simple random password for candidate records
const generatePassword = () => Math.random().toString(36).slice(-8);
const urlParams = new URLSearchParams(window.location.search);
const inviteId = urlParams.get("invite");
if (inviteId) {
  localStorage.setItem("pending_invite", inviteId);
}

const googleBtn = document.getElementById("googleLoginBtn");

if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    // Show a loading text on click
    googleBtn.innerText = "Signing in...";
    googleBtn.disabled = true;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { 
        redirectTo: window.location.origin + "/index.html"
      }
    });
    if (error) {
      console.error("Google login error:", error);
      googleBtn.innerText = "Continue with Google";
      googleBtn.disabled = false;
    }
  });
}

// When the page loads, check if the user is already signed in
const checkSession = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // Not logged in yet
  
  if (googleBtn) {
    googleBtn.innerText = "Redirecting...";
    googleBtn.disabled = true;
  }

  // Get the role from the profiles table (checks both 'id' and 'user_id' for schema robustness)
  let profile = null;
  
  // Try 'id' column first
  const { data: pById, error: errById } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (pById) {
    profile = pById;
  } else {
    // Try 'user_id' column fallback
    const { data: pByUserId } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (pByUserId) {
      profile = pByUserId;
    }
  }

  // Ensure admin email always has admin role
  const adminEmail = "landgerupali215@gmail.com";
  if (profile && profile.email === adminEmail && profile.role !== "admin") {
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", profile.id);
    if (!updErr) {
      profile.role = "admin";
    } else {
      console.error("Failed to update admin role:", updErr);
    }
  }

  // Auto-onboard if no profile exists (default role is candidate)
  if (!profile) {
    console.log("No profile found. Auto-onboarding user as candidate.");
    const adminEmail = "landgerupali215@gmail.com";
const newProfileData = {
  email: user.email,
  full_name: user.user_metadata?.full_name || user.user_metadata?.name || "Candidate",
  role: user.email === adminEmail ? "admin" : "candidate"
};

    // Try inserting with 'id' column
    const { data: insById, error: insByIdErr } = await supabase
      .from("profiles")
      .insert([{ id: user.id, ...newProfileData }])
      .select()
      .maybeSingle();

    if (!insByIdErr && insById) {
      profile = insById;
    } else {
      // Try inserting with 'user_id' column
      const { data: insByUid, error: insByUidErr } = await supabase
        .from("profiles")
        .insert([{ user_id: user.id, ...newProfileData }])
        .select()
        .maybeSingle();
      
      if (!insByUidErr && insByUid) {
        profile = insByUid;
      } else {
        console.error("Failed to auto-onboard profile. Errors:", insByIdErr, insByUidErr);
      }
    }
  }

  if (!profile) {
    console.error("Could not load or create user profile.");
    if (googleBtn) {
      googleBtn.innerText = "Continue with Google";
      googleBtn.disabled = false;
    }
    return;
  }

  console.log("Logged in profile:", profile);

  // Perform redirection based on role
  if (profile.role === "admin") {
    window.location.href = "admin.html";
  } else if (profile.role === "recruiter") {
    window.location.href = "recruiter.html";
  } else if (profile.role === "candidate") {
    // Process pending invitation links
    const pendingInvite = localStorage.getItem("pending_invite");
    let candidateRecord = null;

    if (pendingInvite) {
      const { data: inviteCand } = await supabase
        .from("candidates")
        .select("*")
        .eq("id", pendingInvite)
        .maybeSingle();

      // Ensure the logged-in candidate email matches the invite candidate email
      if (inviteCand && inviteCand.email.toLowerCase() === user.email.toLowerCase()) {
        candidateRecord = inviteCand;
        localStorage.removeItem("pending_invite");
      }
    }

    if (!candidateRecord) {
      // Find normal candidate record by email
      let { data: normalCand } = await supabase
        .from("candidates")
        .select("*")
        .eq("email", user.email)
        .maybeSingle();
      
      candidateRecord = normalCand;
    }

    if (!candidateRecord) {
      console.log("Creating candidate record...");
      let companyId = null;
      
      // Query first available company
      const { data: companies } = await supabase.from("companies").select("id").limit(1);
      if (companies && companies.length > 0) {
        companyId = companies[0].id;
      } else {
        // Create default company
        const { data: defaultComp } = await supabase
          .from("companies")
          .insert([{ name: "Default Company" }])
          .select()
          .single();
        if (defaultComp) companyId = defaultComp.id;
      }

      const { data: newCand, error: candErr } = await supabase
        .from("candidates")
        .insert([
            {
              name: profile.full_name || "Candidate",
              email: user.email,
              company_id: companyId,
              password: generatePassword()
            }
        ])
        .select()
        .single();
      
      if (!candErr && newCand) {
        candidateRecord = newCand;
      }
    }

    if (candidateRecord) {
      localStorage.setItem("candidate", JSON.stringify(candidateRecord));
    }
    window.location.href = "candidate.html";
  } else {
    console.warn("Unsupported role:", profile.role);
  }
};

checkSession();
