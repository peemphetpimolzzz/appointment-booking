import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { bangkokDateTimeToUtc } from '../../src/lib/time';

const app = createApp();

// Pick a Bangkok date a week out that is NOT a Monday (seed closes Mondays).
function nextOpenDate(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60_000);
  while (new Date(d.getTime() + 7 * 60 * 60_000).getUTCDay() === 1) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

async function seedHoursAndService() {
  await prisma.businessHours.deleteMany({});
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    if (weekday === 1) continue;
    await prisma.businessHours.create({ data: { weekday, openMin: 9 * 60, closeMin: 18 * 60 } });
  }
  return prisma.service.create({
    data: { name: 'Test Haircut', durationMin: 60, priceTHB: 350, active: true },
  });
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

beforeEach(async () => {
  // Clean slate for each test; order respects FKs.
  await prisma.booking.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.businessHours.deleteMany({});
});

describe('health', () => {
  it('reports ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('services + business hours', () => {
  it('creates and lists a service', async () => {
    const create = await request(app)
      .post('/api/services')
      .send({ name: 'Massage', durationMin: 90, priceTHB: 800 });
    expect(create.status).toBe(201);
    expect(create.body.id).toBeGreaterThan(0);

    const list = await request(app).get('/api/services');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects invalid service input with 400 + envelope', async () => {
    const res = await request(app).post('/api/services').send({ name: '', durationMin: -1, priceTHB: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('replaces the weekly schedule', async () => {
    const res = await request(app)
      .put('/api/business-hours')
      .send({ hours: [{ weekday: 0, openMin: 600, closeMin: 1080 }] });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('availability + booking lifecycle', () => {
  it('lists slots, books one, and removes it from availability', async () => {
    const service = await seedHoursAndService();
    const date = nextOpenDate();

    const avail1 = await request(app).get(`/api/availability?serviceId=${service.id}&date=${date}`);
    expect(avail1.status).toBe(200);
    const slotCount = avail1.body.slots.length;
    expect(slotCount).toBeGreaterThan(0);

    const slot = avail1.body.slots[0];
    const booking = await request(app)
      .post('/api/bookings')
      .send({ serviceId: service.id, startsAt: slot.startsAt, customer: { name: 'Anan', phone: '0810000000' } });
    expect(booking.status).toBe(201);
    expect(booking.body.code).toMatch(/^[A-Z0-9]{8}$/);

    const avail2 = await request(app).get(`/api/availability?serviceId=${service.id}&date=${date}`);
    expect(avail2.body.slots.length).toBe(slotCount - 1);

    const lookup = await request(app).get(`/api/bookings/${booking.body.code}`);
    expect(lookup.status).toBe(200);
    expect(lookup.body.status).toBe('CONFIRMED');

    const cancel = await request(app).post(`/api/bookings/${booking.body.code}/cancel`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('CANCELLED');

    // After cancelling, the slot is bookable again.
    const avail3 = await request(app).get(`/api/availability?serviceId=${service.id}&date=${date}`);
    expect(avail3.body.slots.length).toBe(slotCount);
  });

  it('returns 409 for an overlapping booking', async () => {
    const service = await seedHoursAndService();
    const date = nextOpenDate();
    const startsAt = bangkokDateTimeToUtc(date, 10 * 60).toISOString();

    const first = await request(app)
      .post('/api/bookings')
      .send({ serviceId: service.id, startsAt, customer: { name: 'A', phone: '0810000001' } });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/bookings')
      .send({ serviceId: service.id, startsAt, customer: { name: 'B', phone: '0810000002' } });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('SLOT_TAKEN');
  });

  it('rejects times outside business hours with 422', async () => {
    const service = await seedHoursAndService();
    const date = nextOpenDate();
    // 07:00 Bangkok, before the 09:00 open.
    const startsAt = bangkokDateTimeToUtc(date, 7 * 60).toISOString();
    const res = await request(app)
      .post('/api/bookings')
      .send({ serviceId: service.id, startsAt, customer: { name: 'C', phone: '0810000003' } });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('OUTSIDE_HOURS');
  });

  it('enforces the EXCLUDE constraint under concurrent inserts (exactly one wins)', async () => {
    const service = await seedHoursAndService();
    const date = nextOpenDate();
    const startsAt = bangkokDateTimeToUtc(date, 14 * 60).toISOString();

    const fire = () =>
      request(app)
        .post('/api/bookings')
        .send({ serviceId: service.id, startsAt, customer: { name: 'Race', phone: '0810000009' } });

    const results = await Promise.all([fire(), fire(), fire(), fire()]);
    const statuses = results.map((r) => r.status);
    const created = statuses.filter((s) => s === 201).length;
    const conflicts = statuses.filter((s) => s === 409).length;
    expect(created).toBe(1);
    expect(conflicts).toBe(results.length - 1);

    const confirmed = await prisma.booking.count({ where: { serviceId: service.id, status: 'CONFIRMED' } });
    expect(confirmed).toBe(1);
  });
});
