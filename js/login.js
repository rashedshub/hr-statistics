import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");

async function hasAdminAccess(uid) {
  try {
    const snap = await getDoc(doc(db, "admins", uid));
    return snap.exists();
  } catch (err) {
    console.error(err);
    return false;
  }
}

// Already signed in? Skip straight to admin — but only if their access hasn't been revoked.
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  if (await hasAdminAccess(user.uid)) {
    window.location.replace("admin.html");
  } else {
    await signOut(auth);
  }
});

loginBtn.addEventListener("click", doLogin);
document.getElementById("loginPassword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});

async function doLogin() {
  loginError.textContent = "";
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!email || !password) {
    loginError.textContent = "Enter both email and password.";
    return;
  }
  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in…";
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (!(await hasAdminAccess(cred.user.uid))) {
      await signOut(auth);
      loginError.textContent = "This account has no admin access assigned. Contact your administrator.";
      loginBtn.disabled = false;
      loginBtn.textContent = "Sign in";
      return;
    }
    window.location.href = "admin.html";
  } catch (err) {
    console.error(err);
    loginError.textContent = "Sign-in failed. Check your email and password.";
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign in";
  }
}
