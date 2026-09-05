import crypto from 'crypto';

/**
 * Validate Telegram WebApp initData (HMAC-SHA256).
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateWebAppInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 86400
): { ok: true; userId: number; user?: { id: number; first_name?: string; username?: string } } | { ok: false; error: string } {
  if (!initData || !botToken) return { ok: false, error: 'Missing initData or bot token' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, error: 'Missing hash' };

  params.delete('hash');
  const entries: string[] = [];
  params.forEach((value, key) => {
    entries.push(`${key}=${value}`);
  });
  entries.sort();
  const dataCheckString = entries.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  try {
    const a = Buffer.from(calculated, 'hex');
    const b = Buffer.from(hash, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, error: 'Invalid hash' };
    }
  } catch {
    return { ok: false, error: 'Invalid hash' };
  }

  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > maxAgeSec) {
    return { ok: false, error: 'initData expired' };
  }

  let user: { id: number; first_name?: string; username?: string } | undefined;
  const userRaw = params.get('user');
  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch {
      /* ignore */
    }
  }
  if (!user?.id) return { ok: false, error: 'No user in initData' };

  return { ok: true, userId: Number(user.id), user };
}
