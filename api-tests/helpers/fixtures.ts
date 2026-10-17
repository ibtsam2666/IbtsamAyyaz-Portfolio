import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { CreatedBooking, type BookingT } from '../schemas/booking';

export function newBooking(overrides: Partial<BookingT> = {}): BookingT {
  return {
    firstname: 'Ibtsam',
    lastname: `QA-${Date.now()}`,
    totalprice: 240,
    depositpaid: true,
    bookingdates: { checkin: '2026-11-01', checkout: '2026-11-05' },
    additionalneeds: 'Breakfast',
    ...overrides,
  };
}

async function getToken(request: APIRequestContext): Promise<string> {
  // Public demo credentials published by restful-booker.
  const res = await request.post('/auth', { data: { username: 'admin', password: 'password123' } });
  expect(res.ok()).toBeTruthy();
  const { token } = await res.json();
  expect(token, 'auth should return a token').toBeTruthy();
  return token;
}

type Api = {
  token: string;
  /** A booking created for this test and deleted afterwards. */
  booking: { id: number; data: BookingT };
};

export const test = base.extend<Api>({
  token: async ({ request }, use) => use(await getToken(request)),
  booking: async ({ request, token }, use) => {
    const data = newBooking();
    const res = await request.post('/booking', { data });
    expect(res.status()).toBe(200);
    const body = CreatedBooking.parse(await res.json());
    await use({ id: body.bookingid, data });
    await request.delete(`/booking/${body.bookingid}`, { headers: { Cookie: `token=${token}` } });
  },
});

export { expect };
