/**
 * Firebase Client SDK Configuration
 *
 * Initializes Firebase for client-side usage.
 * This module is safe to import in Client Components.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * Get Firebase configuration from environment variables.
 * Returns empty strings in development if not configured.
 */
function getFirebaseConfig(): {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
} {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
}

/**
 * Get or initialize Firebase app
 */
function getFirebaseApp(): FirebaseApp {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0]!;
  }
  return initializeApp(getFirebaseConfig());
}

// Lazy initialization
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

/**
 * Get Firebase App instance
 */
function getApp(): FirebaseApp {
  if (!_app) {
    _app = getFirebaseApp();
  }
  return _app;
}

/**
 * Get Firebase Auth instance
 */
export function getClientAuth(): Auth {
  if (!_auth) {
    _auth = getAuth(getApp());
  }
  return _auth;
}

/**
 * Get Firestore instance
 */
export function getClientFirestore(): Firestore {
  if (!_db) {
    _db = getFirestore(getApp());
  }
  return _db;
}
