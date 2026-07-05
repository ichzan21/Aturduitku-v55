// AturDuitku Firebase configuration
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
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

// Google Auth
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

enableIndexedDbPersistence(db).catch(() => {});

// Auth helpers
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signInWithEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signUpWithEmail = async (name, email, password) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name?.trim()) {
    await updateProfile(cred.user, { displayName: name.trim() });
  }
  return cred;
};
export const signOutUser = () => signOut(auth);
export const onAuthChange = (cb) => onAuthStateChanged(auth, cb);
export const getCurrentIdToken = async () => {
  const user = auth.currentUser;
  return user ? user.getIdToken() : "";
};

// Firestore helpers
export const getUserDocRef = (uid) => doc(db, "users", uid);

export const saveUserData = async (uid, data) => {
  try {
    await setDoc(
      getUserDocRef(uid),
      {
        ...data,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("Firestore save error:", e);
  }
};

export const getUserData = async (uid) => {
  try {
    const snap = await getDoc(getUserDocRef(uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn("Firestore get error:", e);
    return null;
  }
};
