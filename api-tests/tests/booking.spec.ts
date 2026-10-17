import { test, expect, newBooking } from '../helpers/fixtures';
import { Booking, BookingIdList, CreatedBooking } from '../schemas/booking';

test.describe('bookings API', () => {
  test('health check responds', { tag: '@smoke' }, async ({ request }) => {
    const res = await request.get('/ping');
    expect(res.status()).toBe(201);
  });

  test('create returns the booking and matches the contract', { tag: '@smoke' }, async ({ request }) => {
    const data = newBooking({ totalprice: 512 });
    const res = await request.post('/booking', { data });
    expect(res.status()).toBe(200);
    const body = CreatedBooking.parse(await res.json());
    expect(body.booking).toEqual(data);
  });

  test('read returns what was created', { tag: '@regression' }, async ({ request, booking }) => {
    const res = await request.get(`/booking/${booking.id}`);
    expect(res.status()).toBe(200);
    expect(Booking.parse(await res.json())).toEqual(booking.data);
  });

  test('list filtered by name includes the new booking', { tag: '@regression' }, async ({ request, booking }) => {
    const res = await request.get('/booking', { params: { firstname: booking.data.firstname, lastname: booking.data.lastname } });
    const ids = BookingIdList.parse(await res.json()).map((b) => b.bookingid);
    expect(ids).toContain(booking.id);
  });

  test('partial update changes only the sent fields', { tag: '@regression' }, async ({ request, booking, token }) => {
    const res = await request.patch(`/booking/${booking.id}`, {
      headers: { Cookie: `token=${token}` },
      data: { totalprice: 999, additionalneeds: 'Late checkout' },
    });
    expect(res.status()).toBe(200);
    const updated = Booking.parse(await res.json());
    expect(updated).toEqual({ ...booking.data, totalprice: 999, additionalneeds: 'Late checkout' });
  });

  test('delete removes the booking', { tag: '@regression' }, async ({ request, token }) => {
    const created = CreatedBooking.parse(await (await request.post('/booking', { data: newBooking() })).json());
    const del = await request.delete(`/booking/${created.bookingid}`, { headers: { Cookie: `token=${token}` } });
    expect(del.status()).toBe(201);
    expect((await request.get(`/booking/${created.bookingid}`)).status()).toBe(404);
  });
});

test.describe('bookings API: negative cases', () => {
  test('update without a token is forbidden', { tag: '@security' }, async ({ request, booking }) => {
    const res = await request.patch(`/booking/${booking.id}`, { data: { totalprice: 1 } });
    expect(res.status()).toBe(403);
  });

  test('delete with a bad token is forbidden', { tag: '@security' }, async ({ request, booking }) => {
    const res = await request.delete(`/booking/${booking.id}`, { headers: { Cookie: 'token=not-a-real-token' } });
    expect(res.status()).toBe(403);
  });

  test('unknown booking returns 404', { tag: '@regression' }, async ({ request }) => {
    expect((await request.get('/booking/999999999')).status()).toBe(404);
  });

  test('bad credentials do not return a token', { tag: '@security' }, async ({ request }) => {
    const res = await request.post('/auth', { data: { username: 'admin', password: 'wrong' } });
    const body = await res.json();
    expect(body.token).toBeUndefined();
    expect(body.reason).toBe('Bad credentials');
  });
});
