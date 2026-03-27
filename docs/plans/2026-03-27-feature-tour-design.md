# Design: Feature Explanation Tour

**Date:** 2026-03-27
**Branch:** main
**Status:** APPROVED

## Problem Statement

The app has ~8 mindfulness features, many of them intentionally subtle (color tints, presence dots, overlay prompts, AI response shaping). Users need a way to discover what each feature does and why it exists. Without this, the subtlety that makes the design work also means users may never realize what the app is doing for them.

## Two Entry Points

### 1. Guided Tour (from Settings)

A step-by-step walkthrough triggered from the settings gear menu ("How it works" button). Highlights one element at a time with a spotlight/dimming effect, shows a tooltip explaining it, user clicks Next to advance.

### 2. Inspect Mode (Option/Alt + Click)

Hold Option/Alt and click any annotated element to see its explanation tooltip. No sequence, no dimming. Just a popover anchored to the clicked element. Dismisses on click-outside or Escape.

## Architecture

**One new component: `FeatureTour.tsx`**

Handles both modes. Data-driven via a `tourStops` array. No external library.

### Tour Stop Data Structure

```typescript
interface TourStop {
  id: string;                    // e.g., "breathing-circle"
  selector: string;              // CSS selector to find the element
  title: string;                 // "Presence Dots"
  description: string;           // 1 sentence: what it does
  science: string;               // 2-3 sentences: research basis
  pillar: 'awareness' | 'connection' | 'insight' | 'purpose';
  simulate?: () => void;         // triggers demo animation when element not visible
  simulateCleanup?: () => void;  // reverts demo animation
}
```

### Spotlight Effect

Full-screen overlay div at ~60% opacity black, with a rounded-rect cutout around the target element. Cutout created via CSS `clip-path` or `mask` using `getBoundingClientRect()` coordinates. Cutout has a subtle glow ring in the pillar's color. `pointer-events: none` on the overlay, `pointer-events: auto` on the tooltip.

## Tour Stops (in order)

| # | ID | Element | What it does | Pillar | Simulate? |
|---|-----|---------|-------------|--------|-----------|
| 1 | breathing-circle | Breathing Circle | Anchors you with a 3-2-4 inhale-hold-exhale cycle at session start | Awareness | Yes |
| 2 | meditation-option | Meditation Duration | Optional guided settling: skip, 15s, 40s, or 1 minute | Awareness | Yes |
| 3 | intention-setting | Intention Input | Names what you're here for, anchors the session | Purpose | Yes |
| 4 | pillar-tint | Background Color Tints | Subtle color shifts (blue/rose/violet/amber) signal which pillar is active | All | Yes |
| 5 | self-report | Presence Dots | Five dots to rate your state from scattered to present | Awareness | No |
| 6 | mindful-overlay | Mindful Overlay | Gentle prompts that appear in bottom-right and auto-fade | Insight/Connection | Yes |
| 7 | ai-response | AI Response Style | Responses model compassion, surface assumptions, reference your intention | Connection/Insight | Yes |
| 8 | session-closing | Session Closing | Reflection, gratitude, and one thing to carry forward | Purpose | Yes |

## Tooltip Content: Two Layers

### Layer 1 (always visible)
Title + 1 sentence explaining what the feature does.

Example: **"Presence Dots"** — Rate how present you feel, from scattered to focused. Always here, never required.

### Layer 2 (expandable: "The science")
2-3 sentences connecting to the Dahl/Davidson research. Mentions the pillar, mechanism, and citation.

Example: This maps to the **Awareness** pillar. Meta-awareness (noticing your own mental state) is the core skill in Dahl et al. (2020). Labeling your state activates the prefrontal cortex and reduces default-mode wandering.

Expand/collapse via a "The science" link with chevron. 200ms height transition. Resets on Next.

## Visual Design

### Tooltip
- Background: `bg-stone-50/95` (light) / `bg-stone-900/95` (dark), `backdrop-blur-sm`
- Border: 1px in the current pillar's tint color
- Typography: system font, title medium weight, description regular, science section slightly smaller + muted
- Navigation (guided tour only): "2 of 8" counter + Back / Next buttons + Close X
- "The science" expander: small text link + chevron, pillar color accent on pillar name
- Auto-positions above/below/left/right based on available space, arrow points to target

### Spotlight (guided tour only)
- Full-screen overlay at 60% black opacity
- Rounded-rect cutout around target element
- Subtle glow ring in pillar color around cutout
- 300ms fade transition between stops

### Inspect Mode (Option-click)
- Same tooltip style, no navigation controls or step counter
- Anchored to clicked element
- Dismisses on click-outside or Escape

## Settings Integration

New item in the Controls gear dropdown menu:
- `?` icon + "How it works" label
- Sits above the dark mode toggle
- Triggers the guided tour on click

## Simulation Behavior

For elements not currently on screen during the tour:

| Stop | Simulation |
|------|-----------|
| Breathing Circle | Render a small breathing circle inline, animate one cycle |
| Meditation Option | Show the four duration buttons (Skip/15s/40s/1min) |
| Intention Setting | Show the intention input with suggestion chips |
| Background Tints | Cycle through blue → rose → violet → amber at 7% opacity, 1s each |
| Mindful Overlay | Show a sample prompt ("What are you noticing right now?") in bottom-right |
| AI Response | Show a sample message bubble with compassionate response style |
| Session Closing | Show the closing screen briefly with breathing circle |

Simulations auto-cleanup when advancing to the next stop.

## Implementation Notes

- Add `data-tour-id` attributes to existing components for selector targeting
- Tour state managed via React context or simple useState in the root component
- Keyboard support: Escape closes, Arrow keys navigate (guided mode)
- Mobile: Option-click won't work on touch. Add a small `?` toggle in the header that enables tap-to-explain mode on mobile
- Respect dark mode throughout
- Tour completion saved to localStorage so it doesn't re-prompt

## Resolved Questions

1. **Auto-launch on first visit.** Tour launches automatically the first time a user opens the app. Shows a dismiss option ("Skip tour") prominently so it's easy to bail. Completion or dismissal saved to localStorage. Re-launchable anytime from settings gear.
2. **Post-tour hint.** After the tour completes (or is dismissed), show a one-time tooltip: "Tip: Hold Option and click any element to learn more about it." Dismisses on click or after 5 seconds. Saved to localStorage so it only appears once.

## Success Criteria

- User can discover and understand all 8 mindfulness features without reading external documentation
- The tour itself feels mindful (not jarring, not corporate-onboarding-y)
- The science layer is optional and doesn't slow down people who just want the quick explanation
