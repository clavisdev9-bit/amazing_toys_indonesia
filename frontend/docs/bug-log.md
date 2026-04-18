# SOS Frontend — Bug Log

---

### BUG-TOUR-001 — TourWelcomeModal does not close on button click

| Field        | Value                                                    |
|--------------|----------------------------------------------------------|
| ID           | BUG-TOUR-001                                             |
| Date found   | 2026-04-18                                               |
| Date fixed   | 2026-04-18 (confirmed fix on second attempt)             |
| Reporter     | Senior Full Stack Developer                              |
| Severity     | High                                                     |
| Status       | Fixed                                                    |
| Component    | TourWelcomeModal, TourTooltip                            |
| Page         | /katalog                                                 |

**Symptom:**
Clicking "Mulai Tur" or "Lewati Dulu" in the welcome modal did not dismiss
the dialog. The modal remained visible on screen simultaneously with tour
step 0 tooltip (rendered as a bottom sheet on mobile viewports).

**Root cause (confirmed after two-step investigation):**

*First attempt* identified two sibling `z-50` portal divs causing a
compositor-layer conflict, and merged them into one — modal still broken.

*Confirmed root cause:* `createPortal(content, document.body)` combined with
`backdrop-filter: blur()` (`backdrop-blur-sm`) on the portal container.
iOS Safari and some mobile Chrome builds have a known behaviour where a
`backdrop-filter` element rendered into a portal container (outside `#root`)
creates a compositing layer that swallows touch events before they propagate
to child elements. The event reaches the compositor boundary and is dropped.
Result: `startTour()` and `skipTour()` were never called, `showWelcome` stayed
`true`, and `TourTooltip` step 0 rendered simultaneously as a bottom sheet.

A secondary issue: `TourTooltip` had no guard for `showWelcome`, allowing
step 0 to render at the same time as the welcome modal.

**Fix applied:**

1. **`TourWelcomeModal.jsx`** — Removed `createPortal` entirely. Component now
   renders directly inside the React tree (inside `#root`). Uses
   `position: fixed; z-index: 9999` for full-viewport coverage — identical
   visual result with zero compositor conflict. Removed `backdrop-filter`
   (replaced with plain `rgba` background). Removed `stopPropagation` to
   eliminate all remaining event-interference vectors. Added `type="button"`
   and `active:` states to both buttons.

2. **`TourTooltip.jsx`** — Added defensive render guard:
   ```js
   if (!isActive || !currentStep || showWelcome) return null;
   ```
   Prevents tooltip from rendering while the welcome modal is open.

**Files changed:**
- `src/components/tour/TourWelcomeModal.jsx` — no portal, no backdrop-filter, z-9999
- `src/components/tour/TourTooltip.jsx` — added `showWelcome` guard

**How to prevent recurrence:**
- Never combine `createPortal(…, document.body)` with `backdrop-filter` on the
  container element. If a blur effect is needed, apply it to a non-interactive
  sibling or a pseudo-element, not the container that holds buttons.
- Modal components with interactive content should render inside `#root` and
  rely on `position: fixed` + high z-index rather than portals to `document.body`.
- Unit test: dispatch `START_TOUR` → assert `showWelcome: false` and
  `isActive: true` update atomically; assert `TourTooltip` does not render
  while `showWelcome` is true.
