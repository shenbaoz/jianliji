---
version: alpha
name: Resume Notes Editorial Canvas
description: Public-facing visual contract based exclusively on the supplied Octolane reference screenshots.
colors:
  background: "#F6F5F3"
  surface: "#FFFFFF"
  canvas: "#E9EAEE"
  text: "#202022"
  muted: "#6C6C70"
  border: "#E7E6E4"
  accentBlue: "#72B9F5"
  accentGold: "#F7CF65"
  accentCoral: "#E29B8D"
typography:
  display:
    fontFamily: 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 64px
    fontWeight: 400
    lineHeight: 0.98
  body:
    fontFamily: 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.35
rounded:
  sm: 14px
  md: 24px
  lg: 32px
  full: 9999px
spacing:
  xs: 8px
  sm: 16px
  md: 24px
  lg: 48px
  xl: 96px
---

## Overview

The public Resume Notes experience uses the supplied Octolane screenshots as its sole visual direction: editorial, quiet, airy, and monochrome with one restrained spectral light band. It must feel like a composed document workspace rather than a conventional SaaS dashboard. The audience is a first-time job seeker; the primary action is starting an AI-generated resume without user login or an AI-consent checkbox.

## Colors

- `background` is the continuous warm off-white page field.
- `surface` is reserved for page margins and white gutters around a canvas.
- `canvas` is the cool, very pale gray used for all major hero and content panels.
- `text` is near-black and is the only strong text color.
- `muted` is used for metadata, help text, and secondary descriptions.
- `accentBlue`, `accentGold`, and `accentCoral` are used only inside the single blurred light-band treatment. They are never button, badge, chart, or text colors.
- Do not introduce a dark theme, a saturated brand color, or additional gradients.

## Typography

- Use an unembellished sans-serif stack. Chinese text uses PingFang SC or Microsoft YaHei fallback; no decorative display typefaces.
- Desktop hero headings use `display` and may split across two lines. Mobile headings scale to 42px with the same thin, compact rhythm.
- Body copy is short: a lead has one sentence; supporting text has at most two lines in the first viewport.
- Labels and metadata use 12px, normal weight, tracking only when set in all caps for technical microcopy.
- Do not use heavy bold blocks, colored emphasis, emoji, or exclamation-heavy product copy.

## Layout

- Public pages have 36px desktop gutters and a maximum content width of 1440px.
- The first viewport uses one large rounded canvas with a white outer gutter, matching the screenshot's framed composition.
- Hero content is centered horizontally with generous vertical negative space; the title sits above the light band, actions are centered below it, and the short explanation follows.
- Subsequent content is a vertical sequence of full-width rounded canvases separated by at least 48px, not a dense multi-card grid.
- The existing functional steps remain in the order: landing → import / small-white creation → job context → result / editor → payment identity. Only the visual shell and copy change.
- On mobile, use 16px page gutters; preserve one canvas per viewport-width section, stack controls vertically only when two compact buttons no longer fit.

## Elevation & Depth

- Depth comes from tonal separation: warm page → white frame → cool-gray canvas.
- Major canvases have no drop shadow. Use a one-pixel low-contrast border only where a white frame needs definition.
- Modal and alert surfaces may use a subtle overlay but retain the same warm-white and gray palette.

## Motion

- The spectral light band is an animated visual layer, not a static gradient: it drifts horizontally across the canvas on a 14–18 second ease-in-out loop and subtly changes blur and position.
- The canvas background may receive an independent 22–28 second, two-percent luminance drift to create the reference's projected-light feeling.
- Headings, navigation, buttons, input controls, score values, and resume text do not continuously animate. They may only use a 160–220ms opacity transition on entry or state change.
- The light band never obstructs text contrast or pointer interaction and uses `pointer-events: none`.
- Under `prefers-reduced-motion: reduce`, remove all keyframe animation and render the central, static light-band frame.

## Shapes

- Major canvas corners use 32px on desktop and 24px on mobile.
- Small controls use fully rounded pills; their height is 36px desktop and at least 40px on touch devices.
- Inputs are quiet, single-surface fields with modest corner rounding; avoid boxed field groups and excessive outlines.
- Icons are sparse, monochrome, and line-based. Use no colorful icon circles.

## Components

- **Header:** a compact wordmark left, minimal navigation, and no crowded utility actions. It does not resemble the administration console.
- **Hero canvas:** includes one centered small geometric mark, a large two-line headline, a blurred spectral light band, two compact action buttons, a short explanatory line, and optional low-contrast technical microcopy at a corner.
- **Primary button:** near-black fill, white normal-weight text, compact pill shape. Copy uses direct verbs such as “开始生成”.
- **Secondary button:** white fill, near-black text, hairline border, compact pill shape.
- **Forms:** one question or logical group per canvas. Each page describes why the requested information improves the resume. AI generation starts directly; no consent checkbox is rendered.
- **Analysis and editor:** retain existing functional data, but use a document-like gray canvas and a single clear next action. Avoid metric-card clutter and colorful score gauges.
- **Payment identity:** ask only for name and mobile number inside a single calm canvas; the visible copy says the information is used to match the future payment order and restore purchased rights.
- **Loading, empty, and error states:** stay in the same canvas, use one plain sentence, and offer one visible recovery action.

## Do's and Don'ts

- Do reproduce the reference's wide whitespace, pale gray canvases, thin black type, rounded geometry, and restrained spectral band.
- Do translate the supplied reference's composition to Chinese resume content without using its logo, title, wording, or proprietary imagery.
- Do keep the public flow direct: no user login and no AI-consent checkbox.
- Don't introduce blue SaaS buttons, dashboard tile grids, glassmorphism, illustration mascots, gradients outside the specified light band, or decorative animations.
- Don't animate layout position, form controls, or text continuously; the only ambient animation is the restrained light projection.
- Don't change the administration UI as part of this redesign.
- Don't change the existing optimized-generation rules in `src/services/resumeAnalyzer.ts`.
