import { prisma } from '@/lib/db';
import { getRecentSummaries } from '@/lib/chat-persistence';
import type { Pillar } from '@/lib/interventions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any; // Prisma Json fields accept any serialisable value

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CompanionEvent {
  id: string;
  userId: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
  isRecurring: boolean;
  autoScore: number;
  userStressScore?: number;
}

export interface CoachingRecord {
  id: string;
  eventId: string;
  pillar: 'awareness' | 'connection' | 'insight' | 'purpose';
  content: string;
  sentAt: string;
  channel: 'telegram' | 'webpush';
  responseScore?: number;
  responseText?: string;
}

export interface DailyIntention {
  userId: string;
  date: string;
  intention: string;
}

/* ------------------------------------------------------------------ */
/*  User registry                                                      */
/* ------------------------------------------------------------------ */

/**
 * @deprecated NextAuth creates users automatically via PrismaAdapter.
 * Kept as a no-op for callers that haven't been updated yet.
 */
export async function registerUser(_userId: string): Promise<void> {
  // no-op — NextAuth handles user creation
}

export async function getAllUserIds(): Promise<string[]> {
  const users = await prisma.user.findMany({
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/* ------------------------------------------------------------------ */
/*  Calendar tokens                                                    */
/* ------------------------------------------------------------------ */

export async function getCalendarTokens(
  userId: string,
): Promise<Record<string, unknown> | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'google' },
  });
  if (!account) return null;

  return {
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expires_at: account.expires_at,
  };
}

export async function storeCalendarTokens(
  userId: string,
  tokens: Record<string, unknown>,
): Promise<void> {
  await prisma.account.updateMany({
    where: { userId, provider: 'google' },
    data: {
      access_token: tokens.access_token as string | null,
      refresh_token: tokens.refresh_token as string | null,
      expires_at: tokens.expires_at as number | null,
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Reconnect flag                                                     */
/*                                                                     */
/*  We store this in the CompanionProfile.eventAnnotations JSON field  */
/*  under the key "needsReconnect" to avoid needing a schema change.   */
/* ------------------------------------------------------------------ */

async function getOrCreateProfile(userId: string) {
  return prisma.companionProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function markNeedsReconnect(userId: string): Promise<void> {
  const profile = await getOrCreateProfile(userId);
  const annotations = (profile.eventAnnotations as Record<string, unknown>) ?? {};
  await prisma.companionProfile.update({
    where: { userId },
    data: {
      eventAnnotations: { ...annotations, needsReconnect: true } as JsonValue,
    },
  });
}

export async function needsReconnect(userId: string): Promise<boolean> {
  const profile = await prisma.companionProfile.findUnique({
    where: { userId },
  });
  if (!profile?.eventAnnotations) return false;
  return (profile.eventAnnotations as Record<string, unknown>).needsReconnect === true;
}

export async function clearReconnect(userId: string): Promise<void> {
  const profile = await prisma.companionProfile.findUnique({
    where: { userId },
  });
  if (!profile?.eventAnnotations) return;
  const annotations = { ...(profile.eventAnnotations as Record<string, unknown>) };
  delete annotations.needsReconnect;
  await prisma.companionProfile.update({
    where: { userId },
    data: { eventAnnotations: annotations as JsonValue },
  });
}

/* ------------------------------------------------------------------ */
/*  Event cache                                                        */
/*                                                                     */
/*  Stored in CompanionProfile.eventAnnotations under "eventCache".    */
/*  This is a lightweight cache — no TTL enforcement, overwritten      */
/*  each time new events are fetched for a given date.                 */
/* ------------------------------------------------------------------ */

export async function cacheEvents(
  userId: string,
  date: string,
  events: CompanionEvent[],
): Promise<void> {
  const profile = await getOrCreateProfile(userId);
  const annotations = (profile.eventAnnotations as Record<string, unknown>) ?? {};
  const cache = (annotations.eventCache as Record<string, unknown>) ?? {};
  await prisma.companionProfile.update({
    where: { userId },
    data: {
      eventAnnotations: {
        ...annotations,
        eventCache: { ...cache, [date]: events },
      } as JsonValue,
    },
  });
}

export async function getCachedEvents(
  userId: string,
  date: string,
): Promise<CompanionEvent[] | null> {
  const profile = await prisma.companionProfile.findUnique({
    where: { userId },
  });
  if (!profile?.eventAnnotations) return null;
  const annotations = profile.eventAnnotations as Record<string, unknown>;
  const cache = annotations.eventCache as Record<string, unknown> | undefined;
  if (!cache?.[date]) return null;
  return cache[date] as CompanionEvent[];
}

/* ------------------------------------------------------------------ */
/*  Coaching records                                                   */
/*                                                                     */
/*  Stored in CompanionProfile.eventAnnotations under "coaching" and   */
/*  "coachingDays" keys.                                               */
/* ------------------------------------------------------------------ */

export async function storeCoaching(
  record: CoachingRecord & { userId: string; eventTitle: string },
): Promise<void> {
  await prisma.sentCoaching.create({
    data: {
      userId: record.userId,
      eventId: record.eventId,
      eventTitle: record.eventTitle,
      pillar: record.pillar,
      content: record.content,
      sentAt: new Date(record.sentAt),
      channel: record.channel,
    },
  });
}

export async function getCoachingForEvent(
  eventId: string,
): Promise<CoachingRecord | null> {
  const row = await prisma.sentCoaching.findUnique({ where: { eventId } });
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.eventId,
    pillar: row.pillar as CoachingRecord['pillar'],
    content: row.content,
    sentAt: row.sentAt.toISOString(),
    channel: row.channel as CoachingRecord['channel'],
    responseScore: row.responseScore ?? undefined,
    responseText: row.responseText ?? undefined,
  };
}

export async function getDayCoachings(date: string, userId?: string): Promise<CoachingRecord[]> {
  const dayStart = new Date(`${date}T00:00:00Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);
  const rows = await prisma.sentCoaching.findMany({
    where: {
      sentAt: { gte: dayStart, lte: dayEnd },
      ...(userId ? { userId } : {}),
    },
  });
  return rows.map((row) => ({
    id: row.id,
    eventId: row.eventId,
    pillar: row.pillar as CoachingRecord['pillar'],
    content: row.content,
    sentAt: row.sentAt.toISOString(),
    channel: row.channel as CoachingRecord['channel'],
    responseScore: row.responseScore ?? undefined,
    responseText: row.responseText ?? undefined,
  }));
}

/* ------------------------------------------------------------------ */
/*  Reflections                                                        */
/* ------------------------------------------------------------------ */

export async function storeReflection(
  eventId: string,
  score: number,
  text?: string,
): Promise<void> {
  await prisma.sentCoaching.update({
    where: { eventId },
    data: {
      responseScore: score,
      ...(text !== undefined && { responseText: text }),
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Daily intention                                                    */
/* ------------------------------------------------------------------ */

export async function storeDailyIntention(
  userId: string,
  _date: string,
  intention: string,
): Promise<void> {
  await prisma.companionProfile.upsert({
    where: { userId },
    create: { userId, dailyIntention: intention },
    update: { dailyIntention: intention },
  });
}

export async function getDailyIntention(
  userId: string,
  _date: string,
): Promise<string | null> {
  const profile = await prisma.companionProfile.findUnique({
    where: { userId },
  });
  return profile?.dailyIntention ?? null;
}

/* ------------------------------------------------------------------ */
/*  User history for personalized coaching                             */
/* ------------------------------------------------------------------ */

/** System keys in eventAnnotations that are NOT user stress annotations. */
const SYSTEM_ANNOTATION_KEYS = new Set([
  'coaching',
  'coachingDays',
  'eventCache',
  'needsReconnect',
]);

export interface UserAnnotation {
  stress: number;
  title: string;
  note?: string;
}

/**
 * Returns all user stress-dot annotations from eventAnnotations,
 * filtering out system keys (coaching, coachingDays, eventCache, needsReconnect).
 */
export async function getUserAnnotationHistory(
  userId: string,
): Promise<Record<string, UserAnnotation>> {
  const profile = await prisma.companionProfile.findUnique({
    where: { userId },
  });
  if (!profile?.eventAnnotations) return {};

  const all = profile.eventAnnotations as Record<string, unknown>;
  const result: Record<string, UserAnnotation> = {};

  for (const [key, value] of Object.entries(all)) {
    if (SYSTEM_ANNOTATION_KEYS.has(key)) continue;
    if (
      value &&
      typeof value === 'object' &&
      'stress' in (value as Record<string, unknown>)
    ) {
      result[key] = value as UserAnnotation;
    }
  }

  return result;
}

/**
 * Computes the user's average ACIP pillar profile from their recent chat sessions.
 * Returns average pillarScores across sessions. Defaults to 5 per pillar for new users.
 */
export async function getACIPProfile(
  userId: string,
): Promise<Record<Pillar, number>> {
  const defaults: Record<Pillar, number> = {
    awareness: 5,
    connection: 5,
    insight: 5,
    purpose: 5,
  };

  const sessions = await getRecentSummaries(userId, 10);
  if (sessions.length === 0) return defaults;

  const totals = { awareness: 0, connection: 0, insight: 0, purpose: 0 };
  let counted = 0;

  for (const s of sessions) {
    if (!s.pillarScores) continue;
    const scores = s.pillarScores as Record<string, number>;
    if (typeof scores.awareness !== 'number') continue;
    totals.awareness += scores.awareness;
    totals.connection += scores.connection;
    totals.insight += scores.insight;
    totals.purpose += scores.purpose;
    counted++;
  }

  if (counted === 0) return defaults;

  return {
    awareness: Math.round((totals.awareness / counted) * 10) / 10,
    connection: Math.round((totals.connection / counted) * 10) / 10,
    insight: Math.round((totals.insight / counted) * 10) / 10,
    purpose: Math.round((totals.purpose / counted) * 10) / 10,
  };
}

/**
 * Produces a natural language summary of the user's annotation patterns for Claude context.
 */
export function summarizeAnnotationPatterns(
  annotations: Record<string, UserAnnotation>,
): string {
  const entries = Object.values(annotations);
  if (entries.length === 0) {
    return 'No past event ratings available.';
  }

  const total = entries.reduce((sum, a) => sum + a.stress, 0);
  const avg = Math.round((total / entries.length) * 10) / 10;

  const high = entries.filter((a) => a.stress >= 4).map((a) => a.title);
  const low = entries.filter((a) => a.stress <= 2).map((a) => a.title);

  const parts = [
    `User has rated ${entries.length} events. Average stress: ${avg}/5.`,
  ];

  if (high.length > 0) {
    const uniqueHigh = [...new Set(high)].slice(0, 3);
    parts.push(`High stress events: ${uniqueHigh.join(', ')}.`);
  }
  if (low.length > 0) {
    const uniqueLow = [...new Set(low)].slice(0, 3);
    parts.push(`Low stress events: ${uniqueLow.join(', ')}.`);
  }

  return parts.join(' ');
}

/**
 * Find past annotations for events with similar titles.
 */
export function findSimilarAnnotations(
  annotations: Record<string, UserAnnotation>,
  eventTitle: string,
): UserAnnotation[] {
  const normalized = eventTitle.toLowerCase().trim();
  return Object.values(annotations).filter((a) => {
    const t = a.title.toLowerCase().trim();
    return t === normalized || t.includes(normalized) || normalized.includes(t);
  });
}
