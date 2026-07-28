# Deployment-ready graduate flow design

## Goal

Make the resume site safe to deploy by making creator auto-save observable and resilient, and by improving the graduate-facing path found during usability testing.

## Scope

- Keep the existing React/Vite frontend and Express API architecture.
- Preserve local browser storage as the first durable draft copy; treat API syncing as an additional copy.
- Add a creator API readiness check and explicit sync state so a missing or unavailable API cannot silently appear as a successful save.
- Replace the experienced-worker default sample in the optimizer with a clearly labelled graduate project sample.
- Make evidence collection one question at a time, with progress and previous/next controls; keep the existing option to generate a truthful draft without answers.
- Only present an item as a textual change when its source and optimized lines form a real pair. Describe structural moves as reordering rather than rewriting.
- Prevent creator header wrapping at medium desktop widths and increase the visual prominence of mobile landing-page primary actions.
- Add the application favicon to eliminate the missing-resource request.

## Non-goals

- No authentication, account system, database schema redesign, or changes to the resume-analysis evidence rules.
- No removal of current local drafts when remote sync fails.
- No overwrite of unrelated uncommitted workspace changes.

## Data flow and error handling

Creator edits continue to be written to `localStorage` after debounce. The client sends the same profile to `/api/creator/profile`. A successful HTTP response changes the status to synced. A non-success response produces a specific, accessible status mentioning that the device copy remains safe and offers a retry action. API GET/POST continue to use the existing visitor identifier and Express route.

The server test suite proves the route remains available. Client utility tests prove the status mapping distinguishes success, server failure, and network failure without relying on rendered UI internals.

## User experience

- The graduate sample uses education, a course project, campus activity, and believable outcomes; its label makes clear that it is a reference, not a required experience level.
- Evidence collection renders one active question. Users can move back and forth without losing answers, see `n / total`, skip all questions, or generate after answering any amount.
- The creator header switches to a compact, non-wrapping layout before controls collide. Mobile landing actions become pill-shaped primary/secondary buttons while retaining accessible button text.

## Verification

1. Run the focused API and client behaviour tests, including the new red-green regressions.
2. Run the complete Node test suite and `npm run build`.
3. Start the API and web app, exercise creator persistence, the graduate sample, evidence navigation, and desktop/mobile layouts with Playwright.
4. Confirm no browser console errors remain for favicon or creator profile requests when both services are running.
