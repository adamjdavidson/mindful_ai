# Mindful Day Companion — Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a working calendar-aware mindfulness coaching system that reads your Google Calendar, scores events on stress, sends Telegram/web coaching prompts before high-stress meetings, captures post-event reflections, and displays a timeline dashboard.

**Architecture:** NextAuth for Google OAuth (calendar consent in one flow). Vercel KV for all persistence (tokens, events, coaching records). Vercel Cron (every 5 min) runs the coaching pipeline. Telegram Bot API + web push for notifications. Claude API generates pillar-appropriate coaching prompts. Pure-function scoring engine in `lib/scoring.ts`. Dashboard at `/companion` with auto-scroll-to-now timeline.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, `googleapis`, `@vercel/kv`, `next-auth`, `@anthropic-ai/sdk`, Telegram Bot API (HTTP), Web Push API, vitest

---

### Task 1: Install Dependencies + Environment Setup

**Files:**
- Modify: `package.json`
- Create: `.env.local.example`

**Step 1: Install new packages**

Run:
```bash
npm install @vercel/kv googleapis next-auth
```

**Step 2: Create env example file**

Create `.env.local.example`:
```env
# Existing
ANTHROPIC_API_KEY=your_anthropic_key

# Google OAuth (get from Google Cloud Console > APIs & Services > Credentials)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32

# Vercel KV (auto-populated when you add KV to your Vercel project)
KV_URL=your_kv_url
KV_REST_API_URL=your_kv_rest_api_url
KV_REST_API_TOKEN=your_kv_rest_api_token
KV_REST_API_READ_ONLY_TOKEN=your_kv_readonly_token

# Telegram (optional — get from @BotFather on Telegram)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Token encryption
TOKEN_ENCRYPTION_KEY=generate_with_openssl_rand_hex_32
```

**Step 3: Update .env.local with real values**

The user needs to:
1. Create a Google Cloud project, enable Google Calendar API, create OAuth credentials with redirect URI `http://localhost:3000/api/auth/callback/google`
2. Add Vercel KV to their Vercel project (or use local Redis for dev)
3. Optionally create a Telegram bot via @BotFather

**Step 4: Commit**

```bash
git add package.json package-lock.json .env.local.example
git commit -m "feat: add companion dependencies (vercel-kv, googleapis, next-auth)"
```

---

### Task 2: Scoring Engine (TDD)

**Files:**
- Create: `lib/scoring.ts`
- Create: `lib/__tests__/scoring.test.ts`

**Step 1: Write the failing tests**

```typescript
// lib/__tests__/scoring.test.ts
import { describe, it, expect } from 'vitest';
import { scoreEvent, selectPillar } from '../scoring';

describe('scoreEvent', () => {
  it('returns base score of 2 for a simple event', () => {
    const event = {
      summary: 'Team lunch',
      attendees: ['alice@co.com', 'bob@co.com'],
      isRecurring: false,
    };
    expect(scoreEvent(event)).toBe(2);
  });

  it('adds +1 for more than 5 attendees', () => {
    const event = {
      summary: 'All-hands',
      attendees: Array(8).fill('person@co.com'),
      isRecurring: false,
    };
    expect(scoreEvent(event)).toBeGreaterThanOrEqual(3);
  });

  it('adds +1 for stress keywords in subject', () => {
    const event = {
      summary: 'Performance review with manager',
      attendees: ['manager@co.com'],
      isRecurring: false,
    };
    expect(scoreEvent(event)).toBeGreaterThanOrEqual(3);
  });

  it('subtracts -1 for recurring 1:1', () => {
    const event = {
      summary: '1:1 with Sarah',
      attendees: ['sarah@co.com'],
      isRecurring: true,
    };
    expect(scoreEvent(event)).toBe(1); // 2 base - 1 recurring 1:1
  });

  it('clamps to 1-5 range', () => {
    const highStress = {
      summary: 'Board performance review all-hands',
      attendees: Array(10).fill('person@co.com'),
      isRecurring: false,
    };
    expect(scoreEvent(highStress)).toBeLessThanOrEqual(5);

    const lowStress = {
      summary: 'Coffee chat',
      attendees: ['friend@co.com'],
      isRecurring: true,
    };
    expect(scoreEvent(lowStress)).toBeGreaterThanOrEqual(1);
  });

  it('handles empty attendees', () => {
    const event = { summary: 'Focus time', attendees: [], isRecurring: false };
    expect(scoreEvent(event)).toBe(2);
  });

  it('handles empty summary', () => {
    const event = { summary: '', attendees: ['a@b.com'], isRecurring: false };
    expect(scoreEvent(event)).toBe(2);
  });
});

describe('selectPillar', () => {
  it('returns connection for 1:1 meetings', () => {
    const event = { summary: '1:1 with Sarah', attendees: ['sarah@co.com'], isRecurring: true };
    expect(selectPillar(event)).toBe('connection');
  });

  it('returns awareness for large group meetings', () => {
    const event = { summary: 'Team meeting', attendees: Array(6).fill('p@co.com'), isRecurring: false };
    expect(selectPillar(event)).toBe('awareness');
  });

  it('returns connection for performance reviews', () => {
    const event = { summary: 'Performance review', attendees: ['mgr@co.com'], isRecurring: false };
    expect(selectPillar(event)).toBe('connection');
  });

  it('returns awareness as default', () => {
    const event = { summary: 'Something', attendees: ['a@b.com', 'c@d.com'], isRecurring: false };
    expect(selectPillar(event)).toBe('awareness');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/scoring.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement scoring**

```typescript
// lib/scoring.ts

export interface ScoringEvent {
  summary: string;
  attendees: string[];
  isRecurring: boolean;
}

const STRESS_KEYWORDS = [
  'review', 'performance', 'board', 'all-hands', 'allhands',
  'presentation', 'demo', 'interview', 'evaluation', 'assessment',
];

export function scoreEvent(event: ScoringEvent): number {
  let score = 2; // base

  // +1 for large group (> 5 attendees)
  if (event.attendees.length > 5) score += 1;

  // +1 for stress keywords in subject
  const lowerSummary = event.summary.toLowerCase();
  if (STRESS_KEYWORDS.some((kw) => lowerSummary.includes(kw))) score += 1;

  // -1 for recurring 1:1 (familiar, lower stress)
  if (event.isRecurring && event.attendees.length <= 2) score -= 1;

  // Clamp to 1-5
  return Math.max(1, Math.min(5, score));
}

type Pillar = 'awareness' | 'connection' | 'insight' | 'purpose';

export function selectPillar(event: ScoringEvent): Pillar {
  const lowerSummary = event.summary.toLowerCase();

  // Performance reviews, 1:1s → connection
  if (
    lowerSummary.includes('performance') ||
    lowerSummary.includes('review') ||
    lowerSummary.includes('1:1') ||
    lowerSummary.includes('1-on-1') ||
    (event.attendees.length <= 2 && event.isRecurring)
  ) {
    return 'connection';
  }

  // Large groups → awareness (grounding)
  if (event.attendees.length > 5) return 'awareness';

  // Brainstorm/creative → insight
  if (
    lowerSummary.includes('brainstorm') ||
    lowerSummary.includes('ideation') ||
    lowerSummary.includes('creative')
  ) {
    return 'insight';
  }

  // Default → awareness
  return 'awareness';
}

// Static fallback prompts when Claude API is unavailable (2 per pillar)
export const FALLBACK_PROMPTS: Record<Pillar, string[]> = {
  awareness: [
    'Take three slow breaths before you begin.',
    'Notice your feet on the floor. Notice your hands. You are here.',
  ],
  connection: [
    'What does the other person need from this conversation?',
    'How might they be feeling right now? What would help them?',
  ],
  insight: [
    'What assumptions are you bringing to this? Are they true?',
    'What would you notice if you watched this situation from the outside?',
  ],
  purpose: [
    'What matters most to you in this conversation?',
    'How does this connect to what you care about?',
  ],
};
```

**Step 4: Run tests**

Run: `npx vitest run lib/__tests__/scoring.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/scoring.ts lib/__tests__/scoring.test.ts
git commit -m "feat: add event scoring engine with pillar selection and fallback prompts (TDD)"
```

---

### Task 3: Companion Data Layer (Vercel KV helpers)

**Files:**
- Create: `lib/companion.ts`
- Create: `lib/__tests__/companion.test.ts`

**Step 1: Write types and KV helper functions**

This is the data access layer for the companion. All Vercel KV operations go through here.

```typescript
// lib/companion.ts
import { kv } from '@vercel/kv';

export interface CompanionEvent {
  id: string;
  userId: string;
  title: string;
  start: string; // ISO
  end: string;   // ISO
  attendees: string[];
  isRecurring: boolean;
  autoScore: number;       // heuristic score
  userStressScore?: number; // user annotation (1-5)
}

export interface CoachingRecord {
  id: string;
  eventId: string;
  pillar: 'awareness' | 'connection' | 'insight' | 'purpose';
  content: string;
  sentAt: string; // ISO
  channel: 'telegram' | 'webpush';
  responseScore?: number;  // 1-5 post-event
  responseText?: string;
}

export interface DailyIntention {
  userId: string;
  date: string; // YYYY-MM-DD
  intention: string;
}

// --- User registry ---

export async function registerUser(userId: string): Promise<void> {
  await kv.sadd('users:all', userId);
}

export async function getAllUserIds(): Promise<string[]> {
  return await kv.smembers('users:all') || [];
}

// --- Calendar tokens ---

export async function storeCalendarTokens(
  userId: string,
  tokens: { accessToken: string; refreshToken: string; expiresAt: number }
): Promise<void> {
  await kv.set(`calendar_tokens:${userId}`, JSON.stringify(tokens));
}

export async function getCalendarTokens(
  userId: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number } | null> {
  const raw = await kv.get(`calendar_tokens:${userId}`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw as any;
}

export async function markNeedsReconnect(userId: string): Promise<void> {
  await kv.set(`needs_reconnect:${userId}`, 'true');
}

export async function needsReconnect(userId: string): Promise<boolean> {
  return (await kv.get(`needs_reconnect:${userId}`)) === 'true';
}

export async function clearReconnect(userId: string): Promise<void> {
  await kv.del(`needs_reconnect:${userId}`);
}

// --- Events cache ---

export async function cacheEvents(userId: string, date: string, events: CompanionEvent[]): Promise<void> {
  await kv.set(`events:${userId}:${date}`, JSON.stringify(events), { ex: 86400 }); // 24h TTL
}

export async function getCachedEvents(userId: string, date: string): Promise<CompanionEvent[] | null> {
  const raw = await kv.get(`events:${userId}:${date}`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw as any;
}

// --- Coaching records ---

export async function storeCoaching(record: CoachingRecord): Promise<void> {
  await kv.set(`coaching:${record.eventId}`, JSON.stringify(record));
  // Also add to daily list for dashboard
  const dateKey = record.sentAt.split('T')[0];
  await kv.lpush(`coaching_list:${dateKey}`, JSON.stringify(record));
}

export async function getCoachingForEvent(eventId: string): Promise<CoachingRecord | null> {
  const raw = await kv.get(`coaching:${eventId}`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw as any;
}

export async function getDayCoachings(date: string): Promise<CoachingRecord[]> {
  const raw = await kv.lrange(`coaching_list:${date}`, 0, -1);
  if (!raw || raw.length === 0) return [];
  return raw.map((r: any) => typeof r === 'string' ? JSON.parse(r) : r);
}

// --- Reflections ---

export async function storeReflection(eventId: string, score: number, text?: string): Promise<void> {
  const coaching = await getCoachingForEvent(eventId);
  if (coaching) {
    coaching.responseScore = score;
    coaching.responseText = text;
    await kv.set(`coaching:${eventId}`, JSON.stringify(coaching));
  }
}

// --- Daily intention ---

export async function storeDailyIntention(userId: string, date: string, intention: string): Promise<void> {
  await kv.set(`intention:${userId}:${date}`, intention);
}

export async function getDailyIntention(userId: string, date: string): Promise<string | null> {
  return await kv.get(`intention:${userId}:${date}`);
}
```

**Step 2: Write basic tests**

Test the types and data structures. KV operations will be tested via integration tests with the API routes (mocking KV in unit tests is fragile and low-value).

```typescript
// lib/__tests__/companion.test.ts
import { describe, it, expect } from 'vitest';
import type { CompanionEvent, CoachingRecord } from '../companion';

describe('companion types', () => {
  it('CompanionEvent has required fields', () => {
    const event: CompanionEvent = {
      id: 'evt_1',
      userId: 'user_1',
      title: 'Board meeting',
      start: '2026-03-27T13:00:00Z',
      end: '2026-03-27T14:00:00Z',
      attendees: ['a@b.com'],
      isRecurring: false,
      autoScore: 4,
    };
    expect(event.autoScore).toBe(4);
    expect(event.userStressScore).toBeUndefined();
  });

  it('CoachingRecord tracks pillar and response', () => {
    const record: CoachingRecord = {
      id: 'coach_1',
      eventId: 'evt_1',
      pillar: 'connection',
      content: 'What does the board need from you?',
      sentAt: '2026-03-27T12:45:00Z',
      channel: 'telegram',
      responseScore: 4,
    };
    expect(record.pillar).toBe('connection');
    expect(record.responseScore).toBe(4);
  });
});
```

**Step 3: Run tests**

Run: `npx vitest run lib/__tests__/companion.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add lib/companion.ts lib/__tests__/companion.test.ts
git commit -m "feat: add companion data layer with Vercel KV helpers"
```

---

### Task 4: NextAuth + Google Calendar OAuth

**Files:**
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `lib/google-calendar.ts`

**Step 1: Create NextAuth route with Google provider**

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { storeCalendarTokens, registerUser, clearReconnect } from '@/lib/companion';

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          scope: [
            'https://www.googleapis.com/auth/calendar.readonly',
            'openid',
            'email',
            'profile',
          ].join(' '),
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account && token.sub) {
        await storeCalendarTokens(token.sub, {
          accessToken: account.access_token!,
          refreshToken: account.refresh_token!,
          expiresAt: account.expires_at || 0,
        });
        await registerUser(token.sub);
        await clearReconnect(token.sub);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
```

**Step 2: Create Google Calendar client helper**

```typescript
// lib/google-calendar.ts
import { google } from 'googleapis';
import { getCalendarTokens, storeCalendarTokens, markNeedsReconnect } from './companion';

export async function getCalendarClient(userId: string) {
  const tokens = await getCalendarTokens(userId);
  if (!tokens) throw new Error('No calendar tokens found');

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });

  // Auto-refresh if expired
  if (tokens.expiresAt * 1000 < Date.now()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      await storeCalendarTokens(userId, {
        accessToken: credentials.access_token!,
        refreshToken: credentials.refresh_token || tokens.refreshToken,
        expiresAt: Math.floor((credentials.expiry_date || 0) / 1000),
      });
    } catch {
      await markNeedsReconnect(userId);
      throw new Error('Calendar token refresh failed');
    }
  }

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function getTodayEvents(userId: string) {
  const calendar = await getCalendarClient(userId);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (response.data.items || []).map((item) => ({
    id: item.id || '',
    title: item.summary || '',
    start: item.start?.dateTime || item.start?.date || '',
    end: item.end?.dateTime || item.end?.date || '',
    attendees: (item.attendees || []).map((a) => a.email || ''),
    isRecurring: !!item.recurringEventId,
  }));
}
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds (NextAuth route compiles, google-calendar module compiles)

**Step 4: Commit**

```bash
git add app/api/auth/ lib/google-calendar.ts
git commit -m "feat: add NextAuth Google OAuth + Calendar API client with token refresh"
```

---

### Task 5: Notification Dispatch (Telegram + Web Push)

**Files:**
- Create: `lib/notifications.ts`

**Step 1: Implement Telegram and web push dispatch**

```typescript
// lib/notifications.ts

export interface NotificationPayload {
  title: string;
  body: string;
  pillar: 'awareness' | 'connection' | 'insight' | 'purpose';
  practiceUrl?: string; // optional deep link to grounding practice
}

const PILLAR_EMOJI: Record<string, string> = {
  awareness: '🔵',
  connection: '🌹',
  insight: '🟣',
  purpose: '🟡',
};

export async function sendTelegram(payload: NotificationPayload): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const emoji = PILLAR_EMOJI[payload.pillar];
  let text = `*${payload.title}*\n${emoji} _${payload.body}_`;
  if (payload.practiceUrl) {
    text += `\n\n→ [60 seconds of grounding](${payload.practiceUrl})`;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendReflectionRequest(eventTitle: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const text = `How did *${eventTitle}* go?\nReply with a number 1-5.`;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}
```

**Step 2: Commit**

```bash
git add lib/notifications.ts
git commit -m "feat: add Telegram notification dispatch with pillar emoji formatting"
```

---

### Task 6: Coaching Prompt Generation

**Files:**
- Create: `lib/coaching.ts`

**Step 1: Implement prompt generation via Claude API**

```typescript
// lib/coaching.ts
import Anthropic from '@anthropic-ai/sdk';
import { FALLBACK_PROMPTS } from './scoring';

const client = new Anthropic();

type Pillar = 'awareness' | 'connection' | 'insight' | 'purpose';

export async function generateCoachingPrompt(
  eventTitle: string,
  pillar: Pillar,
  attendees: string[],
  dailyIntention?: string
): Promise<string> {
  try {
    const attendeeContext = attendees.length > 0
      ? `Attendees: ${attendees.slice(0, 3).map(e => e.split('@')[0]).join(', ')}${attendees.length > 3 ? ` and ${attendees.length - 3} others` : ''}.`
      : '';

    const intentionContext = dailyIntention
      ? `Their daily intention is: "${dailyIntention}".`
      : '';

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      system: `You are a gentle mindfulness coach. Generate ONE sentence of coaching for someone about to enter a meeting. Focus on the ${pillar} pillar of well-being. Be warm, specific to their situation, and non-judgmental. No greeting, no sign-off. Just the coaching sentence. Maximum 25 words.`,
      messages: [
        {
          role: 'user',
          content: `Meeting: "${eventTitle}" in 15 minutes. ${attendeeContext} ${intentionContext} Give me one ${pillar}-focused coaching sentence.`,
        },
      ],
    });

    const text = response.content[0];
    if (text.type === 'text' && text.text.trim()) {
      return text.text.trim();
    }

    return getRandomFallback(pillar);
  } catch {
    return getRandomFallback(pillar);
  }
}

function getRandomFallback(pillar: Pillar): string {
  const prompts = FALLBACK_PROMPTS[pillar];
  return prompts[Math.floor(Math.random() * prompts.length)];
}
```

**Step 2: Commit**

```bash
git add lib/coaching.ts
git commit -m "feat: add coaching prompt generation via Claude API with static fallbacks"
```

---

### Task 7: Cron Pipeline (the brain)

**Files:**
- Create: `app/api/cron/companion/route.ts`

**Step 1: Implement the cron handler**

This is the orchestrator. Every 5 minutes it: fetches events, scores them, sends coaching for upcoming high-stress events, and sends reflection requests for recently ended events.

```typescript
// app/api/cron/companion/route.ts
import { NextResponse } from 'next/server';
import { getAllUserIds, getCoachingForEvent, storeCoaching, getDailyIntention, needsReconnect } from '@/lib/companion';
import { getTodayEvents } from '@/lib/google-calendar';
import { scoreEvent, selectPillar } from '@/lib/scoring';
import { generateCoachingPrompt } from '@/lib/coaching';
import { sendTelegram, sendReflectionRequest } from '@/lib/notifications';

export async function GET(request: Request) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userIds = await getAllUserIds();
    const results = [];

    for (const userId of userIds) {
      // Skip users who need to reconnect calendar
      if (await needsReconnect(userId)) {
        results.push({ userId, status: 'needs_reconnect' });
        continue;
      }

      try {
        const rawEvents = await getTodayEvents(userId);
        const now = Date.now();
        const lookAheadMs = 30 * 60 * 1000; // 30 minutes
        const lookBackMs = 10 * 60 * 1000;  // 10 minutes (for reflections)

        const intention = await getDailyIntention(
          userId,
          new Date().toISOString().split('T')[0]
        );

        // --- Pre-meeting coaching ---
        const upcomingEvents = rawEvents.filter((e) => {
          const start = new Date(e.start).getTime();
          return start > now && start <= now + lookAheadMs;
        });

        const coachingPromises = upcomingEvents.map(async (event) => {
          const scoringEvent = {
            summary: event.title,
            attendees: event.attendees,
            isRecurring: event.isRecurring,
          };
          const score = scoreEvent(scoringEvent);
          if (score < 3) return null;

          // Dedup check
          const existing = await getCoachingForEvent(event.id);
          if (existing) return null;

          const pillar = selectPillar(scoringEvent);
          const content = await generateCoachingPrompt(
            event.title,
            pillar,
            event.attendees,
            intention || undefined
          );

          const sent = await sendTelegram({
            title: `${event.title} in 15 min`,
            body: content,
            pillar,
            practiceUrl: `${process.env.NEXTAUTH_URL}/companion?practice=${event.id}`,
          });

          if (sent) {
            const record = {
              id: `coach_${event.id}_${Date.now()}`,
              eventId: event.id,
              pillar,
              content,
              sentAt: new Date().toISOString(),
              channel: 'telegram' as const,
            };
            await storeCoaching(record);
            return record;
          }
          return null;
        });

        // Parallel Claude API calls
        const coachingResults = await Promise.all(coachingPromises);

        // --- Post-event reflections ---
        const recentlyEnded = rawEvents.filter((e) => {
          const end = new Date(e.end).getTime();
          return end < now && end >= now - lookBackMs;
        });

        for (const event of recentlyEnded) {
          const coaching = await getCoachingForEvent(event.id);
          if (coaching && !coaching.responseScore) {
            await sendReflectionRequest(event.title);
          }
        }

        results.push({
          userId,
          status: 'ok',
          coached: coachingResults.filter(Boolean).length,
          reflections: recentlyEnded.length,
        });
      } catch (err) {
        results.push({ userId, status: 'error', message: String(err) });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

**Step 2: Add cron config to vercel.json**

Create `vercel.json` (if it doesn't exist) or add to it:

```json
{
  "crons": [
    {
      "path": "/api/cron/companion",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add app/api/cron/companion/route.ts vercel.json
git commit -m "feat: add cron pipeline for coaching dispatch and post-event reflections"
```

---

### Task 8: Calendar Events API Route

**Files:**
- Create: `app/api/calendar/events/route.ts`

**Step 1: Create the events endpoint**

```typescript
// app/api/calendar/events/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getTodayEvents } from '@/lib/google-calendar';
import { scoreEvent, selectPillar } from '@/lib/scoring';
import { getCoachingForEvent, getCachedEvents, cacheEvents, needsReconnect } from '@/lib/companion';

export async function GET() {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return NextResponse.json({ error: 'No user ID' }, { status: 401 });
  }

  // Check if needs reconnect
  if (await needsReconnect(userId)) {
    return NextResponse.json({ error: 'needs_reconnect' }, { status: 403 });
  }

  const today = new Date().toISOString().split('T')[0];

  try {
    const rawEvents = await getTodayEvents(userId);

    // Score each event and attach coaching data
    const events = await Promise.all(
      rawEvents.map(async (event) => {
        const scoringEvent = {
          summary: event.title,
          attendees: event.attendees,
          isRecurring: event.isRecurring,
        };
        const autoScore = scoreEvent(scoringEvent);
        const pillar = selectPillar(scoringEvent);
        const coaching = await getCoachingForEvent(event.id);

        return {
          ...event,
          autoScore,
          pillar,
          coaching: coaching
            ? {
                content: coaching.content,
                pillar: coaching.pillar,
                sentAt: coaching.sentAt,
                responseScore: coaching.responseScore,
              }
            : null,
        };
      })
    );

    // Cache for dashboard
    await cacheEvents(userId, today, events as any);

    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/calendar/events/route.ts
git commit -m "feat: add calendar events API with scoring and coaching data"
```

---

### Task 9: Telegram Webhook for Reflections

**Files:**
- Create: `app/api/telegram/webhook/route.ts`

**Step 1: Implement webhook handler**

```typescript
// app/api/telegram/webhook/route.ts
import { NextResponse } from 'next/server';
import { getDayCoachings, storeReflection } from '@/lib/companion';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body?.message;
    if (!message?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(message.chat?.id);
    const expectedChatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId !== expectedChatId) {
      return NextResponse.json({ ok: true }); // Ignore messages from other chats
    }

    // Check if the reply is a number 1-5
    const score = parseInt(message.text.trim(), 10);
    if (isNaN(score) || score < 1 || score > 5) {
      return NextResponse.json({ ok: true }); // Not a reflection reply
    }

    // Find the most recent coached event that doesn't have a reflection yet
    const today = new Date().toISOString().split('T')[0];
    const coachings = await getDayCoachings(today);
    const unreflected = coachings.find((c) => !c.responseScore);

    if (unreflected) {
      await storeReflection(unreflected.eventId, score);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Never fail the webhook
  }
}
```

**Step 2: Commit**

```bash
git add app/api/telegram/webhook/route.ts
git commit -m "feat: add Telegram webhook for post-event reflection scores"
```

---

### Task 10: Navigation Toggle (Chat | Companion)

**Files:**
- Create: `components/NavToggle.tsx`
- Modify: `app/layout.tsx` — add NavToggle

**Step 1: Create the navigation toggle**

```typescript
// components/NavToggle.tsx
"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function NavToggle() {
  const pathname = usePathname();
  const isCompanion = pathname?.startsWith('/companion');

  return (
    <div className="flex items-center justify-center gap-1 py-3 border-b border-warm-gray-light">
      <Link
        href="/"
        className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
          !isCompanion
            ? 'text-sage border-b-2 border-sage'
            : 'text-muted hover:text-foreground'
        }`}
      >
        Chat
      </Link>
      <Link
        href="/companion"
        className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
          isCompanion
            ? 'text-sage border-b-2 border-sage'
            : 'text-muted hover:text-foreground'
        }`}
      >
        Companion
      </Link>
    </div>
  );
}
```

**Step 2: Add to layout.tsx**

Read `app/layout.tsx`, then add `<NavToggle />` inside the body, above `{children}`.

**Step 3: Verify build**

Run: `npm run build`

**Step 4: Commit**

```bash
git add components/NavToggle.tsx app/layout.tsx
git commit -m "feat: add Chat | Companion navigation toggle to layout"
```

---

### Task 11: Companion Dashboard Page

**Files:**
- Create: `app/companion/page.tsx`
- Create: `components/TimelineRow.tsx`
- Create: `components/StressIndicator.tsx`
- Create: `components/ACIPBar.tsx`

**Step 1: Create the sub-components**

**StressIndicator** — reuses the SelfReport dot pattern:
```typescript
// components/StressIndicator.tsx
"use client";

interface StressIndicatorProps {
  score: number; // 1-5
  size?: number;
}

export default function StressIndicator({ score, size = 8 }: StressIndicatorProps) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((level) => (
        <div
          key={level}
          className="rounded-full transition-all"
          style={{
            width: size,
            height: size,
            backgroundColor: level <= score ? 'var(--sage)' : 'transparent',
            border: '1.5px solid var(--sage)',
            opacity: level <= score ? 0.5 + (level / 5) * 0.5 : 0.2,
          }}
        />
      ))}
    </div>
  );
}
```

**TimelineRow** — a single event in the timeline:
```typescript
// components/TimelineRow.tsx
"use client";

import StressIndicator from './StressIndicator';

interface TimelineRowProps {
  time: string;
  title: string;
  stressScore: number;
  isPast: boolean;
  coaching?: {
    content: string;
    pillar: string;
    responseScore?: number;
  } | null;
}

export default function TimelineRow({
  time,
  title,
  stressScore,
  isPast,
  coaching,
}: TimelineRowProps) {
  return (
    <div
      className={`flex items-start gap-4 py-3 px-2 transition-opacity ${
        isPast ? 'opacity-50' : 'opacity-100'
      }`}
    >
      <span className="text-xs text-muted w-12 shrink-0 pt-0.5">{time}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <span className="text-sm text-foreground truncate">{title}</span>
          <StressIndicator score={stressScore} />
        </div>
        {coaching && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-sage shrink-0" />
            <span className="text-xs text-muted italic truncate">
              {coaching.content}
            </span>
            {coaching.responseScore && (
              <span className="text-xs text-sage shrink-0">
                {coaching.responseScore}/5
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

**ACIPBar** — horizontal pillar coverage bar:
```typescript
// components/ACIPBar.tsx
"use client";

const PILLAR_COLORS: Record<string, string> = {
  awareness: 'rgb(147, 197, 222)',
  connection: 'rgb(210, 150, 150)',
  insight: 'rgb(170, 150, 200)',
  purpose: 'rgb(200, 170, 110)',
};

interface ACIPBarProps {
  counts: Record<string, number>; // pillar -> count of coaching events
}

export default function ACIPBar({ counts }: ACIPBarProps) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return (
      <div
        className="h-2 rounded-full bg-warm-gray-light"
        aria-label="No pillar data yet"
      />
    );
  }

  return (
    <div
      className="flex h-2 rounded-full overflow-hidden"
      role="img"
      aria-label={Object.entries(counts)
        .map(([p, c]) => `${Math.round((c / total) * 100)}% ${p}`)
        .join(', ')}
    >
      {Object.entries(PILLAR_COLORS).map(([pillar, color]) => {
        const count = counts[pillar] || 0;
        if (count === 0) return null;
        return (
          <div
            key={pillar}
            style={{
              width: `${(count / total) * 100}%`,
              backgroundColor: color,
            }}
          />
        );
      })}
    </div>
  );
}
```

**Step 2: Create the main companion page**

```typescript
// app/companion/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';
import TimelineRow from '@/components/TimelineRow';
import ACIPBar from '@/components/ACIPBar';
import SelfReport from '@/components/SelfReport';
import PillarTint from '@/components/PillarTint';

export default function CompanionPage() {
  const { data: session, status } = useSession();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const nowLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchEvents();
    } else {
      setLoading(false);
    }
  }, [status]);

  // Auto-scroll to now line
  useEffect(() => {
    if (nowLineRef.current) {
      nowLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [events]);

  async function fetchEvents() {
    try {
      const res = await fetch('/api/calendar/events');
      if (res.status === 403) {
        setError('needs_reconnect');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      setError('Calendar sync failed');
    } finally {
      setLoading(false);
    }
  }

  const now = new Date();
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  // ACIP counts from coaching data
  const acipCounts: Record<string, number> = { awareness: 0, connection: 0, insight: 0, purpose: 0 };
  events.forEach((e) => {
    if (e.coaching?.pillar) {
      acipCounts[e.coaching.pillar] = (acipCounts[e.coaching.pillar] || 0) + 1;
    }
  });

  // Not logged in
  if (status === 'unauthenticated') {
    return (
      <>
        <PillarTint tint="neutral" />
        <div className="flex flex-1 flex-col items-center justify-center px-6 gap-6">
          <p className="text-lg text-center" style={{ fontFamily: 'var(--font-source-serif), Georgia, serif' }}>
            Connect your calendar to begin.
          </p>
          <button
            onClick={() => signIn('google')}
            className="px-6 py-2.5 rounded-full bg-sage text-white text-sm hover:bg-sage/90 transition-colors"
          >
            Connect Google Calendar
          </button>
        </div>
      </>
    );
  }

  // Loading
  if (loading) {
    return (
      <>
        <PillarTint tint="neutral" />
        <div className="flex flex-1 flex-col max-w-2xl mx-auto w-full px-6 py-6 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-warm-gray-light animate-pulse" />
          ))}
        </div>
      </>
    );
  }

  // Needs reconnect
  if (error === 'needs_reconnect') {
    return (
      <>
        <PillarTint tint="neutral" />
        <div className="flex flex-1 flex-col items-center justify-center px-6 gap-6">
          <p className="text-lg text-center" style={{ fontFamily: 'var(--font-source-serif), Georgia, serif' }}>
            Your calendar connection needs to be refreshed.
          </p>
          <button
            onClick={() => signIn('google')}
            className="px-6 py-2.5 rounded-full bg-sage text-white text-sm hover:bg-sage/90 transition-colors"
          >
            Reconnect Calendar
          </button>
        </div>
      </>
    );
  }

  // No events (rest day)
  if (events.length === 0) {
    return (
      <>
        <PillarTint tint="neutral" />
        <SelfReport onChange={() => {}} />
        <div className="flex flex-1 flex-col items-center justify-center px-6 gap-6">
          <p className="text-2xl" style={{ fontFamily: 'var(--font-source-serif), Georgia, serif' }}>
            🌿
          </p>
          <p className="text-lg text-center text-muted" style={{ fontFamily: 'var(--font-source-serif), Georgia, serif' }}>
            No meetings today. Rest day.
          </p>
        </div>
      </>
    );
  }

  // Main dashboard
  return (
    <>
      <PillarTint tint="neutral" />
      <SelfReport onChange={() => {}} />
      <div className="flex flex-1 flex-col max-w-2xl mx-auto w-full">
        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {events.map((event, i) => {
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);
            const isPast = eventEnd < now;

            // Insert "now" line
            const nextEvent = events[i + 1];
            const showNowLine =
              isPast &&
              nextEvent &&
              new Date(nextEvent.start) > now;

            return (
              <div key={event.id}>
                <TimelineRow
                  time={formatTime(event.start)}
                  title={event.title}
                  stressScore={event.autoScore}
                  isPast={isPast}
                  coaching={event.coaching}
                />
                {showNowLine && (
                  <div
                    ref={nowLineRef}
                    className="flex items-center gap-2 my-2"
                  >
                    <div className="w-2 h-2 rounded-full bg-sage" />
                    <div className="flex-1 h-px bg-sage/40" />
                    <span className="text-xs text-sage">now</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ACIP bar */}
        <div className="px-6 py-4 border-t border-warm-gray-light">
          <ACIPBar counts={acipCounts} />
        </div>
      </div>
    </>
  );
}
```

**Step 3: Wrap companion layout with SessionProvider**

Create `app/companion/layout.tsx`:
```typescript
"use client";

import { SessionProvider } from 'next-auth/react';

export default function CompanionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

**Step 4: Verify build**

Run: `npm run build`

**Step 5: Commit**

```bash
git add components/StressIndicator.tsx components/TimelineRow.tsx components/ACIPBar.tsx app/companion/page.tsx app/companion/layout.tsx
git commit -m "feat: add companion dashboard with timeline, stress indicators, ACIP bar, and auth flow"
```

---

### Task 12: Build Verification + Manual Test

**Files:**
- All modified files

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run build**

Run: `npm run build`
Expected: Clean build

**Step 3: Push**

```bash
git push origin main
```

**Step 4: Manual test checklist (for the user)**

1. Visit `/companion` → should see "Connect Google Calendar" button
2. Click connect → Google OAuth flow → returns to `/companion` with calendar data
3. Timeline shows today's events with stress dots
4. Past events are faded, "now" line visible
5. ACIP bar at bottom shows pillar coverage
6. Presence dots (SelfReport) visible bottom-left
7. Chat | Companion toggle works in both directions
8. Visit `/` → chat app still works normally
