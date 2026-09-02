import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { sendPushNotifications } from '../services/pushService.js';

export const devicesRouter = Router();

devicesRouter.post('/register', requireAuth, async (req: AuthedRequest, res) => {
  const { token, platform } = req.body as { token?: string; platform?: string };

  if (!token || !platform) {
    res.status(400).json({ error: 'token ve platform zorunludur' });
    return;
  }

  await req.tenantPool!.query(
    `INSERT INTO device_push_tokens (id, user_id, token, platform, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id, token)
     DO UPDATE SET platform = EXCLUDED.platform, updated_at = NOW()`,
    [randomUUID(), req.auth!.userId, token, platform],
  );

  res.json({ ok: true });
});

export const pushRouter = Router();

pushRouter.post('/send', requireAuth, async (req: AuthedRequest, res) => {
  const { tokens, title, body, data } = req.body as {
    tokens?: string[];
    title?: string;
    body?: string;
    data?: Record<string, string>;
  };

  if (!tokens?.length || !title || !body) {
    res.status(400).json({ error: 'tokens, title ve body zorunludur' });
    return;
  }

  if (req.auth!.role !== 'INSTITUTION_ADMIN') {
    res.status(403).json({ error: 'Yetkisiz' });
    return;
  }

  await sendPushNotifications(tokens, { title, body, data });
  res.json({ ok: true, count: tokens.length });
});
