import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  needsReconnect,
  getCoachingForEvent,
} from '@/lib/companion';
import { getTodayEvents } from '@/lib/google-calendar';
import { scoreEvent, selectPillar } from '@/lib/scoring';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    if (await needsReconnect(userId)) {
      return Response.json({ error: 'needs_reconnect' }, { status: 403 });
    }
  } catch (err) {
    console.error('[events] needsReconnect check failed:', err);
    // Continue anyway — assume not needing reconnect
  }

  try {
    const events = await getTodayEvents(userId);

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

    return Response.json({ events: enrichedEvents });
  } catch (err) {
    console.error('[events] Calendar fetch failed:', err);
    return Response.json(
      { error: 'calendar_fetch_failed', detail: String(err) },
      { status: 500 }
    );
  }
}
