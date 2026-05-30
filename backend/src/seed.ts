import { prisma } from './lib/prisma';
import { generateBookingCode } from './lib/code';
import { bangkokDateTimeToUtc } from './lib/time';

/**
 * Idempotent seed. Safe to run on every container start:
 *  - services and business hours are upserted by a stable key,
 *  - sample bookings are only created when the table is empty.
 */
async function main(): Promise<void> {
  const services = [
    { id: 1, name: 'Haircut', description: 'Wash, cut and style.', durationMin: 60, priceTHB: 350 },
    { id: 2, name: 'Hair Colour', description: 'Full colour treatment.', durationMin: 120, priceTHB: 1500 },
    { id: 3, name: 'Manicure', description: 'Classic manicure.', durationMin: 45, priceTHB: 300 },
    { id: 4, name: 'Consultation', description: '30-minute consultation.', durationMin: 30, priceTHB: 0 },
  ];
  for (const s of services) {
    await prisma.service.upsert({
      where: { id: s.id },
      update: { name: s.name, description: s.description, durationMin: s.durationMin, priceTHB: s.priceTHB, active: true },
      create: { ...s, active: true },
    });
  }

  // Seeding services with explicit IDs does not advance the autoincrement sequence,
  // so realign it with the current max id; otherwise the first user-created service
  // would collide on the primary key.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Service"', 'id'), COALESCE((SELECT MAX(id) FROM "Service"), 1));`,
  );

  // Tue–Sun 09:00–18:00 (540–1080); closed Monday (weekday 1).
  const open = 9 * 60;
  const close = 18 * 60;
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    if (weekday === 1) {
      await prisma.businessHours.deleteMany({ where: { weekday } });
      continue;
    }
    await prisma.businessHours.upsert({
      where: { weekday },
      update: { openMin: open, closeMin: close },
      create: { weekday, openMin: open, closeMin: close },
    });
  }

  const existing = await prisma.booking.count();
  if (existing === 0) {
    // One sample booking tomorrow at 10:00 Bangkok for the Haircut service.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60_000);
    const date = tomorrow.toISOString().slice(0, 10);
    const startsAt = bangkokDateTimeToUtc(date, 10 * 60);
    const customer = await prisma.customer.create({
      data: { name: 'Somchai Jaidee', phone: '0812345678', email: 'somchai@example.com' },
    });
    await prisma.booking.create({
      data: {
        code: generateBookingCode(),
        serviceId: 1,
        customerId: customer.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60_000),
        status: 'CONFIRMED',
      },
    });
    console.log('[seed] created sample booking');
  }

  console.log('[seed] done');
}

main()
  .catch((err) => {
    console.error('[seed] failed', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
