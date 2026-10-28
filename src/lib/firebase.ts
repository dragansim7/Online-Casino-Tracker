/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  projectId: "gen-lang-client-0981577974",
  appId: "1:367539134961:web:03216a1886901d86752450",
  apiKey: "AIzaSyA5VDG2hWKHIzb65XtgetACwUbypTGFnmw",
  authDomain: "gen-lang-client-0981577974.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-axhub-29bb6ce1-faf6-4268-ad2b-79eb95d78116",
  storageBucket: "gen-lang-client-0981577974.firebasestorage.app",
  messagingSenderId: "367539134961",
  measurementId: "",
  oAuthClientId: "367539134961-c6hs30jelfcq3jq5k7pdeq5o360mccj7.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Cloud Firestore pointing to the designated database instance
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export default app;
