import { kv } from '@vercel/kv';

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

export async function registerUser(userId: string): Promise<void> {
  await kv.sadd('users:all', userId);
}

export async function getAllUserIds(): Promise<string[]> {
  return kv.smembers('users:all');
}

/* ------------------------------------------------------------------ */
/*  Calendar tokens                                                    */
/* ------------------------------------------------------------------ */

export async function storeCalendarTokens(
  userId: string,
  tokens: Record<string, unknown>,
): Promise<void> {
  await kv.set(`calendar_tokens:${userId}`, JSON.stringify(tokens));
}

export async function getCalendarTokens(
  userId: string,
): Promise<Record<string, unknown> | null> {
  const raw = await kv.get<string>(`calendar_tokens:${userId}`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

/* ------------------------------------------------------------------ */
/*  Reconnect flag                                                     */
/* ------------------------------------------------------------------ */

export async function markNeedsReconnect(userId: string): Promise<void> {
  await kv.set(`needs_reconnect:${userId}`, 'true');
}

export async function needsReconnect(userId: string): Promise<boolean> {
  const val = await kv.get<string>(`needs_reconnect:${userId}`);
  return val === 'true';
}

export async function clearReconnect(userId: string): Promise<void> {
  await kv.del(`needs_reconnect:${userId}`);
}

/* ------------------------------------------------------------------ */
/*  Event cache                                                        */
/* ------------------------------------------------------------------ */

export async function cacheEvents(
  userId: string,
  date: string,
  events: CompanionEvent[],
): Promise<void> {
  await kv.set(`events:${userId}:${date}`, JSON.stringify(events), { ex: 86400 });
}

export async function getCachedEvents(
  userId: string,
  date: string,
): Promise<CompanionEvent[] | null> {
  const raw = await kv.get<string>(`events:${userId}:${date}`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

/* ------------------------------------------------------------------ */
/*  Coaching records                                                   */
/* ------------------------------------------------------------------ */

export async function storeCoaching(record: CoachingRecord): Promise<void> {
  // Store by eventId for dedup lookups
  await kv.set(`coaching:${record.eventId}`, JSON.stringify(record));

  // Append to daily list (date derived from sentAt)
  const date = record.sentAt.slice(0, 10); // YYYY-MM-DD
  await kv.rpush(`coaching_day:${date}`, JSON.stringify(record));
}

export async function getCoachingForEvent(
  eventId: string,
): Promise<CoachingRecord | null> {
  const raw = await kv.get<string>(`coaching:${eventId}`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function getDayCoachings(date: string): Promise<CoachingRecord[]> {
  const items = await kv.lrange<string>(`coaching_day:${date}`, 0, -1);
  return items.map((item) =>
    typeof item === 'string' ? JSON.parse(item) : item,
  );
}

/* ------------------------------------------------------------------ */
/*  Reflections                                                        */
/* ------------------------------------------------------------------ */

export async function storeReflection(
  eventId: string,
  score: number,
  text?: string,
): Promise<void> {
  const existing = await getCoachingForEvent(eventId);
  if (!existing) return;

  const updated: CoachingRecord = {
    ...existing,
    responseScore: score,
    ...(text !== undefined && { responseText: text }),
  };

  await kv.set(`coaching:${eventId}`, JSON.stringify(updated));
}

/* ------------------------------------------------------------------ */
/*  Daily intention                                                    */
/* ------------------------------------------------------------------ */

export async function storeDailyIntention(
  userId: string,
  date: string,
  intention: string,
): Promise<void> {
  await kv.set(`intention:${userId}:${date}`, intention);
}

export async function getDailyIntention(
  userId: string,
  date: string,
): Promise<string | null> {
  return kv.get<string>(`intention:${userId}:${date}`);
}
