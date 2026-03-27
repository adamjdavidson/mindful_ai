# Feature Tour Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an interactive feature explanation tour with spotlight tooltips (guided mode from settings + Option-click inspect mode on any element). Auto-launches on first visit.

**Architecture:** One new component `FeatureTour.tsx` manages both modes. Tour stop data lives in a separate `lib/tourData.ts` file. Existing components get `data-tour-id` attributes for targeting. Controls.tsx gets a "How it works" menu item. Root page.tsx orchestrates first-visit auto-launch.

**Tech Stack:** React, TypeScript, CSS clip-path for spotlight, localStorage for persistence, no external libraries.

---

### Task 1: Tour Data File

**Files:**
- Create: `lib/tourData.ts`

**Step 1: Create the tour stop data structure and content**

```typescript
// lib/tourData.ts

export interface TourStop {
  id: string;
  selector: string;               // data-tour-id selector
  title: string;
  description: string;             // Layer 1: what it does
  science: string;                 // Layer 2: the research
  pillar: 'awareness' | 'connection' | 'insight' | 'purpose';
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  simulate?: boolean;              // whether this stop needs simulation
}

export const tourStops: TourStop[] = [
  {
    id: 'breathing-circle',
    selector: '[data-tour-id="breathing-circle"]',
    title: 'Breathing Animation',
    description: 'Anchors you with a gentle inhale-hold-exhale cycle when each session begins. The circles contract inward as you breathe in, expand outward as you breathe out.',
    science: 'This maps to the Awareness pillar. Focused attention on breathing engages the central-executive network while suppressing default-mode wandering. Even 3-5 seconds of breath awareness activates the same neural mechanisms as formal meditation practice. (Dahl et al., 2020 PNAS)',
    pillar: 'awareness',
    simulate: true,
  },
  {
    id: 'meditation-option',
    selector: '[data-tour-id="meditation-option"]',
    title: 'Guided Meditation',
    description: 'An optional settling period before you begin: 15 seconds, 40 seconds, or 1 minute. Skip it if you want. This is an invitation, not a requirement.',
    science: 'The Healthy Minds Program RCT found that even 102 total minutes of practice across 8 weeks produced significant stress reduction. Brief practices accumulate. The option to skip is intentional: forced mindfulness backfires. (Goldberg et al., HMP-RCT)',
    pillar: 'awareness',
    simulate: true,
  },
  {
    id: 'intention-setting',
    selector: '[data-tour-id="intention-setting"]',
    title: 'Setting an Intention',
    description: 'Name what you\'re here for before the conversation starts. This anchors the session and gives the AI a reference point to gently bring you back when the conversation drifts.',
    science: 'This maps to the Purpose pillar. Clarity about values and direction is one of four trainable dimensions of well-being. Setting an intention activates goal-directed prefrontal networks and creates a self-referential anchor that supports sustained attention. (Davidson & Dahl, 2026)',
    pillar: 'purpose',
    simulate: true,
  },
  {
    id: 'pillar-tint',
    selector: '[data-tour-id="pillar-tint"]',
    title: 'Background Color Shifts',
    description: 'The background subtly tints during your conversation: blue for awareness, rose for connection, violet for insight, amber for purpose. Most people don\'t consciously notice. That\'s the point.',
    science: 'Peripheral sensory input is integrated by the brain without requiring conscious attention. Subliminal color exposure influences mood and cognitive processing (Meier et al., 2004). The 7% opacity ensures the signal stays below the threshold of distraction while still being neurologically processed.',
    pillar: 'awareness',
    simulate: true,
  },
  {
    id: 'self-report',
    selector: '[data-tour-id="self-report"]',
    title: 'Presence Dots',
    description: 'Five dots in the bottom-left. Rate how present you feel, from scattered to focused. Always here, never required. Click to note your state at any time.',
    science: 'This maps to the Awareness pillar. Meta-awareness (noticing your own mental state) is the core mechanism identified in contemplative science research. Simply labeling your state activates the dorsolateral prefrontal cortex and reduces default-mode network wandering. (Dahl et al., 2020 PNAS)',
    pillar: 'awareness',
  },
  {
    id: 'mindful-overlay',
    selector: '[data-tour-id="mindful-overlay"]',
    title: 'Mindful Prompts',
    description: 'Gentle questions appear in the bottom-right every few exchanges: "What are you noticing right now?" They fade away on their own. You can ignore them completely.',
    science: 'These activate open monitoring, a form of awareness where you observe your experience without directing it. This engages the anterior insula and anterior cingulate cortex. The auto-dismiss design respects autonomy: forced reflection produces resistance, not insight. (PNAS-2020, CS-2015)',
    pillar: 'insight',
    simulate: true,
  },
  {
    id: 'ai-response',
    selector: '[data-tour-id="ai-response"]',
    title: 'Compassionate AI Responses',
    description: 'The AI recognizes your effort, validates difficulty, and gently surfaces assumptions. It references your intention when the conversation drifts. None of this is announced. It just happens.',
    science: 'This maps to the Connection pillar. The AI models compassionate communication so you absorb the pattern through interaction, the same way you absorb communication styles from people you spend time with. Prosocial reappraisal engages the temporoparietal junction. (Dahl et al., 2020 PNAS)',
    pillar: 'connection',
    simulate: true,
  },
  {
    id: 'session-closing',
    selector: '[data-tour-id="session-closing"]',
    title: 'Session Closing',
    description: 'When you end a session, there\'s a brief reflection, a moment of gratitude, and an invitation to name one thing you\'ll carry forward. Then: "Thank you for being present."',
    science: 'Gratitude practices show altered functional connectivity in the insula, amygdala, and reward regions (HMP-RCT). The closing bridges the Purpose pillar: naming one concrete action creates an intention-action link that extends the session\'s benefits into daily life. (Davidson & Dahl, 2026)',
    pillar: 'purpose',
    simulate: true,
  },
];
```

**Step 2: Commit**

```bash
git add lib/tourData.ts
git commit -m "feat: add tour stop data with two-layer content (description + science)"
```

---

### Task 2: Add data-tour-id Attributes to Existing Components

**Files:**
- Modify: `components/BreathingCircle.tsx` — wrap in div with `data-tour-id="breathing-circle"`
- Modify: `components/IntentionScreen.tsx` — add `data-tour-id="meditation-option"` to meditation buttons container, `data-tour-id="intention-setting"` to intention section
- Modify: `components/PillarTint.tsx` — add `data-tour-id="pillar-tint"` to the root div
- Modify: `components/SelfReport.tsx` — add `data-tour-id="self-report"` to the root div
- Modify: `components/MindfulOverlay.tsx` — add `data-tour-id="mindful-overlay"` to the root div
- Modify: `components/ChatInterface.tsx` — add `data-tour-id="ai-response"` to the messages container, add `data-tour-id="session-closing"` is not needed here (it's in page.tsx closing section)
- Modify: `app/page.tsx` — add `data-tour-id="session-closing"` to the closing screen container

**Step 1: Add attributes to each component**

For each component, add a `data-tour-id` attribute to the outermost relevant element. These are small, surgical edits. Examples:

In `SelfReport.tsx`, the root div on line 57:
```tsx
<div
  data-tour-id="self-report"
  className="fixed bottom-4 left-4 z-30 flex items-center gap-1.5"
```

In `PillarTint.tsx`, the root div on line 58:
```tsx
<div
  data-tour-id="pillar-tint"
  className="fixed inset-0 pointer-events-none z-[1]"
```

In `MindfulOverlay.tsx`, the root div on line 89:
```tsx
<div
  data-tour-id="mindful-overlay"
  role="status"
```

In `IntentionScreen.tsx`:
- Add `data-tour-id="meditation-option"` to the meditation buttons wrapper (line 84 `<div>`)
- Add `data-tour-id="intention-setting"` to the intention section wrapper (line 107 `<div>`)

In `ChatInterface.tsx`:
- Add `data-tour-id="ai-response"` to the messages scroll container (line 81 `<div>`)

In `app/page.tsx`:
- Add `data-tour-id="session-closing"` to the closing screen wrapper (line 370 `<div>`)
- Add `data-tour-id="breathing-circle"` is already handled at the BreathingCircle component level

For `BreathingCircle.tsx`, wrap the outermost element with `data-tour-id="breathing-circle"`.

**Step 2: Verify nothing broke**

Run: `npm run build`
Expected: Build succeeds. These are attribute-only changes with zero logic impact.

**Step 3: Commit**

```bash
git add components/BreathingCircle.tsx components/IntentionScreen.tsx components/PillarTint.tsx components/SelfReport.tsx components/MindfulOverlay.tsx components/ChatInterface.tsx app/page.tsx
git commit -m "feat: add data-tour-id attributes to all tour-targetable components"
```

---

### Task 3: FeatureTour Component — Spotlight and Tooltip

**Files:**
- Create: `components/FeatureTour.tsx`

This is the main component. It handles:
1. Spotlight overlay with cutout around target element
2. Tooltip with two-layer content (description + expandable science)
3. Navigation (Back/Next/Close + step counter)
4. Simulation of off-screen elements
5. Auto-positioning of tooltip

**Step 1: Build the component**

Key implementation details:

**Spotlight:** A full-screen fixed div with `z-[100]`. Use CSS `clip-path` with `polygon()` to create a cutout. Calculate the target element's bounding rect via `getBoundingClientRect()` and create a polygon that covers the full viewport except for a rounded area around the target. Add 12px padding around the cutout. Background: `rgba(0,0,0,0.6)`.

**Tooltip positioning:** After getting the target rect, determine which side has the most available space. Position the tooltip on that side with an 8px gap. Max width 340px. Arrow (CSS triangle) points toward the target.

**Science expander:** State `scienceExpanded: boolean`. "The science" link with a chevron that rotates 90° on expand. Content wrapper with `max-height` transition (0 → auto via a measured ref height).

**Navigation:** "2 of 8" text + Back/Next buttons + Close X. Back hidden on step 1. Next shows "Done" on last step.

**Simulation system:** When advancing to a stop with `simulate: true` and the target element isn't found in the DOM, render a demo element:
- `breathing-circle`: Render a small `<BreathingCircle size={80}>` in the center of the viewport
- `meditation-option`: Render the four duration buttons
- `intention-setting`: Render the intention prompt + textarea
- `pillar-tint`: Cycle through the four tint colors on the existing PillarTint (dispatch a custom event or use a callback prop)
- `mindful-overlay`: Render a sample MindfulOverlay with demo content
- `ai-response`: Render a sample message bubble
- `session-closing`: Render the closing screen text

Simulations render inside a portal div positioned where the element would normally appear.

**Keyboard support:** Escape closes. Right arrow = Next. Left arrow = Back.

**Step 2: Verify it renders**

Manually test: Import FeatureTour into page.tsx with `isActive={true}` temporarily. The spotlight should appear over the first stop.

**Step 3: Commit**

```bash
git add components/FeatureTour.tsx
git commit -m "feat: add FeatureTour component with spotlight, tooltips, simulation, and keyboard nav"
```

---

### Task 4: Inspect Mode (Option-Click)

**Files:**
- Modify: `components/FeatureTour.tsx` — add inspect mode logic
- Modify: `app/page.tsx` — add global Option-click listener

**Step 1: Add inspect mode to FeatureTour**

FeatureTour accepts a new prop: `mode: 'tour' | 'inspect'` and `inspectTarget?: string` (the tour stop ID to show).

In inspect mode:
- No spotlight (no dimming)
- No navigation controls
- Just the tooltip anchored to the target element
- Dismisses on click-outside or Escape

**Step 2: Add global Option-click listener in page.tsx**

In the root `Home` component:
1. Add state: `inspectTourId: string | null`
2. Add a global `click` event listener that checks `e.altKey`
3. When Alt-click detected, walk up from `e.target` to find the nearest `[data-tour-id]` element
4. If found, set `inspectTourId` to that element's `data-tour-id` value
5. Render `<FeatureTour mode="inspect" inspectTarget={inspectTourId} onClose={() => setInspectTourId(null)} />`

**Step 3: Verify inspect mode**

Manually test: Hold Option, click on the self-report dots. Tooltip should appear anchored to the dots with the Presence Dots explanation. Click outside to dismiss.

**Step 4: Commit**

```bash
git add components/FeatureTour.tsx app/page.tsx
git commit -m "feat: add Option-click inspect mode for contextual feature explanations"
```

---

### Task 5: Settings Menu Integration

**Files:**
- Modify: `components/Controls.tsx` — add "How it works" menu item

**Step 1: Add the menu item**

Add a new prop to Controls: `onStartTour?: () => void`

Add a button at the top of the dropdown menu (above dark mode toggle):

```tsx
{/* How it works */}
<button
  onClick={() => {
    onStartTour?.();
    setIsOpen(false);
  }}
  className="flex items-center gap-2 mb-4 pb-4 border-b border-warm-gray-light w-full text-left text-sm text-muted hover:text-sage transition-colors"
>
  <span className="w-5 h-5 rounded-full border border-warm-gray flex items-center justify-center text-xs">?</span>
  How it works
</button>
```

**Step 2: Wire up in page.tsx**

Add state: `showTour: boolean = false`
Pass `onStartTour={() => setShowTour(true)}` to `<Controls />`
Render `<FeatureTour mode="tour" isActive={showTour} onClose={() => setShowTour(false)} />` when active.

**Step 3: Verify**

Click settings gear → "How it works" → tour starts. Close tour → settings still works.

**Step 4: Commit**

```bash
git add components/Controls.tsx app/page.tsx
git commit -m "feat: add 'How it works' button to settings menu to launch feature tour"
```

---

### Task 6: First-Visit Auto-Launch

**Files:**
- Modify: `app/page.tsx` — add first-visit detection and auto-launch

**Step 1: Add first-visit logic**

On mount, check `localStorage.getItem('mindful-tour-completed')`. If null, set `showTour = true` after a 1-second delay (let the arrival animation start first).

When tour completes or is dismissed, set `localStorage.setItem('mindful-tour-completed', 'true')`.

**Step 2: Add "Skip tour" to the tour component**

In FeatureTour, when in tour mode, show a "Skip tour" link in the top-right corner of the tooltip (in addition to the X close button). Both close the tour and mark it complete.

**Step 3: Verify**

Clear localStorage. Reload. Tour auto-launches. Dismiss. Reload. Tour does not launch. Open settings → "How it works" → tour launches manually.

**Step 4: Commit**

```bash
git add app/page.tsx components/FeatureTour.tsx
git commit -m "feat: auto-launch feature tour on first visit with skip option"
```

---

### Task 7: Post-Tour Hint

**Files:**
- Modify: `app/page.tsx` — show one-time Option-click hint after tour completes

**Step 1: Add hint logic**

After the tour completes (not skipped — only on full completion or clicking Done on last step):
1. Check `localStorage.getItem('mindful-option-hint-shown')`
2. If null, show a small toast-style notification in the bottom-center: "Tip: Hold ⌥ Option and click any element to learn more about it"
3. Auto-dismiss after 5 seconds or on click
4. Set `localStorage.setItem('mindful-option-hint-shown', 'true')`

Style the hint like the MindfulOverlay: muted, `backdrop-blur-sm`, `bg-background/85`, fade in/out.

**Step 2: Verify**

Complete full tour → hint appears → wait 5s → hint fades. Reload → no hint.

**Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: show one-time Option-click hint after completing feature tour"
```

---

### Task 8: Pillar Color Tint Simulation

**Files:**
- Modify: `components/PillarTint.tsx` — accept an override tint for tour simulation
- Modify: `app/page.tsx` — pass override during tour

**Step 1: Add tint override**

PillarTint already accepts a `tint` prop. During the tour, when stop #4 (pillar-tint) is active, cycle through the four colors on a 1.5s interval: blue → rose → violet → amber → neutral.

Add a prop `overrideTint?: PillarTintProps["tint"]` or simply control the `tint` prop from page.tsx based on tour state.

In page.tsx, when tour is active and on the pillar-tint stop, start a `setInterval` that cycles through `['blue', 'rose', 'violet', 'amber']` every 1.5s. Clear interval when moving to next stop.

**Step 2: Verify**

Start tour → advance to stop 4 → background cycles through colors → advance to stop 5 → cycling stops.

**Step 3: Commit**

```bash
git add components/PillarTint.tsx app/page.tsx
git commit -m "feat: cycle pillar tint colors during tour stop demonstration"
```

---

### Task 9: Build Verification and Final Polish

**Files:**
- All modified files

**Step 1: Run build**

```bash
npm run build
```

Expected: Clean build, no errors.

**Step 2: Manual test checklist**

1. Fresh visit (clear localStorage) → tour auto-launches
2. Tour shows all 8 stops with correct spotlight positioning
3. "The science" expander works on each stop
4. Keyboard nav: Escape closes, arrow keys navigate
5. "Skip tour" dismisses cleanly
6. Complete full tour → hint appears → fades after 5s
7. Settings gear → "How it works" → tour relaunches
8. Option-click on self-report dots → inspect tooltip appears
9. Option-click on settings gear → inspect tooltip (or no tour stop = no tooltip)
10. Dark mode: tour looks correct in both themes
11. Mobile: tour works on small viewport (tooltips reposition)

**Step 3: Commit all remaining polish**

```bash
git add -A
git commit -m "feat: feature tour polish and build verification"
```

**Step 4: Push**

```bash
git push origin main
```
