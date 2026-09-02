import { Router } from 'express';
import {
  requireAuth,
  requirePermission,
  type AuthedRequest,
} from '../middleware/auth.js';
import { asyncHandler } from '../middleware/validate.js';
import {
  getDashboardStats,
  getOfficeUnitsSummary,
  getPresenceForDate,
  type PresenceFilters,
} from '../services/presenceService.js';
import { isDateString, todayDateString } from '../services/shiftCalculator.js';

export const presenceRouter = Router();

presenceRouter.use(requireAuth, requirePermission('presence.view'));

function resolveDate(value: unknown): string {
  return typeof value === 'string' && isDateString(value) ? value : todayDateString();
}

/**
 * Verilen tarihte görevde olan personel listesi.
 * Vardiya grupları + OFFICE birimler + izinler birleştirilerek hesaplanır.
 */
presenceRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const date = resolveDate(req.query.date);

    const filters: PresenceFilters = {};
    if (typeof req.query.unitId === 'string' && req.query.unitId) {
      filters.unitId = req.query.unitId;
    }
    if (typeof req.query.shiftGroupId === 'string' && req.query.shiftGroupId) {
      filters.shiftGroupId = req.query.shiftGroupId;
    }
    if (
      typeof req.query.status === 'string' &&
      ['all', 'on_duty', 'on_assignment', 'absent'].includes(req.query.status)
    ) {
      filters.status = req.query.status as PresenceFilters['status'];
    }

    const entries = await getPresenceForDate(req.tenantPool!, date, filters);
    res.json({ date, count: entries.length, entries });
  }),
);

/** Panel özeti: görevde / izinli / görevlendirilmiş sayıları. */
presenceRouter.get(
  '/stats',
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await getDashboardStats(req.tenantPool!, resolveDate(req.query.date)));
  }),
);

/** Mesai düzenindeki birimler ve o gün çalışan personelleri. */
presenceRouter.get(
  '/office-units',
  asyncHandler(async (req: AuthedRequest, res) => {
    const date = resolveDate(req.query.date);
    res.json({ date, units: await getOfficeUnitsSummary(req.tenantPool!, date) });
  }),
);
