import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { authRouter, tenantsRouter } from './routes/tenants.js';
import { usersRouter } from './routes/users.js';
import { personnelRouter } from './routes/personnel.js';
import { devicesRouter, pushRouter } from './routes/devices.js';
import { messagesRouter } from './routes/messages.js';

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'personel-planla-api',
    multiTenant: true,
  });
});

// Public: kurum oluştur + giriş
app.use('/api/v1/tenants', tenantsRouter);
app.use('/api/v1/auth', authRouter);

// Tenant-aware kaynaklar (JWT)
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/personnel', personnelRouter);
app.use('/api/v1/devices', devicesRouter);
app.use('/api/v1/push', pushRouter);
app.use('/api/v1/messages', messagesRouter);

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'Sunucu hatası' });
});

app.listen(port, () => {
  console.log(`Personel Planla API http://localhost:${port}`);
});
