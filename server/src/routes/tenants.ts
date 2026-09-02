import { Router } from 'express';
import { z } from 'zod';
import { provisionTenant } from '../services/tenantProvisioning.js';
import { loginWithEmail } from '../services/authService.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { authLimiter } from '../middleware/security.js';
import { validateBody, validated } from '../middleware/validate.js';

export const tenantsRouter = Router();
export const authRouter = Router();

const createTenantSchema = z.object({
  name: z.string().trim().min(2, 'Kurum adı en az 2 karakter olmalı').max(200),
  slug: z
    .string()
    .trim()
    .min(2, 'Kurum kodu en az 2 karakter olmalı')
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, 'Kurum kodu yalnızca harf, rakam, _ ve - içerebilir'),
  orgType: z.enum(['INSTITUTION', 'BUSINESS']).optional(),
  owner: z.object({
    email: z.string().trim().toLowerCase().email('Geçerli bir e-posta girin'),
    password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır').max(200),
    displayName: z.string().trim().min(1, 'Ad soyad zorunludur').max(200),
  }),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Geçerli bir e-posta girin'),
  password: z.string().min(1, 'Şifre zorunludur').max(200),
});

tenantsRouter.post(
  '/',
  authLimiter,
  validateBody(createTenantSchema),
  async (req, res) => {
    const input = validated<z.infer<typeof createTenantSchema>>(req);

    try {
      const result = await provisionTenant({
        name: input.name,
        slug: input.slug,
        orgType: input.orgType,
        owner: input.owner,
      });

      const login = await loginWithEmail(input.owner.email, input.owner.password);

      res.status(201).json({
        tenant: {
          id: result.tenantId,
          name: result.name,
          slug: result.slug,
          orgType: result.orgType,
          dbName: result.dbName,
        },
        owner: result.owner,
        token: login.token,
        user: login.user,
      });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Kurum oluşturulamadı',
      });
    }
  },
);

authRouter.post('/login', authLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password } = validated<z.infer<typeof loginSchema>>(req);

  try {
    res.json(await loginWithEmail(email, password));
  } catch (error) {
    res.status(401).json({
      error: error instanceof Error ? error.message : 'Giriş başarısız',
    });
  }
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  res.json({ user: req.auth });
});
