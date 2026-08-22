import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");

// Already signed in? Skip straight to admin.
onAuthStateChanged(auth, (user) => {
  if (user) window.location.replace("admin.html");
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
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "admin.html";
  } catch (err) {
    console.error(err);
    loginError.textContent = "Sign-in failed. Check your email and password.";
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign in";
  }
}
