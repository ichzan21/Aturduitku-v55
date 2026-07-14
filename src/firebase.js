// AturDuitku Firebase configuration
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC5C2wt3LyCHLY6SeH5HZ9FmdgzzkWL-LM",
  authDomain: "www.aturduitku.com",
  projectId: "aturduitku",
  storageBucket: "aturduitku.firebasestorage.app",
  messagingSenderId: "965164237195",
  appId: "1:965164237195:web:b7c33333631652376daf8e",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Google Auth
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Auth helpers
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const waitForAuthUser = async (timeoutMs = 1800) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (auth.currentUser) return auth.currentUser;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return auth.currentUser;
};
export const signInWithEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signUpWithEmail = async (name, email, password) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name?.trim()) {
    await updateProfile(cred.user, { displayName: name.trim() });
  }
  return cred;
};
export const signOutUser = () => signOut(auth);
export const sendResetPassword = (email) => sendPasswordResetEmail(auth, email);
export const sendVerificationEmail = () => {
  if (!auth.currentUser) throw new Error("User belum login");
  return sendEmailVerification(auth.currentUser);
};
export const onAuthChange = (cb) => onAuthStateChanged(auth, cb);
export const getCurrentIdToken = async () => {
  const user = auth.currentUser;
  return user ? user.getIdToken() : "";
};
