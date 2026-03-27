import { describe, it, expect } from 'vitest';
import type { CompanionEvent, CoachingRecord, DailyIntention } from '../companion';

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
  });

  it('CompanionEvent accepts optional userStressScore', () => {
    const event: CompanionEvent = {
      id: 'evt_2',
      userId: 'user_1',
      title: '1:1 with manager',
      start: '2026-03-27T15:00:00Z',
      end: '2026-03-27T15:30:00Z',
      attendees: ['mgr@b.com'],
      isRecurring: true,
      autoScore: 2,
      userStressScore: 3,
    };
    expect(event.userStressScore).toBe(3);
  });

  it('CoachingRecord tracks pillar and response', () => {
    const record: CoachingRecord = {
      id: 'coach_1',
      eventId: 'evt_1',
      pillar: 'connection',
      content: 'What does the board need?',
      sentAt: '2026-03-27T12:45:00Z',
      channel: 'telegram',
      responseScore: 4,
    };
    expect(record.pillar).toBe('connection');
  });

  it('CoachingRecord accepts optional responseText', () => {
    const record: CoachingRecord = {
      id: 'coach_2',
      eventId: 'evt_2',
      pillar: 'awareness',
      content: 'Take three breaths before the call.',
      sentAt: '2026-03-27T14:45:00Z',
      channel: 'webpush',
      responseScore: 5,
      responseText: 'Really helped me center myself.',
    };
    expect(record.responseText).toBeDefined();
  });

  it('DailyIntention has correct shape', () => {
    const intention: DailyIntention = {
      userId: 'user_1',
      date: '2026-03-27',
      intention: 'Stay present in meetings today.',
    };
    expect(intention.intention).toBeTruthy();
  });
});
