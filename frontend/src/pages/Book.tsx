import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Availability, Booking, Service, Slot } from '../types';
import { formatTHB, formatTime, todayBangkok } from '../format';

export function Book() {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [date, setDate] = useState<string>(todayBangkok());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<Booking | null>(null);

  useEffect(() => {
    api
      .get<Service[]>('/services?active=true')
      .then((data) => {
        setServices(data);
        if (data.length > 0) setServiceId(data[0].id);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (serviceId == null || !date) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setSelectedSlot(null);
    api
      .get<Availability>(`/availability?serviceId=${serviceId}&date=${date}`)
      .then((data) => setSlots(data.slots))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingSlots(false));
  }, [serviceId, date]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (serviceId == null || !selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const booking = await api.post<Booking>('/bookings', {
        serviceId,
        startsAt: selectedSlot.startsAt,
        customer: { name, phone, email: email.trim() || null },
      });
      setConfirmation(booking);
    } catch (err) {
      setError((err as Error).message);
      if (serviceId != null) {
        api
          .get<Availability>(`/availability?serviceId=${serviceId}&date=${date}`)
          .then((data) => {
            setSlots(data.slots);
            setSelectedSlot(null);
          })
          .catch(() => undefined);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1>Booking confirmed</h1>
            <div className="page-subtitle">
              Your time slot has been locked with PostgreSQL Serializable + GiST exclusion protection
            </div>
          </div>
          <span className="badge badge-ok">CONFIRMED</span>
        </div>
        <div className="card confirmation">
          <p className="confirmation-lead">Your appointment is booked. Keep this reference code:</p>
          <div className="confirmation-code" data-testid="booking-code">
            {confirmation.code}
          </div>
          <dl className="confirmation-details">
            <div>
              <dt>Service</dt>
              <dd>{confirmation.service?.name}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>
                {formatTime(confirmation.startsAt)}–{formatTime(confirmation.endsAt)}
              </dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>{confirmation.customer?.name}</dd>
            </div>
          </dl>
          <button
            className="button primary"
            onClick={() => {
              setConfirmation(null);
              setName('');
              setPhone('');
              setEmail('');
            }}
          >
            Book another
          </button>
        </div>
      </div>
    );
  }

  const selectedService = services.find((s) => s.id === serviceId) ?? null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Book an appointment</h1>
          <div className="page-subtitle">
            Choose a service, pick an available time slot, and receive an instant booking code
          </div>
        </div>
        <span className="badge badge-neutral">Instant Confirmation</span>
      </div>

      {error && (
        <div className="error-banner" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <div className="booking-split">
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>1. Choose a service</h2>
              <span className="badge badge-neutral">{services.length} available</span>
            </div>
            <div className="service-grid">
              {services.map((s) => (
                <button
                  key={s.id}
                  className={`service-card${s.id === serviceId ? ' selected' : ''}`}
                  onClick={() => setServiceId(s.id)}
                  type="button"
                >
                  <span className="service-name">{s.name}</span>
                  <span className="service-meta">
                    {s.durationMin} min · {formatTHB(s.priceTHB)}
                  </span>
                  {s.description && <span className="service-desc">{s.description}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>2. Pick a date &amp; time</h2>
              {!loadingSlots && (
                <span className="badge badge-ok">{slots.length} open slots</span>
              )}
            </div>
            <label className="form-field" style={{ maxWidth: 240 }}>
              Date
              <input
                className="input"
                type="date"
                value={date}
                min={todayBangkok()}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Date"
              />
            </label>

            {loadingSlots ? (
              <p className="loading">Loading available times…</p>
            ) : slots.length === 0 ? (
              <p className="loading">No open times for this day. Try another date.</p>
            ) : (
              <div className="slot-grid">
                {slots.map((slot) => (
                  <button
                    key={slot.startsAt}
                    type="button"
                    className={`slot${selectedSlot?.startsAt === slot.startsAt ? ' selected' : ''}`}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {formatTime(slot.startsAt)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside>
          {selectedSlot && selectedService ? (
            <form className="card form" onSubmit={submit}>
              <h2>3. Your details</h2>
              <p className="summary">
                {selectedService.name} · {formatTHB(selectedService.priceTHB)}
                <br />
                <span className="muted">
                  {date} at {formatTime(selectedSlot.startsAt)}–{formatTime(selectedSlot.endsAt)}
                </span>
              </p>
              <label>
                Name
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  aria-label="Name"
                />
              </label>
              <label>
                Phone
                <input
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  aria-label="Phone"
                />
              </label>
              <label>
                Email (optional)
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="Email"
                />
              </label>
              <div className="form-actions">
                <button
                  className="button primary"
                  type="submit"
                  disabled={submitting}
                  style={{ width: '100%' }}
                >
                  {submitting ? 'Booking…' : 'Confirm booking'}
                </button>
              </div>
            </form>
          ) : (
            <div className="card">
              <h2>Booking Summary</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                Select a service on the left and click any open time slot to complete your
                reservation.
              </p>
              {selectedService && (
                <div className="summary">
                  <div>{selectedService.name}</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    Duration: {selectedService.durationMin} min · {formatTHB(selectedService.priceTHB)}
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
