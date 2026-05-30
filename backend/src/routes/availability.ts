import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ApiError } from '../errors';
import {
  generateSlots,
  subtractBooked,
  bangkokWeekday,
  isInPast,
  Interval,
} from '../domain/booking-rules';
import { bangkokDateTimeToUtc, isValidDateString } from '../lib/time';

export const availabilityRouter = Router();

const query = z.object({
  serviceId: z.coerce.number().int().positive(),
  date: z.string().refine(isValidDateString, 'date must be YYYY-MM-DD'),
});

// GET /api/availability?serviceId=&date=YYYY-MM-DD
// Returns the open slots for a service on a Bangkok calendar date:
//   generateSlots(business hours) − already-booked intervals − past slots.
availabilityRouter.get('/', async (req, res) => {
  const { serviceId, date } = query.parse(req.query);

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.active) {
    throw new ApiError(404, 'NOT_FOUND', 'Service not found or inactive.');
  }

  // Weekday is computed from local midnight of the requested Bangkok day.
  const dayStartUtc = bangkokDateTimeToUtc(date, 0);
  const weekday = bangkokWeekday(dayStartUtc);
  const hours = await prisma.businessHours.findUnique({ where: { weekday } });
  if (!hours) {
    res.json({ serviceId, date, durationMin: service.durationMin, slots: [] });
    return;
  }

  const slotStartMinutes = generateSlots(hours.openMin, hours.closeMin, service.durationMin);
  const candidates: Interval[] = slotStartMinutes.map((min) => ({
    start: bangkokDateTimeToUtc(date, min),
    end: bangkokDateTimeToUtc(date, min + service.durationMin),
  }));

  const dayEndUtc = bangkokDateTimeToUtc(date, 24 * 60);
  const booked = await prisma.booking.findMany({
    where: {
      serviceId,
      status: 'CONFIRMED',
      startsAt: { lt: dayEndUtc },
      endsAt: { gt: dayStartUtc },
    },
    select: { startsAt: true, endsAt: true },
  });
  const bookedIntervals: Interval[] = booked.map((b) => ({ start: b.startsAt, end: b.endsAt }));

  const now = new Date();
  const open = subtractBooked(candidates, bookedIntervals).filter((c) => !isInPast(c.start, now));

  res.json({
    serviceId,
    date,
    durationMin: service.durationMin,
    slots: open.map((c) => ({ startsAt: c.start.toISOString(), endsAt: c.end.toISOString() })),
  });
});
