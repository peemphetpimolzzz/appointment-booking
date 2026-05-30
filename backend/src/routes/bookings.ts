import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ApiError } from '../errors';
import { generateBookingCode } from '../lib/code';
import { isValidDateString } from '../lib/time';
import {
  overlaps,
  withinBusinessHours,
  isInPast,
  meetsLeadTime,
  bangkokWeekday,
  Interval,
} from '../domain/booking-rules';

export const bookingsRouter = Router();

// Customers must book at least this far ahead.
const LEAD_MINUTES = Number(process.env.BOOKING_LEAD_MINUTES ?? 0);

const createInput = z.object({
  serviceId: z.number().int().positive(),
  startsAt: z.string().datetime({ message: 'startsAt must be an ISO 8601 UTC datetime' }),
  customer: z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(3).max(40),
    email: z.string().trim().email().max(200).optional().nullable(),
  }),
});

const listQuery = z.object({
  date: z.string().refine(isValidDateString, 'date must be YYYY-MM-DD').optional(),
  serviceId: z.coerce.number().int().positive().optional(),
});

// Map a thrown error to "this was a booking conflict" so it becomes a 409.
// Two underlying Postgres codes matter:
//   23P01 -> exclusion constraint violated (the GiST EXCLUDE caught a real overlap)
//   40001 -> serialization failure (two Serializable transactions raced)
// Prisma surfaces these either as a known-request-error (P2034 transaction conflict)
// or by carrying the raw Postgres code in the error text / meta.
function isConflict(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2034' || err.code === 'P2002') return true; // write conflict / unique race
    const meta = (err.meta ?? {}) as Record<string, unknown>;
    if (meta.code === '23P01' || meta.code === '40001') return true;
  }
  const text = err instanceof Error ? err.message : String(err);
  return (
    text.includes('23P01') ||
    text.includes('40001') ||
    text.includes('booking_no_overlap') ||
    text.toLowerCase().includes('could not serialize')
  );
}

// POST /api/bookings — create a confirmed booking, guarded against double-booking.
bookingsRouter.post('/', async (req, res) => {
  const input = createInput.parse(req.body);
  const startsAt = new Date(input.startsAt);

  const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
  if (!service || !service.active) {
    throw new ApiError(404, 'NOT_FOUND', 'Service not found or inactive.');
  }

  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
  const interval: Interval = { start: startsAt, end: endsAt };
  const now = new Date();

  if (isInPast(startsAt, now)) {
    throw new ApiError(422, 'IN_PAST', 'That time is in the past.');
  }
  if (!meetsLeadTime(startsAt, LEAD_MINUTES, now)) {
    throw new ApiError(422, 'LEAD_TIME', 'That time is too soon to book.');
  }

  const weekday = bangkokWeekday(startsAt);
  const hours = await prisma.businessHours.findUnique({ where: { weekday } });
  if (!hours || !withinBusinessHours(interval, hours.openMin, hours.closeMin)) {
    throw new ApiError(422, 'OUTSIDE_HOURS', 'That time is outside business hours.');
  }

  // Two layers of protection:
  //  (1) Serializable transaction with an explicit overlap re-check, and
  //  (2) a Postgres GiST EXCLUDE constraint (booking_no_overlap) as the final arbiter.
  try {
    const booking = await prisma.$transaction(
      async (tx) => {
        const sameDayConfirmed = await tx.booking.findMany({
          where: {
            serviceId: input.serviceId,
            status: 'CONFIRMED',
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
          select: { startsAt: true, endsAt: true },
        });
        const clash = sameDayConfirmed.some((b) =>
          overlaps(interval, { start: b.startsAt, end: b.endsAt }),
        );
        if (clash) {
          throw new ApiError(409, 'SLOT_TAKEN', 'That slot has just been taken.');
        }

        const customer = await tx.customer.create({
          data: {
            name: input.customer.name,
            phone: input.customer.phone,
            email: input.customer.email ?? null,
          },
        });

        return tx.booking.create({
          data: {
            code: generateBookingCode(),
            serviceId: input.serviceId,
            customerId: customer.id,
            startsAt,
            endsAt,
            status: 'CONFIRMED',
          },
          include: { service: true, customer: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    res.status(201).json(booking);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (isConflict(err)) {
      throw new ApiError(409, 'SLOT_TAKEN', 'That slot has just been taken.');
    }
    throw err;
  }
});

// GET /api/bookings/:code — look up a booking by its public code.
bookingsRouter.get('/:code', async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { code: req.params.code.toUpperCase() },
    include: { service: true, customer: true },
  });
  if (!booking) throw new ApiError(404, 'NOT_FOUND', 'Booking not found.');
  res.json(booking);
});

// POST /api/bookings/:code/cancel — cancel a confirmed booking.
bookingsRouter.post('/:code/cancel', async (req, res) => {
  const code = req.params.code.toUpperCase();
  const booking = await prisma.booking.findUnique({ where: { code } });
  if (!booking) throw new ApiError(404, 'NOT_FOUND', 'Booking not found.');
  if (booking.status === 'CANCELLED') {
    throw new ApiError(409, 'ALREADY_CANCELLED', 'This booking is already cancelled.');
  }
  const updated = await prisma.booking.update({
    where: { code },
    data: { status: 'CANCELLED' },
    include: { service: true, customer: true },
  });
  res.json(updated);
});

// GET /api/bookings?date=&serviceId= — admin listing.
bookingsRouter.get('/', async (req, res) => {
  const { date, serviceId } = listQuery.parse(req.query);
  const where: Prisma.BookingWhereInput = {};
  if (serviceId) where.serviceId = serviceId;
  if (date) {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    // A Bangkok day is UTC+7; widen the window to be inclusive of the local day.
    const lo = new Date(dayStart.getTime() - 7 * 60 * 60_000);
    const hi = new Date(lo.getTime() + 24 * 60 * 60_000);
    where.startsAt = { gte: lo, lt: hi };
  }
  const bookings = await prisma.booking.findMany({
    where,
    include: { service: true, customer: true },
    orderBy: { startsAt: 'asc' },
  });
  res.json(bookings);
});
