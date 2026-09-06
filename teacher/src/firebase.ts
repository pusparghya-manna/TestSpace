import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  confirmPasswordReset,
  verifyPasswordResetCode,
  type User,
} from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const firebaseConfigured = Object.values(config).every(Boolean);

function auth() {
  if (!firebaseConfigured) throw new Error('Firebase Authentication is not configured yet.');
  const app = getApps().length ? getApp() : initializeApp(config);
  return getAuth(app);
}

export async function firebaseRegister(email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(auth(), email.trim().toLowerCase(), password);
  await sendEmailVerification(credential.user);
  return credential.user;
}

export async function firebaseLogin(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth(), email.trim().toLowerCase(), password);
  return credential.user;
}

export async function firebaseGoogleLogin() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(auth(), provider);
  return credential.user;
}

export async function firebaseResetRequest(email: string) {
  await sendPasswordResetEmail(auth(), email.trim().toLowerCase(), {
    url: `${window.location.origin}/reset-password`,
    handleCodeInApp: true,
  });
}

export async function firebaseVerifyResetCode(code: string) {
  return verifyPasswordResetCode(auth(), code);
}

export async function firebaseResetPassword(code: string, password: string) {
  await confirmPasswordReset(auth(), code, password);
}

export async function firebaseIdToken(user: User) {
  return user.getIdToken(true);
}
