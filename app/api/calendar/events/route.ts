import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  needsReconnect,
  getCoachingForEvent,
} from '@/lib/companion';
import { getTodayEvents } from '@/lib/google-calendar';
import { scoreEvent, selectPillar } from '@/lib/scoring';

export async function GET(req: Request) {
  const t0 = Date.now();
  console.log('[events] GET started');

  // Client sends its IANA timezone so we compute "today" correctly
  const url = new URL(req.url);
  const userTimeZone = url.searchParams.get('tz') || undefined;
  console.log('[events] userTimeZone:', userTimeZone);

  const session = await getServerSession(authOptions);
  console.log('[events] getServerSession took', Date.now() - t0, 'ms');

  if (!session?.user) {
    console.error('[events] No session user');
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    console.error('[events] No user ID in session');
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  console.log('[events] User:', userId);

  try {
    const t1 = Date.now();
    const reconnect = await needsReconnect(userId);
    console.log('[events] needsReconnect took', Date.now() - t1, 'ms, result:', reconnect);
    if (reconnect) {
      return Response.json({ error: 'needs_reconnect' }, { status: 403 });
    }
  } catch (err) {
    console.error('[events] needsReconnect check failed after', Date.now() - t0, 'ms:', err);
  }

  try {
    const t2 = Date.now();
    const events = await getTodayEvents(userId, userTimeZone);
    console.log('[events] getTodayEvents took', Date.now() - t2, 'ms, got', events.length, 'events');

    const t3 = Date.now();
    const enrichedEvents = await Promise.all(
      events.map(async (event) => {
        const scoringEvent = {
          summary: event.title,
          attendees: event.attendees,
          isRecurring: event.isRecurring,
        };

        const autoScore = scoreEvent(scoringEvent);
        const pillar = selectPillar(scoringEvent);
        let coaching = null;
        try {
          coaching = await getCoachingForEvent(event.id);
        } catch {
          // coaching lookup failed — skip coaching data
        }

        return {
          ...event,
          autoScore,
          pillar,
          coaching,
        };
      }),
    );
    console.log('[events] enrichment took', Date.now() - t3, 'ms');
    console.log('[events] TOTAL:', Date.now() - t0, 'ms');

    return Response.json({
      events: enrichedEvents,
      _debug: {
        userTimeZone: userTimeZone || 'none provided',
        totalMs: Date.now() - t0,
        sessionMs: Date.now() - t0,
        eventCount: enrichedEvents.length,
      },
    });
  } catch (err) {
    console.error('[events] Calendar fetch failed after', Date.now() - t0, 'ms:', err);
    return Response.json(
      { error: 'calendar_fetch_failed', detail: String(err) },
      { status: 500 }
    );
  }
}
