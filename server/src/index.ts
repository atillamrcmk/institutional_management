import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import {
  corsOptionsFromEnv,
  errorHandler,
  generalLimiter,
  notFoundHandler,
  requestId,
} from './middleware/security.js';
import { authRouter, tenantsRouter } from './routes/tenants.js';
import { usersRouter } from './routes/users.js';
import { personnelRouter } from './routes/personnel.js';
import { unitsRouter } from './routes/units.js';
import { shiftsRouter } from './routes/shifts.js';
import { absencesRouter } from './routes/absences.js';
import { taskTypesRouter } from './routes/taskTypes.js';
import { assignmentsRouter } from './routes/assignments.js';
import { presenceRouter } from './routes/presence.js';
import { devicesRouter, pushRouter } from './routes/devices.js';
import { messagesRouter } from './routes/messages.js';

const app = express();
const port = Number(process.env.PORT ?? 8787);

// Reverse proxy arkasında doğru istemci IP'si (rate limit için kritik)
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
app.disable('x-powered-by');

app.use(helmet());
app.use(cors(corsOptionsFromEnv()));
app.use(requestId);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'personel-planla-api',
    multiTenant: true,
  });
});

app.use('/api/v1', generalLimiter);

// Public: kurum oluştur + giriş. Sıkı limit (20/15dk) rota düzeyinde uygulanır,
// böylece /auth/me gibi oturum uçları etkilenmez.
app.use('/api/v1/tenants', tenantsRouter);
app.use('/api/v1/auth', authRouter);

// Tenant-aware kaynaklar (JWT)
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/personnel', personnelRouter);
app.use('/api/v1/units', unitsRouter);
app.use('/api/v1/shifts', shiftsRouter);
app.use('/api/v1/absences', absencesRouter);
app.use('/api/v1/task-types', taskTypesRouter);
app.use('/api/v1/assignments', assignmentsRouter);
app.use('/api/v1/presence', presenceRouter);
app.use('/api/v1/devices', devicesRouter);
app.use('/api/v1/push', pushRouter);
app.use('/api/v1/messages', messagesRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Personel Planla API http://localhost:${port}`);
});
