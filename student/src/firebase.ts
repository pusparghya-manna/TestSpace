import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, type User } from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const firebaseConfigured = Object.values(config).every(Boolean);

function auth() {
  if (!firebaseConfigured) throw new Error('Google sign-in is not configured.');
  const app = getApps().length ? getApp() : initializeApp(config);
  return getAuth(app);
}

export async function googleLogin(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(auth(), provider);
  return credential.user;
}

export async function idToken(user: User) {
  return user.getIdToken(true);
}
