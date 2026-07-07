let firebaseModulePromise;

const loadFirebase = () => {
  if (!firebaseModulePromise) {
    firebaseModulePromise = import("./firebase.js");
  }
  return firebaseModulePromise;
};

export const preloadFirebase = () => loadFirebase();

export const signInWithGoogle = async () => {
  const firebase = await loadFirebase();
  return firebase.signInWithGoogle();
};

export const signInWithEmail = async (email, password) => {
  const firebase = await loadFirebase();
  return firebase.signInWithEmail(email, password);
};

export const signUpWithEmail = async (name, email, password) => {
  const firebase = await loadFirebase();
  return firebase.signUpWithEmail(name, email, password);
};

export const signOutUser = async () => {
  const firebase = await loadFirebase();
  return firebase.signOutUser();
};

export const onAuthChange = async (callback) => {
  const firebase = await loadFirebase();
  return firebase.onAuthChange(callback);
};

export const getCurrentIdToken = async () => {
  const firebase = await loadFirebase();
  return firebase.getCurrentIdToken();
};

export const saveUserData = async (uid, data) => {
  const firebase = await loadFirebase();
  return firebase.saveUserData(uid, data);
};

export const getUserData = async (uid) => {
  const firebase = await loadFirebase();
  return firebase.getUserData(uid);
};
