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
 * Auto-refreshes tokens when expired and persists new tokens back to KV.
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
 */
export async function getTodayEvents(
  userId: string,
): Promise<CalendarEvent[]> {
  const auth = await getCalendarClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const items = response.data.items ?? [];

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
