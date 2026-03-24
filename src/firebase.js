// AturDuitku - Firebase Configuration
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC5C2wt3LyCHLY6SeH5HZ9FmdgzzkWL-LM",
  authDomain: "aturduitku.firebaseapp.com",
  projectId: "aturduitku",
  storageBucket: "aturduitku.firebasestorage.app",
  messagingSenderId: "965164237195",
  appId: "1:965164237195:web:b7c33333631652376daf8e",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Google Auth - no Sheets scope needed
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

enableIndexedDbPersistence(db).catch(() => {});

// ── AUTH ──────────────────────────────────────────────────────────
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signOutUser = () => signOut(auth);
export const onAuthChange = (cb) => onAuthStateChanged(auth, cb);

// ── FIRESTORE ─────────────────────────────────────────────────────
export const getUserDocRef = (uid) => doc(db, "users", uid);

export const saveUserData = async (uid, data) => {
  try {
    await setDoc(getUserDocRef(uid), {
      ...data,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (e) { console.warn("Firestore save error:", e); }
};

export const getUserData = async (uid) => {
  try {
    const snap = await getDoc(getUserDocRef(uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) { console.warn("Firestore get error:", e); return null; }
};
