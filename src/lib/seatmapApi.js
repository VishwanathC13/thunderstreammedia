// Thin wrapper over apiGet/apiPost/apiDelete for the seat-map/hold routes.
// No new fetch logic here — reuse src/lib/api.js like everything else does.
import { apiGet, apiPost, apiDelete } from './api';

export const getSeatMap = (slug) => apiGet(`/api/events/${slug}/seatmap`, { auth: false });

export const holdSeats = (slug, seatIds) =>
  apiPost(`/api/events/${slug}/seats/hold`, { seatIds }, { auth: false });

export const releaseHold = (holdToken) => apiDelete(`/api/holds/${holdToken}`, { auth: false });
