# Multi-User Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Mindful AI multi-user: accounts, persistent chat history, per-user data, ACIP-structured cross-session memory, Telegram deep-link onboarding.

**Architecture:** Neon Postgres (via Prisma) for all persistent data. Vercel AI SDK replaces raw Anthropic SDK for chat streaming + persistence hooks. NextAuth with Prisma adapter for auth. Upstash KV kept only for cron state and rate limiting.

**Tech Stack:** Next.js 16, Prisma + Neon Postgres, NextAuth + @auth/prisma-adapter, Vercel AI SDK (ai + @ai-sdk/react + @ai-sdk/anthropic), Upstash KV (cache only)

**Design doc:** ~/.gstack/projects/adamjdavidson-mindful_ai/adamdavidson-main-design-20260327-163304.md

---

### Task 1: Add Neon Postgres + Prisma

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/db.ts`
- Modify: `package.json` (add dependencies)
- Modify: `.env.local` (add DATABASE_URL)

**Step 1: Install dependencies**

Run: `npm install @prisma/client @auth/prisma-adapter ai @ai-sdk/react @ai-sdk/anthropic`
Run: `npm install -D prisma`

**Step 2: Initialize Prisma**

Run: `npx prisma init`

This creates `prisma/schema.prisma` and adds DATABASE_URL to `.env`.

**Step 3: Write the schema**

Replace `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model User {
  id              String    @id @default(cuid())
  name            String?
  email           String?   @unique
  emailVerified   DateTime?
  image           String?
  role            String    @default("user")
  telegramChatId  String?
  accounts        Account[]
  sessions        Session[]
  chatSessions    ChatSession[]
  companionProfile CompanionProfile?
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model ChatSession {
  id           String       @id @default(cuid())
  userId       String
  intention    String?
  startedAt    DateTime     @default(now())
  endedAt      DateTime?
  pillarScores Json?
  summary      String?      @db.Text
  messages     Message[]
  selfReports  SelfReport[]
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Message {
  id            String      @id @default(cuid())
  chatSessionId String
  role          String
  content       String      @db.Text
  createdAt     DateTime    @default(now())
  pillar        String?
  chatSession   ChatSession @relation(fields: [chatSessionId], references: [id], onDelete: Cascade)
}

model SelfReport {
  id            String      @id @default(cuid())
  chatSessionId String
  score         Int
  createdAt     DateTime    @default(now())
  chatSession   ChatSession @relation(fields: [chatSessionId], references: [id], onDelete: Cascade)
}

model CompanionProfile {
  id               String  @id @default(cuid())
  userId           String  @unique
  eventAnnotations Json?
  dailyIntention   String?
  user             User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Step 4: Create Prisma client singleton**

Create `lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Step 5: Add DATABASE_URL to .env.local**

The user needs to add Neon Postgres via Vercel dashboard first. Then add the DATABASE_URL to .env.local.

**Step 6: Run migration**

Run: `npx prisma migrate dev --name init`
Expected: Migration creates all tables.

Run: `npx prisma generate`
Expected: Prisma client generated.

**Step 7: Commit**

```bash
git add prisma/ lib/db.ts package.json package-lock.json
git commit -m "feat: add Prisma schema with multi-user models"
```

---

### Task 2: Wire NextAuth to Prisma Adapter

**Files:**
- Modify: `app/api/auth/[...nextauth]/route.ts`
- Delete logic from: `lib/companion.ts` (storeCalendarTokens, registerUser, clearReconnect — Prisma adapter handles this now)

**Step 1: Update NextAuth config**

Replace `app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth, { type AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        (session.user as { id?: string }).id = user.id;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

Note: With the Prisma adapter, NextAuth automatically stores access_token and refresh_token in the Account table. No manual KV storage needed.

**Step 2: Commit**

```bash
git add app/api/auth/
git commit -m "feat: wire NextAuth to Prisma adapter"
```

---

### Task 3: Add Login Page + Route Protection

**Files:**
- Create: `app/login/page.tsx`
- Create: `middleware.ts` (root level, protects all routes except /login and /api/auth)
- Modify: `app/layout.tsx` (add SessionProvider)

**Step 1: Create login page**

Create `app/login/page.tsx` — a simple page with the Mindful AI branding and a "Sign in with Google" button. Use the existing warm stone palette. Include a small breathing circle animation as the page background (reuse BreathingCircle component). Keep it minimal and calm.

**Step 2: Create middleware**

Create `middleware.ts` at the project root:

```typescript
export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/((?!login|api/auth|api/telegram/webhook|_next|favicon.ico).*)",
  ],
};
```

This protects all routes except /login, /api/auth (NextAuth), /api/telegram/webhook (needs to receive messages from Telegram), and static assets.

**Step 3: Add SessionProvider to layout**

Wrap the app in NextAuth's SessionProvider in `app/layout.tsx`. Create a client component wrapper since SessionProvider needs "use client".

**Step 4: Test**

Run: `npm run dev`
Navigate to http://localhost:3000 — should redirect to /login.
Sign in with Google — should redirect to the chat app.

**Step 5: Commit**

```bash
git add app/login/ middleware.ts app/layout.tsx
git commit -m "feat: add login page and route protection"
```

---

### Task 4: Migrate Chat to Vercel AI SDK + Postgres Persistence

**Files:**
- Modify: `app/api/chat/route.ts` (replace raw Anthropic SDK with AI SDK streamText)
- Modify: `components/ChatInterface.tsx` (could use useChat, but existing component works — just need to save messages)
- Create: `lib/chat-persistence.ts` (save/load functions)
- Modify: `app/page.tsx` (add session ID, save on end)

**Step 1: Create chat persistence helpers**

Create `lib/chat-persistence.ts`:

```typescript
import { prisma } from "./db";

export async function createChatSession(userId: string, intention?: string) {
  return prisma.chatSession.create({
    data: { userId, intention },
  });
}

export async function saveMessages(
  chatSessionId: string,
  messages: { role: string; content: string; pillar?: string }[]
) {
  await prisma.message.createMany({
    data: messages.map((m) => ({
      chatSessionId,
      role: m.role,
      content: m.content,
      pillar: m.pillar || null,
    })),
  });
}

export async function endChatSession(
  chatSessionId: string,
  summary: string,
  pillarScores: Record<string, number>
) {
  await prisma.chatSession.update({
    where: { id: chatSessionId },
    data: {
      endedAt: new Date(),
      summary,
      pillarScores,
    },
  });
}

export async function getRecentSummaries(userId: string, count = 5) {
  const sessions = await prisma.chatSession.findMany({
    where: { userId, summary: { not: null } },
    orderBy: { startedAt: "desc" },
    take: count,
    select: { summary: true, intention: true, startedAt: true, pillarScores: true },
  });
  return sessions;
}

export async function saveSelfReport(chatSessionId: string, score: number) {
  await prisma.selfReport.create({
    data: { chatSessionId, score },
  });
}
```

**Step 2: Update chat API route**

Modify `app/api/chat/route.ts` to:
1. Get the user session via `getServerSession(authOptions)`
2. Accept a `chatSessionId` in the request body
3. Use AI SDK `streamText` with `@ai-sdk/anthropic` provider
4. In the `onFinish` callback, save messages to Postgres
5. Include recent session summaries in the system prompt

**Step 3: Update page.tsx**

Modify `app/page.tsx` to:
1. Create a ChatSession in Postgres when the conversation phase starts (after intention is set)
2. Pass the chatSessionId to the chat API
3. On session end, call an API to generate the ACIP summary and close the session

**Step 4: Create summary generation endpoint**

Create `app/api/chat/summarize/route.ts`:
- Accepts chatSessionId
- Loads all messages for that session from Postgres
- Calls Claude with the ACIP summarization prompt
- Stores the summary on the ChatSession record

**Step 5: Test**

Run: `npm run dev`
1. Sign in
2. Go through arrival → intention → conversation → end session
3. Check Postgres (via `npx prisma studio`) — messages and summary should be stored
4. Start a new session — system prompt should include the previous session's summary

**Step 6: Commit**

```bash
git add lib/chat-persistence.ts app/api/chat/ app/page.tsx
git commit -m "feat: persist chat messages to Postgres with ACIP summaries"
```

---

### Task 5: Migrate Companion to Postgres

**Files:**
- Modify: `lib/companion.ts` (replace KV calls with Prisma queries)
- Modify: `app/api/calendar/events/route.ts` (read tokens from Account table)
- Modify: `app/api/chat/route.ts` (if companion-related)
- Modify: `app/companion/page.tsx` (add user context)

**Step 1: Update calendar events API**

The calendar tokens (access_token, refresh_token) are now in the Account table (stored by NextAuth Prisma adapter). Update `app/api/calendar/events/route.ts` to:
1. Get user session
2. Query `prisma.account.findFirst({ where: { userId, provider: "google" } })`
3. Use the access_token and refresh_token from there
4. Handle token refresh (update the Account record if token is refreshed)

**Step 2: Update companion data layer**

Replace KV calls in `lib/companion.ts` with Prisma queries:
- `getCompanionProfile` → `prisma.companionProfile.findUnique({ where: { userId } })`
- `saveEventAnnotation` → `prisma.companionProfile.upsert(...)`
- `saveDailyIntention` → same upsert pattern

**Step 3: Update companion page**

Add user context to `app/companion/page.tsx` — get session, pass userId to API calls.

**Step 4: Test**

1. Sign in → navigate to /companion
2. Calendar events should load
3. Annotate events, set intention — data should persist in Postgres

**Step 5: Commit**

```bash
git add lib/companion.ts app/api/calendar/ app/companion/
git commit -m "feat: migrate companion data layer to Postgres"
```

---

### Task 6: Telegram Deep-Link Connection

**Files:**
- Create: `app/api/telegram/webhook/route.ts`
- Create: `app/settings/page.tsx`
- Modify: `lib/companion.ts` (add Telegram helpers)

**Step 1: Create Telegram webhook endpoint**

Create `app/api/telegram/webhook/route.ts`:

```typescript
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json();
  const message = body.message;
  if (!message) return new Response("OK");

  const text = message.text || "";
  const chatId = String(message.chat.id);

  // Handle /start with userId deep link
  if (text.startsWith("/start ")) {
    const userId = text.replace("/start ", "").trim();

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      await sendTelegramMessage(chatId, "Invalid link. Please try again from the app settings.");
      return new Response("OK");
    }

    // Store telegram chat ID
    await prisma.user.update({
      where: { id: userId },
      data: { telegramChatId: chatId },
    });

    await sendTelegramMessage(chatId,
      "Connected! You'll receive mindful coaching prompts here. 🌿"
    );
    return new Response("OK");
  }

  // Handle reflection replies (numbers 1-5)
  const score = parseInt(text);
  if (score >= 1 && score <= 5) {
    // Find user by telegram chat ID
    const user = await prisma.user.findFirst({ where: { telegramChatId: chatId } });
    if (user) {
      // Store as companion reflection — implementation depends on companion schema
      await sendTelegramMessage(chatId, `Noted: ${score}/5. Thank you for reflecting. 🙏`);
    }
    return new Response("OK");
  }

  return new Response("OK");
}

async function sendTelegramMessage(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}
```

**Step 2: Register webhook with Telegram**

After deploying, run (one-time):
```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://aimindful.vercel.app/api/telegram/webhook"}'
```

**Step 3: Create settings page**

Create `app/settings/page.tsx`:
- Shows user info (name, email, avatar from Google)
- Shows "Connect Telegram" button with deep link: `https://t.me/y_mingyur_bot?start={userId}`
- If already connected, shows "Telegram connected ✓"
- Feature tour toggle (already exists in gear menu, move here)

**Step 4: Test**

1. Sign in → go to Settings
2. Click "Connect Telegram"
3. Opens Telegram with the bot
4. Tap Start
5. Bot says "Connected!"
6. Settings page shows "Telegram connected ✓"

**Step 5: Commit**

```bash
git add app/api/telegram/ app/settings/
git commit -m "feat: add Telegram deep-link connection flow"
```

---

### Task 7: Update Cron Pipeline for Multi-User

**Files:**
- Modify: `app/api/cron/companion/route.ts`

**Step 1: Update cron to iterate over all users**

The cron job currently runs for a single hardcoded user. Update it to:
1. Query all users who have a telegramChatId set
2. For each user, get their calendar events
3. Generate coaching prompts
4. Send via Telegram

**Step 2: Commit**

```bash
git add app/api/cron/
git commit -m "feat: update cron pipeline for multi-user"
```

---

### Task 8: Session History Sidebar

**Files:**
- Create: `components/SessionSidebar.tsx`
- Modify: `app/page.tsx` (add sidebar toggle)

**Step 1: Create sidebar component**

A collapsible sidebar that shows past chat sessions for the current user:
- List of sessions with date, intention (truncated), and pillar coverage dots
- Click to view past messages (read-only)
- Current session highlighted

**Step 2: Wire to page.tsx**

Add a small icon button (top-left, like a clock or list icon) that toggles the sidebar.

**Step 3: Commit**

```bash
git add components/SessionSidebar.tsx app/page.tsx
git commit -m "feat: add session history sidebar"
```

---

### Task 9: Build Verification + Deploy

**Files:**
- Modify: `.env.local` (verify all vars present)

**Step 1: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 2: Run tests**

Run: `npx vitest run`
Expected: All existing tests pass.

**Step 3: Commit all changes**

```bash
git add -A
git commit -m "feat: multi-user infrastructure with Postgres, ACIP memory, Telegram"
```

**Step 4: Push and deploy**

```bash
git push origin main
```

Vercel auto-deploys from main. After deploy:
1. Run Prisma migration on production: add DATABASE_URL to Vercel env vars, run `npx prisma migrate deploy`
2. Register Telegram webhook with production URL
3. Test with 2 different Google accounts to verify data isolation

---

## Environment Variables Needed on Vercel

```
# Existing
ANTHROPIC_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_URL=https://aimindful.vercel.app
NEXTAUTH_SECRET=...
CRON_SECRET=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
TELEGRAM_BOT_TOKEN=...

# New
DATABASE_URL=...  (from Neon Postgres via Vercel dashboard)
```
