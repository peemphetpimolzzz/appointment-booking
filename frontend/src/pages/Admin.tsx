import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Booking, BusinessHours, Service } from '../types';
import {
  formatTHB,
  formatTime,
  hhmmToMinutes,
  minutesToHHMM,
  todayBangkok,
  weekdayName,
} from '../format';

type Tab = 'bookings' | 'services' | 'hours';

export function Admin() {
  const [tab, setTab] = useState<Tab>('bookings');
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <div className="page-header">
        <h1>Admin</h1>
      </div>

      {error && (
        <div className="error-banner" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <div className="toolbar">
        <button className={`button${tab === 'bookings' ? ' primary' : ''}`} onClick={() => setTab('bookings')}>
          Bookings
        </button>
        <button className={`button${tab === 'services' ? ' primary' : ''}`} onClick={() => setTab('services')}>
          Services
        </button>
        <button className={`button${tab === 'hours' ? ' primary' : ''}`} onClick={() => setTab('hours')}>
          Business hours
        </button>
      </div>

      {tab === 'bookings' && <BookingsPanel onError={setError} />}
      {tab === 'services' && <ServicesPanel onError={setError} />}
      {tab === 'hours' && <HoursPanel onError={setError} />}
    </div>
  );
}

function BookingsPanel({ onError }: { onError: (m: string) => void }) {
  const [date, setDate] = useState(todayBangkok());
  const [bookings, setBookings] = useState<Booking[]>([]);

  function load() {
    api
      .get<Booking[]>(`/bookings?date=${date}`)
      .then(setBookings)
      .catch((e: Error) => onError(e.message));
  }

  useEffect(load, [date]);

  async function cancel(code: string) {
    try {
      await api.post(`/bookings/${code}/cancel`);
      load();
    } catch (e) {
      onError((e as Error).message);
    }
  }

  return (
    <div className="card">
      <div className="toolbar">
        <label className="form-field">
          Date
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Bookings date"
          />
        </label>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Time</th>
            <th>Service</th>
            <th>Customer</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bookings.length === 0 ? (
            <tr>
              <td className="empty" colSpan={6}>
                No bookings for this day.
              </td>
            </tr>
          ) : (
            bookings.map((b) => (
              <tr key={b.id}>
                <td className="mono">{b.code}</td>
                <td>
                  {formatTime(b.startsAt)}–{formatTime(b.endsAt)}
                </td>
                <td>{b.service?.name}</td>
                <td>
                  {b.customer?.name}
                  <br />
                  <span className="muted">{b.customer?.phone}</span>
                </td>
                <td>
                  <span className={`badge ${b.status === 'CONFIRMED' ? 'badge-ok' : 'badge-low'}`}>
                    {b.status}
                  </span>
                </td>
                <td className="actions">
                  {b.status === 'CONFIRMED' && (
                    <button className="link-button danger" onClick={() => cancel(b.code)}>
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const emptyForm = { name: '', description: '', durationMin: 60, priceTHB: 0 };

function ServicesPanel({ onError }: { onError: (m: string) => void }) {
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState(emptyForm);

  function load() {
    api
      .get<Service[]>('/services')
      .then(setServices)
      .catch((e: Error) => onError(e.message));
  }

  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post('/services', {
        name: form.name,
        description: form.description.trim() || null,
        durationMin: Number(form.durationMin),
        priceTHB: Number(form.priceTHB),
      });
      setForm(emptyForm);
      load();
    } catch (err) {
      onError((err as Error).message);
    }
  }

  async function toggle(s: Service) {
    try {
      await api.put(`/services/${s.id}`, { active: !s.active });
      load();
    } catch (err) {
      onError((err as Error).message);
    }
  }

  return (
    <>
      <form className="card form" onSubmit={create}>
        <h2>Add a service</h2>
        <label>
          Name
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            aria-label="Service name"
          />
        </label>
        <label>
          Description
          <input
            className="input"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            aria-label="Service description"
          />
        </label>
        <label>
          Duration (minutes)
          <input
            className="input"
            type="number"
            min={1}
            value={form.durationMin}
            onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
            aria-label="Duration"
          />
        </label>
        <label>
          Price (THB)
          <input
            className="input"
            type="number"
            min={0}
            value={form.priceTHB}
            onChange={(e) => setForm({ ...form, priceTHB: Number(e.target.value) })}
            aria-label="Price"
          />
        </label>
        <div className="form-actions">
          <button className="button primary" type="submit">
            Add service
          </button>
        </div>
      </form>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Duration</th>
              <th className="num">Price</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.durationMin} min</td>
                <td className="num">{formatTHB(s.priceTHB)}</td>
                <td>
                  <span className={`badge ${s.active ? 'badge-ok' : 'badge-neutral'}`}>
                    {s.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="actions">
                  <button className="link-button" onClick={() => toggle(s)}>
                    {s.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function HoursPanel({ onError }: { onError: (m: string) => void }) {
  const [rows, setRows] = useState<Record<number, { open: string; close: string; enabled: boolean }>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get<BusinessHours[]>('/business-hours')
      .then((hours) => {
        const map: Record<number, { open: string; close: string; enabled: boolean }> = {};
        for (const d of ALL_DAYS) {
          const found = hours.find((h) => h.weekday === d);
          map[d] = found
            ? { open: minutesToHHMM(found.openMin), close: minutesToHHMM(found.closeMin), enabled: true }
            : { open: '09:00', close: '18:00', enabled: false };
        }
        setRows(map);
      })
      .catch((e: Error) => onError(e.message));
  }, []);

  async function save() {
    setSaved(false);
    const hours: BusinessHours[] = [];
    for (const d of ALL_DAYS) {
      const row = rows[d];
      if (!row?.enabled) continue;
      const openMin = hhmmToMinutes(row.open);
      const closeMin = hhmmToMinutes(row.close);
      if (openMin == null || closeMin == null || closeMin <= openMin) {
        onError(`Invalid hours for ${weekdayName(d)}.`);
        return;
      }
      hours.push({ weekday: d, openMin, closeMin });
    }
    try {
      await api.put('/business-hours', { hours });
      setSaved(true);
    } catch (e) {
      onError((e as Error).message);
    }
  }

  function update(day: number, patch: Partial<{ open: string; close: string; enabled: boolean }>) {
    setRows((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
    setSaved(false);
  }

  return (
    <div className="card">
      <h2>Weekly business hours</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>Open</th>
            <th>Open time</th>
            <th>Close time</th>
          </tr>
        </thead>
        <tbody>
          {ALL_DAYS.map((d) => {
            const row = rows[d];
            if (!row) return null;
            return (
              <tr key={d}>
                <td>{weekdayName(d)}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => update(d, { enabled: e.target.checked })}
                    aria-label={`${weekdayName(d)} open`}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    type="time"
                    value={row.open}
                    disabled={!row.enabled}
                    onChange={(e) => update(d, { open: e.target.value })}
                    aria-label={`${weekdayName(d)} open time`}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    type="time"
                    value={row.close}
                    disabled={!row.enabled}
                    onChange={(e) => update(d, { close: e.target.value })}
                    aria-label={`${weekdayName(d)} close time`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="form-actions">
        {saved && <span className="badge badge-ok">Saved</span>}
        <button className="button primary" onClick={save}>
          Save hours
        </button>
      </div>
    </div>
  );
}
