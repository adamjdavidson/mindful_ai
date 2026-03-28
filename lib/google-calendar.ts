import { google } from 'googleapis';
import {
  getCalendarTokens,
  storeCalendarTokens,
  markNeedsReconnect,
} from '@/lib/companion';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
  isRecurring: boolean;
}

/**
 * Build an authenticated OAuth2 client for a given user.
 * Auto-refreshes tokens when expired and persists new tokens back to Postgres.
 * If refresh fails, marks the user as needing reconnect.
 */
export async function getCalendarClient(userId: string) {
  const tokens = await getCalendarTokens(userId);
  if (!tokens) {
    throw new Error(`No calendar tokens found for user ${userId}`);
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  oauth2.setCredentials({
    access_token: tokens.access_token as string,
    refresh_token: tokens.refresh_token as string,
    expiry_date: tokens.expires_at
      ? (tokens.expires_at as number) * 1000
      : undefined,
  });

  // Listen for token refresh so we persist new tokens
  oauth2.on('tokens', async (newTokens) => {
    await storeCalendarTokens(userId, {
      access_token: newTokens.access_token ?? tokens.access_token,
      refresh_token: newTokens.refresh_token ?? tokens.refresh_token,
      expires_at: newTokens.expiry_date
        ? Math.floor(newTokens.expiry_date / 1000)
        : tokens.expires_at,
    });
  });

  // Proactively refresh if expired
  const expiresAt = tokens.expires_at as number | undefined;
  if (expiresAt && expiresAt * 1000 < Date.now()) {
    try {
      await oauth2.getAccessToken();
    } catch {
      await markNeedsReconnect(userId);
      throw new Error(`Token refresh failed for user ${userId}`);
    }
  }

  return oauth2;
}

/**
 * Fetch today's events from the user's primary Google Calendar.
 *
 * Uses the client's IANA timezone (e.g. "America/New_York") to compute
 * "today" correctly even when the server runs in UTC (Vercel).
 * See: https://developers.google.com/workspace/calendar/api/v3/reference/events/list
 */
export async function getTodayEvents(
  userId: string,
  userTimeZone?: string,
): Promise<CalendarEvent[]> {
  const auth = await getCalendarClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const tz = userTimeZone || 'UTC';

  // Compute "today" in the user's timezone using Intl.DateTimeFormat
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayStr = formatter.format(new Date()); // YYYY-MM-DD

  // Google Calendar API wants RFC3339 timestamps.
  // We pass the local date boundaries and let the timeZone param handle interpretation.
  const timeMin = `${todayStr}T00:00:00`;
  const timeMax = `${todayStr}T23:59:59`;

  console.log('[calendar] tz:', tz, 'today:', todayStr, 'range:', timeMin, '-', timeMax);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date(`${timeMin}`).toISOString(),
    timeMax: new Date(`${timeMax}`).toISOString(),
    timeZone: tz,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const items = response.data.items ?? [];
  console.log('[calendar] got', items.length, 'events');

  return items.map((event) => ({
    id: event.id ?? '',
    title: event.summary ?? '(no title)',
    start: event.start?.dateTime ?? event.start?.date ?? '',
    end: event.end?.dateTime ?? event.end?.date ?? '',
    attendees: (event.attendees ?? [])
      .map((a) => a.email)
      .filter((e): e is string => Boolean(e)),
    isRecurring: Boolean(event.recurringEventId),
  }));
}
