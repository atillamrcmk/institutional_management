import { Router } from 'express';
import { provisionTenant } from '../services/tenantProvisioning.js';
import { loginWithEmail } from '../services/authService.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const tenantsRouter = Router();
export const authRouter = Router();

tenantsRouter.post('/', async (req, res) => {
  try {
    const { name, slug, orgType, owner } = req.body as {
      name?: string;
      slug?: string;
      orgType?: 'INSTITUTION' | 'BUSINESS';
      owner?: { email?: string; password?: string; displayName?: string };
    };

    if (!name || !slug || !owner?.email || !owner?.password || !owner?.displayName) {
      res.status(400).json({
        error: 'name, slug ve owner { email, password, displayName } zorunludur',
      });
      return;
    }

    const result = await provisionTenant({
      name,
      slug,
      orgType,
      owner: {
        email: owner.email,
        password: owner.password,
        displayName: owner.displayName,
      },
    });

    const login = await loginWithEmail(owner.email, owner.password);

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
});

authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'email ve password zorunludur' });
      return;
    }
    const result = await loginWithEmail(email, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({
      error: error instanceof Error ? error.message : 'Giriş başarısız',
    });
  }
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  res.json({
    user: req.auth,
  });
});
