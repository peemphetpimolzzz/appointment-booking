import { useState } from 'react';
import { api } from '../api/client';
import { Booking } from '../types';
import { formatDate, formatTime, formatTHB } from '../format';

export function Lookup() {
  const [code, setCode] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function find(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBooking(null);
    setBusy(true);
    try {
      const result = await api.get<Booking>(`/bookings/${code.trim().toUpperCase()}`);
      setBooking(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!booking) return;
    setError(null);
    setBusy(true);
    try {
      const updated = await api.post<Booking>(`/bookings/${booking.code}/cancel`);
      setBooking(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Find my booking</h1>
      </div>

      {error && (
        <div className="error-banner" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <form className="card toolbar" onSubmit={find}>
        <input
          className="input"
          placeholder="Enter your booking code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label="Booking code"
          style={{ maxWidth: 260 }}
        />
        <button className="button primary" type="submit" disabled={busy || !code.trim()}>
          Look up
        </button>
      </form>

      {booking && (
        <div className="card">
          <div className="page-header">
            <h2>Booking {booking.code}</h2>
            <span className={`badge ${booking.status === 'CONFIRMED' ? 'badge-ok' : 'badge-low'}`}>
              {booking.status}
            </span>
          </div>
          <dl className="confirmation-details">
            <div>
              <dt>Service</dt>
              <dd>
                {booking.service?.name} · {formatTHB(booking.service?.priceTHB ?? 0)}
              </dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formatDate(booking.startsAt)}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>
                {formatTime(booking.startsAt)}–{formatTime(booking.endsAt)}
              </dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>{booking.customer?.name}</dd>
            </div>
          </dl>
          {booking.status === 'CONFIRMED' && (
            <button className="button" onClick={cancel} disabled={busy}>
              Cancel booking
            </button>
          )}
        </div>
      )}
    </div>
  );
}
