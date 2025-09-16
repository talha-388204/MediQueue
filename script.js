// script.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

/* ======= CONFIG ========
Replace the values below with your Firebase project's config.
Enable Firestore and Email/Password Auth in Firebase Console.
*/
const firebaseConfig = {
  apiKey: "AIzaSyCI_RGUnikOuUZYVp9hXaJElbiAWKEZMDE",
  authDomain: "mediqueue-64a74.firebaseapp.com",
  projectId: "mediqueue-64a74",
  storageBucket: "mediqueue-64a74.appspot.com",
  messagingSenderId: "831314942153",
  appId: "1:831314942153:web:720284796009eb610cd518"
};
/* ======================= */

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* ---------- DOM ---------- */
const views = {
  registration: document.getElementById("registrationView"),
  queue: document.getElementById("queueView"),
  admin: document.getElementById("adminView")
};
const navButtons = document.querySelectorAll(".nav-btn");
const viewButtons = document.querySelectorAll("[data-view]");
const toast = document.getElementById("toast");
const loadingOverlay = document.getElementById("loadingOverlay");
const yearSpan = document.getElementById("year");
yearSpan.textContent = new Date().getFullYear();

/* Registration elements */
const patientForm = document.getElementById("patientForm");
const pName = document.getElementById("pName");
const pPhone = document.getElementById("pPhone");
const pTestType = document.getElementById("pTestType");

/* Queue view elements */
const waitingList = document.getElementById("waitingList");
const nowServingWrap = document.getElementById("nowServing");
const nowName = document.getElementById("nowName");
const nowTest = document.getElementById("nowTest");
const nowNumber = document.getElementById("nowNumber");
const noWaiting = document.getElementById("noWaiting");

/* Admin elements */
const adminLoginForm = document.getElementById("adminLoginForm");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");
const adminPanel = document.getElementById("adminPanel");
const adminLoginCard = document.getElementById("adminLoginCard");
const loginError = document.getElementById("loginError");
const authActions = document.getElementById("authActions");

const statTotal = document.getElementById("statTotal");
const statWaiting = document.getElementById("statWaiting");
const statServing = document.getElementById("statServing");
const adminNow = document.getElementById("adminNow");
const adminNowActions = document.getElementById("adminNowActions");
const callNextBtn = document.getElementById("callNextBtn");
const markDoneBtn = document.getElementById("markDoneBtn");
const skipBtn = document.getElementById("skipBtn");
const queueListAdmin = document.getElementById("adminList");
const adminEmpty = document.getElementById("adminEmpty");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const adminSignInBtn = document.getElementById("adminSignInBtn");

/* state */
let patients = []; // array of {id, name, phone, testType, status, timestamp, queueNumber}
let currentUser = null;

/* ====== UI helpers ====== */
function showView(name){
  Object.values(views).forEach(v => v.classList.add("hidden"));
  views[name].classList.remove("hidden");
  // highlight nav
  navButtons.forEach(b => {
    b.classList.toggle("active", b.dataset.view === name);
  });
}
function showToast(msg, time = 3000){
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(()=> toast.classList.add("hidden"), time);
}
function setLoading(on){
  loadingOverlay.classList.toggle("hidden", !on);
}

/* nav clicks */
navButtons.forEach(btn => {
  const v = btn.getAttribute("data-view") || btn.dataset.view;
  if(v) btn.addEventListener("click", ()=> showView(v));
});
viewButtons.forEach(btn => {
  btn.addEventListener("click", (e)=>{
    const v = btn.dataset.view;
    if(v) showView(v);
  });
});

/* ======= Firestore realtime queue listener ======= */
const qRef = query(collection(db, "queue"), orderBy("timestamp", "asc"));
onSnapshot(qRef, snapshot => {
  const arr = [];
  snapshot.forEach((d, idx) => {
    const data = d.data();
    arr.push({
      id: d.id,
      name: data.name || "",
      phone: data.phone || "",
      testType: data.testType || "",
      status: data.status || "waiting",
      timestamp: data.timestamp || null,
      queueNumber: idx + 1
    });
  });
  patients = arr;
  renderAll();
});

/* ======= Render functions ======= */
function renderAll(){
  renderQueueView();
  renderAdminPanel();
  renderStats();
}

function renderQueueView(){
  // Now serving
  const current = patients.find(p => p.status === "serving");
  if(current){
    nowServingWrap.classList.remove("hidden");
    nowName.textContent = current.name;
    nowTest.textContent = `${current.testType} • ${current.phone}`;
    nowNumber.textContent = `#${current.queueNumber}`;
  } else {
    nowServingWrap.classList.add("hidden");
  }

  // Waiting list
  const waiting = patients.filter(p => p.status === "waiting");
  waitingList.innerHTML = "";
  if(waiting.length === 0){
    noWaiting.classList.remove("hidden");
  } else {
    noWaiting.classList.add("hidden");
    waiting.forEach(p => {
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <div>
          <div class="name">${escapeHtml(p.name)}</div>
          <div class="meta">${escapeHtml(p.testType)} • ${escapeHtml(p.phone)}</div>
        </div>
        <div class="queue-number">#${p.queueNumber}</div>
      `;
      waitingList.appendChild(item);
    });
  }
}

function renderAdminPanel(){
  // show list
  queueListAdmin.innerHTML = "";
  if(patients.length === 0){
    adminEmpty.classList.remove("hidden");
  } else {
    adminEmpty.classList.add("hidden");
    patients.forEach(p => {
      const li = document.createElement("div");
      li.className = "item";
      const statusBadge = `<span class="meta">${escapeHtml(p.status)}</span>`;
      li.innerHTML = `
        <div>
          <div class="name">#${p.queueNumber} ${escapeHtml(p.name)}</div>
          <div class="meta">${escapeHtml(p.testType)}</div>
        </div>
        ${statusBadge}
      `;
      queueListAdmin.appendChild(li);
    });
  }

  const current = patients.find(p => p.status === "serving");
  if(current){
    adminNow.textContent = `#${current.queueNumber} ${current.name} — ${current.testType} • ${current.phone}`;
    adminNowActions.classList.remove("hidden");
    document.getElementById("adminNow").classList.remove("empty");
  } else {
    adminNow.textContent = "No patient currently being served";
    adminNowActions.classList.add("hidden");
    document.getElementById("adminNow").classList.add("empty");
  }

  adminEmpty.classList.toggle("hidden", patients.length !== 0);
}

/* stats */
function renderStats(){
  statTotal.textContent = String(patients.length);
  statWaiting.textContent = String(patients.filter(p => p.status === "waiting").length);
  statServing.textContent = String(patients.some(p => p.status === "serving") ? 1 : 0);
}

/* ====== Patient registration submit ====== */
patientForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = pName.value.trim();
  const phone = pPhone.value.trim();
  const testType = pTestType.value;

  if(!name || !phone){
    showToast("Please fill all required fields");
    return;
  }

  setLoading(true);
  try {
    await addDoc(collection(db, "queue"), {
      name,
      phone,
      testType,
      status: "waiting",
      timestamp: serverTimestamp()
    });
    pName.value = "";
    pPhone.value = "";
    pTestType.value = "Blood Test";
    showToast("Registration successful! Please wait for your turn.");
  } catch(err){
    console.error(err);
    showToast("Error submitting form. Try again.");
  } finally {
    setLoading(false);
  }
});

/* ===== Admin login/logout ===== */
adminLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  setLoading(true);
  try {
    await signInWithEmailAndPassword(auth, adminEmail.value.trim(), adminPassword.value);
    adminEmail.value = "";
    adminPassword.value = "";
    showView("admin");
  } catch(err){
    console.error(err);
    loginError.textContent = err.message || "Invalid credentials";
  } finally {
    setLoading(false);
  }
});

adminLogoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showView("registration");
  } catch(err){
    console.error(err);
  }
});

/* observe auth state */
onAuthStateChanged(auth, (u) => {
  currentUser = u;
  updateAuthUI();
});

/* update auth UI */
function updateAuthUI(){
  authActions.innerHTML = "";
  if(currentUser){
    // show admin panel
    adminLoginCard.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    const btn = document.createElement("button");
    btn.textContent = "Logout";
    btn.className = "nav-btn";
    btn.addEventListener("click", async ()=> {
      try { await signOut(auth); } catch(e){ console.error(e) }
    });
    authActions.appendChild(btn);
  } else {
    adminLoginCard.classList.remove("hidden");
    adminPanel.classList.add("hidden");
    const btn = document.createElement("button");
    btn.textContent = "Admin Login";
    btn.className = "nav-btn";
    btn.addEventListener("click", ()=> showView("admin"));
    authActions.appendChild(btn);
  }
}

/* ===== Admin actions: call next, mark done, skip ===== */
callNextBtn.addEventListener("click", async () => {
  const waiting = patients.filter(p => p.status === "waiting");
  if(waiting.length === 0){
    showToast("No waiting patients");
    return;
  }
  setLoading(true);
  try {
    const next = waiting[0];
    const ref = doc(db, "queue", next.id);
    await updateDoc(ref, { status: "serving" });
    showToast(`Now serving: ${next.name}`);
  } catch(err){
    console.error(err);
    showToast("Failed to call next");
  } finally { setLoading(false); }
});

markDoneBtn.addEventListener("click", async () => {
  const current = patients.find(p => p.status === "serving");
  if(!current){ showToast("No serving patient"); return; }
  setLoading(true);
  try {
    const ref = doc(db, "queue", current.id);
    await updateDoc(ref, { status: "completed" });
    showToast(`Marked done: ${current.name}`);
  } catch(err){
    console.error(err);
    showToast("Failed to update");
  } finally { setLoading(false); }
});

skipBtn.addEventListener("click", async () => {
  const current = patients.find(p => p.status === "serving");
  if(!current){ showToast("No serving patient"); return; }
  setLoading(true);
  try {
    const ref = doc(db, "queue", current.id);
    await updateDoc(ref, { status: "skipped" });
    showToast(`Skipped: ${current.name}`);
  } catch(err){
    console.error(err);
    showToast("Failed to skip");
  } finally { setLoading(false); }
});

/* Utility: escape HTML */
function escapeHtml(s){
  return String(s || "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

/* small helper: automatically choose default view */
showView("registration");

/* Simple keyboard accessibility: Enter on nav toggles */
document.addEventListener("keydown", (e) => {
  if(e.key === "Escape") showView("registration");
});


