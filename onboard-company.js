// onboard-company.js – handles Recruiter Company Onboarding
import { supabase } from "./supabase.js";

const authStep = document.getElementById("authStep");
const onboardStep = document.getElementById("onboardStep");
const googleBtn = document.getElementById("googleBtn");
const onboardForm = document.getElementById("onboardForm");
const submitBtn = document.getElementById("submitBtn");

let currentUser = null;

// Handle sign-in triggers
googleBtn.addEventListener("click", async () => {
  googleBtn.disabled = true;
  googleBtn.innerText = "Signing in...";
  
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/onboard-company.html"
    }
  });
  
  if (error) {
    console.error("Auth error:", error);
    googleBtn.disabled = false;
    googleBtn.innerText = "Continue with Google";
  }
});

// Check if user is logged in
async function checkAuthSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    currentUser = user;
    authStep.style.display = "none";
    onboardStep.style.display = "block";
  } else {
    authStep.style.display = "block";
    onboardStep.style.display = "none";
  }
}

// Handle onboarding form submission
onboardForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const companyName = document.getElementById("companyName").value.trim();
  if (!companyName) return;

  submitBtn.disabled = true;
  submitBtn.innerText = "Setting up company...";

  try {
    // 1. Insert Company
    const { data: company, error: compErr } = await supabase
      .from("companies")
      .insert([{ company_name: companyName }])
      .select()
      .single();

    if (compErr) throw compErr;
    console.log("Created Company:", company);

    // 2. Fetch or Create Profile with Recruiter Role
    let profile = null;
    
    // Try finding by id
    const { data: pById } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (pById) {
      profile = pById;
      // Update role to recruiter
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ role: "recruiter" })
        .eq("id", currentUser.id);
      if (updErr) throw updErr;
    } else {
      // Try by user_id
      const { data: pByUid } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (pByUid) {
        profile = pByUid;
        const { error: updErr } = await supabase
          .from("profiles")
          .update({ role: "recruiter" })
          .eq("user_id", currentUser.id);
        if (updErr) throw updErr;
      }
    }

    // If profile still doesn't exist, create one
    if (!profile) {
      const newProf = {
        email: currentUser.email,
        full_name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || "Recruiter",
        role: "recruiter"
      };

      // Try with id column
      const { error: insIdErr } = await supabase
        .from("profiles")
        .insert([{ id: currentUser.id, ...newProf }]);
      
      if (insIdErr) {
        // Try with user_id column
        const { error: insUidErr } = await supabase
          .from("profiles")
          .insert([{ user_id: currentUser.id, ...newProf }]);
        if (insUidErr) throw insUidErr;
      }
    }

    // 3. Link Recruiter Profile to Company
    const { error: recErr } = await supabase
      .from("recruiters")
      .insert([
        {
          profile_id: currentUser.id,
          company_id: company.id
        }
      ]);

    if (recErr) {
      console.warn("Failed inserting recruiter with profile_id. Retrying with user_id/id fallback...");
      // In case recruiters table expects user_id or id instead of profile_id:
      // Let's check recruiters columns in recruiter.js: it fetched single matching profile_id = user.id.
      // So profile_id is correct! If recErr fails, it might be due to table constraints, we will log it.
      throw recErr;
    }

    submitBtn.innerText = "Success! Redirecting...";
    setTimeout(() => {
      window.location.href = "recruiter.html";
    }, 1000);

  } catch (err) {
    console.error(err);
    alert("Onboarding failed: " + err.message);
    submitBtn.disabled = false;
    submitBtn.innerText = "Complete Onboarding";
  }
});

checkAuthSession();
