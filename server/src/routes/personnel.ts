import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from '../middleware/auth.js';

export const personnelRouter = Router();

personnelRouter.use(requireAuth);

personnelRouter.get('/', async (req: AuthedRequest, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const pool = req.tenantPool!;

  if (q) {
    const like = `%${q}%`;
    const result = await pool.query(
      `SELECT * FROM personnel
       WHERE status = 'ACTIVE'
         AND (
           first_name ILIKE $1 OR last_name ILIKE $1 OR sicil_no ILIKE $1
           OR (first_name || ' ' || last_name) ILIKE $1
         )
       ORDER BY last_name, first_name`,
      [like],
    );
    res.json(result.rows);
    return;
  }

  const result = await pool.query(
    `SELECT * FROM personnel WHERE status = 'ACTIVE' ORDER BY last_name, first_name`,
  );
  res.json(result.rows);
});

personnelRouter.get('/:id', async (req: AuthedRequest, res) => {
  const result = await req.tenantPool!.query(`SELECT * FROM personnel WHERE id = $1`, [
    req.params.id,
  ]);
  if (!result.rowCount) {
    res.status(404).json({ error: 'Personel bulunamadı' });
    return;
  }
  res.json(result.rows[0]);
});

personnelRouter.post(
  '/',
  requirePermission('personnel.manage'),
  async (req: AuthedRequest, res) => {
    try {
      const { firstName, lastName, sicilNo, title, photoUri } = req.body as {
        firstName?: string;
        lastName?: string;
        sicilNo?: string;
        title?: string | null;
        photoUri?: string | null;
      };

      if (!firstName?.trim() || !lastName?.trim() || !sicilNo?.trim()) {
        res.status(400).json({ error: 'Ad, soyad ve sicil no zorunludur' });
        return;
      }

      const pool = req.tenantPool!;
      const dup = await pool.query(
        `SELECT id FROM personnel WHERE sicil_no = $1 AND status = 'ACTIVE'`,
        [sicilNo.trim()],
      );
      if (dup.rowCount) {
        res.status(400).json({ error: 'Bu sicil no zaten kayıtlı.' });
        return;
      }

      const id = randomUUID();
      const result = await pool.query(
        `INSERT INTO personnel (
          id, first_name, last_name, sicil_no, title, photo_uri, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
        RETURNING *`,
        [
          id,
          firstName.trim(),
          lastName.trim(),
          sicilNo.trim(),
          title?.trim() || null,
          photoUri ?? null,
        ],
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Personel eklenemedi',
      });
    }
  },
);

personnelRouter.patch(
  '/:id',
  requirePermission('personnel.manage'),
  async (req: AuthedRequest, res) => {
    try {
      const { firstName, lastName, sicilNo, title, photoUri, status } = req.body as {
        firstName?: string;
        lastName?: string;
        sicilNo?: string;
        title?: string | null;
        photoUri?: string | null;
        status?: string;
      };

      const pool = req.tenantPool!;
      const existing = await pool.query(`SELECT * FROM personnel WHERE id = $1`, [
        req.params.id,
      ]);
      if (!existing.rowCount) {
        res.status(404).json({ error: 'Personel bulunamadı' });
        return;
      }

      const current = existing.rows[0];
      const nextSicil = sicilNo?.trim() ?? current.sicil_no;

      if (nextSicil !== current.sicil_no) {
        const dup = await pool.query(
          `SELECT id FROM personnel WHERE sicil_no = $1 AND status = 'ACTIVE' AND id <> $2`,
          [nextSicil, req.params.id],
        );
        if (dup.rowCount) {
          res.status(400).json({ error: 'Bu sicil no zaten kayıtlı.' });
          return;
        }
      }

      const result = await pool.query(
        `UPDATE personnel SET
          first_name = $1,
          last_name = $2,
          sicil_no = $3,
          title = $4,
          photo_uri = $5,
          status = $6,
          updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [
          firstName?.trim() ?? current.first_name,
          lastName?.trim() ?? current.last_name,
          nextSicil,
          title === undefined ? current.title : title?.trim() || null,
          photoUri === undefined ? current.photo_uri : photoUri,
          status ?? current.status,
          req.params.id,
        ],
      );

      res.json(result.rows[0]);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Güncelleme başarısız',
      });
    }
  },
);
