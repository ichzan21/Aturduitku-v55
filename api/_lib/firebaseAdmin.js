import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { assertDatabaseAvailable } from "./databaseErrors.js";

export function hasFirebaseAdminConfig() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

function getCredential() {
  if (!hasFirebaseAdminConfig()) {
    throw new Error("Firebase Admin env is missing");
  }
  return cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  });
}

export function getAdminApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp({ credential: getCredential() });
}

export function getAdminDb() {
  assertDatabaseAvailable();
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
