import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

export const businessHoursRouter = Router();

const dayInput = z.object({
  weekday: z.number().int().min(0).max(6),
  openMin: z.number().int().min(0).max(24 * 60),
  closeMin: z.number().int().min(0).max(24 * 60),
});

const putInput = z
  .object({ hours: z.array(dayInput) })
  .refine((v) => v.hours.every((h) => h.closeMin > h.openMin), {
    message: 'closeMin must be greater than openMin',
  })
  .refine((v) => new Set(v.hours.map((h) => h.weekday)).size === v.hours.length, {
    message: 'weekday values must be unique',
  });

// GET /api/business-hours -> sorted by weekday
businessHoursRouter.get('/', async (_req, res) => {
  const hours = await prisma.businessHours.findMany({ orderBy: { weekday: 'asc' } });
  res.json(hours);
});

// PUT /api/business-hours -> replace the whole weekly schedule
businessHoursRouter.put('/', async (req, res) => {
  const { hours } = putInput.parse(req.body);
  await prisma.$transaction([
    prisma.businessHours.deleteMany({}),
    prisma.businessHours.createMany({ data: hours }),
  ]);
  const saved = await prisma.businessHours.findMany({ orderBy: { weekday: 'asc' } });
  res.json(saved);
});
