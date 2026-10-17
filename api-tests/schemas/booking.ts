import { z } from 'zod';

// Contract for restful-booker. A field that changes type or disappears fails the test
// with a readable diff instead of breaking a UI test three steps later.
export const Booking = z.object({
  firstname: z.string(),
  lastname: z.string(),
  totalprice: z.number().int().nonnegative(),
  depositpaid: z.boolean(),
  bookingdates: z.object({
    checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  additionalneeds: z.string().optional(),
});

export const CreatedBooking = z.object({ bookingid: z.number().int().positive(), booking: Booking });
export const BookingIdList = z.array(z.object({ bookingid: z.number().int() }));

export type BookingT = z.infer<typeof Booking>;
