/**
 * Verify Google / Firebase ID tokens for student Google login.
 * Uses Google's tokeninfo endpoint (no native binary deps).
 */
export async function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') return null;
  const projectId = String(process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLIENT_ID || '').trim();
  try {
    // Prefer Google tokeninfo for simplicity in Appwrite runtime
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.email || data.email_verified === 'false' || data.email_verified === false) {
      // Firebase may omit email_verified as string; still require email
      if (!data.email) return null;
    }
    // Audience check when configured
    if (projectId) {
      const aud = String(data.aud || '');
      if (aud !== projectId && !aud.includes(projectId) && data.azp !== projectId) {
        // Also accept if GOOGLE_CLIENT_ID matches
        const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
        if (clientId && aud !== clientId && data.azp !== clientId) {
          console.warn('[googleAuth] audience mismatch', aud, projectId);
          // Soft-fail only if both env set and neither matches
          if (clientId && projectId) return null;
        }
      }
    }
    return {
      email: String(data.email).toLowerCase(),
      name: data.name || data.email?.split('@')[0] || 'Student',
      picture: data.picture || null,
      sub: data.sub || data.user_id || null,
      provider: 'google',
    };
  } catch (e) {
    console.warn('[googleAuth] verify failed', e?.message || e);
    return null;
  }
}
