export interface Service {
  id: number;
  name: string;
  description: string | null;
  durationMin: number;
  priceTHB: number;
  active: boolean;
}

export interface BusinessHours {
  weekday: number;
  openMin: number;
  closeMin: number;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
}

export type BookingStatus = 'CONFIRMED' | 'CANCELLED';

export interface Booking {
  id: number;
  code: string;
  serviceId: number;
  customerId: number;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  createdAt: string;
  service?: Service;
  customer?: Customer;
}

export interface Slot {
  startsAt: string;
  endsAt: string;
}

export interface Availability {
  serviceId: number;
  date: string;
  durationMin: number;
  slots: Slot[];
}
