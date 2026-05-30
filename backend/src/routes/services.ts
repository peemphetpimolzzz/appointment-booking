import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ApiError } from '../errors';

export const servicesRouter = Router();

const serviceInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  durationMin: z.number().int().positive().max(24 * 60),
  priceTHB: z.number().int().nonnegative(),
  active: z.boolean().optional(),
});

// GET /api/services?active=true
servicesRouter.get('/', async (req, res) => {
  const onlyActive = req.query.active === 'true';
  const services = await prisma.service.findMany({
    where: onlyActive ? { active: true } : undefined,
    orderBy: { id: 'asc' },
  });
  res.json(services);
});

servicesRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) throw new ApiError(404, 'NOT_FOUND', 'Service not found.');
  res.json(service);
});

servicesRouter.post('/', async (req, res) => {
  const data = serviceInput.parse(req.body);
  const service = await prisma.service.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      durationMin: data.durationMin,
      priceTHB: data.priceTHB,
      active: data.active ?? true,
    },
  });
  res.status(201).json(service);
});

servicesRouter.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = serviceInput.partial().parse(req.body);
  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Service not found.');
  const service = await prisma.service.update({
    where: { id },
    data: {
      ...data,
      description: data.description === undefined ? undefined : data.description ?? null,
    },
  });
  res.json(service);
});

servicesRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Service not found.');
  // Soft-delete: keep history intact, just deactivate so it stops appearing for booking.
  const service = await prisma.service.update({ where: { id }, data: { active: false } });
  res.json(service);
});
