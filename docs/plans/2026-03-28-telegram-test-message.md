# Telegram Test Message Feature

## Goal

After connecting Telegram, send a real coaching prompt (or warm fallback) so the user immediately sees what the product does. Also add a "Send test message" button in settings for re-testing anytime.

## Design

### On-Connect (webhook)

When `/start {userId}` links the account, replace the generic welcome with:

1. Fetch today's events via `getTodayEvents(userId)`
2. Find the next upcoming event (soonest event with start time > now)
3. Run full personalized pipeline: `scoreEventPersonalized` + `generateCoachingPrompt` with ACIP profile, summaries, intention, calendar density
4. Send via `sendCoachingPrompt(chatId, eventTitle, coachingContent)`
5. On any failure (no events, calendar error, Claude error): send fallback "You're all set! You'll receive a mindful coaching prompt before each meeting on your calendar."

### Test Button (settings)

- `POST /api/telegram/test` — authenticated endpoint, same logic as above
- Settings page: "Send test message" button visible when connected
- States: idle, loading (spinner), success ("Sent! Check Telegram."), error

## Files to Modify

### 1. `lib/telegram.ts` — Add `sendTestCoachingMessage(userId, chatId)`

Shared helper used by both webhook and test endpoint:
- Fetches events, finds next upcoming, runs scoring + coaching pipeline
- Returns `{ sent: boolean; type: 'coaching' | 'fallback' }`
- Catches all errors internally, never throws

### 2. `app/api/telegram/webhook/route.ts` — Use helper on connect

Replace the welcome message block with a call to `sendTestCoachingMessage`.

### 3. `app/api/telegram/test/route.ts` — New authenticated endpoint

- Requires NextAuth session
- Looks up user's `telegramChatId`
- Calls `sendTestCoachingMessage`
- Returns `{ ok: true, type: 'coaching' | 'fallback' }` or error

### 4. `app/settings/page.tsx` — Add test button

- Button below "Telegram connected" status
- POST to `/api/telegram/test` on click
- Show loading spinner, then success/error feedback

## Fallback Message

"You're all set! You'll receive a mindful coaching prompt before each meeting on your calendar."
