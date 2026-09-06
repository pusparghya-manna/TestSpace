import crypto from 'crypto';

export function validateTelegramWebAppData(initData, botToken) {
  if (!initData || !botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculated = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (calculated !== hash) return null;
    const userRaw = params.get('user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    if (!user?.id) return null;
    return { userId: Number(user.id), user };
  } catch {
    return null;
  }
}
