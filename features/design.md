# ERANDER Design System

**File:** `design.md`\
**Status:** Project-wide design source of truth\
**Version:** 1.0\
**Last updated:** 2026-10-26

> **Purpose:** This document defines the visual language, design tokens,
> reusable components, layout rules, and interaction standards for every
> ERANDER page. It is written for human developers and AI coding
> assistants. Follow it before creating or changing UI.

------------------------------------------------------------------------

## 1. The non-negotiable rule

**Every ERANDER page belongs to one product and must look and behave
like one product.**

All public pages, authentication screens, customer dashboards, erander
dashboards, business tools, messaging, checkout/funding flows, support,
and admin screens must use this design system.

-   Do not invent a separate visual style for an individual page.
-   Do not introduce new brand colours, fonts, radii, shadows, spacing
    scales, button styles, or card styles when an existing
    token/component covers the need.
-   Reuse shared components and design tokens rather than duplicating
    styles.
-   Page-specific layouts may differ to suit their tasks, but the design
    language must remain consistent.
-   If a genuinely new token or component is needed, define it
    centrally, document its purpose, and reuse it consistently.
-   Preserve the product's usability, accessibility, security, and
    financial clarity over decorative effects.
-   Do not make a page look like a generic template or a different
    brand.

When an instruction conflicts with this file, follow this priority: 1.
Security, privacy, accessibility, legal, and transaction-safety
requirements. 2. This `design.md` and shared design tokens/components.
3. The page-specific product requirements. 4. Individual implementation
preference.

A page-specific request must not silently override global tokens. If a
request would change the system, update this file and shared
implementation intentionally.

## 2. Brand foundation

### Brand

-   **Name:** ERANDER
-   **Proposed tagline:** Get things done.
-   **Product:** A people-powered marketplace for everyday and business
    errands.
-   **Personality:** Trustworthy, modern, efficient, human-centred,
    professional but approachable.
-   **Visual character:** Clean, premium, calm, confident, clear,
    practical, mobile-first.
-   **Avoid:** Childish illustrations, excessive gradients, loud rainbow
    palettes, gratuitous glassmorphism, over-rounded "toy" UI, constant
    animation, generic delivery-app clichés, and decorative effects that
    weaken clarity.

### Core brand colours

The existing CSS has both `--erander-green` and `--erander-mint`.
Preserve both as intentional aliases with different uses; do not use
them interchangeably without reason.

  ----------------------------------------------------------------------------
  Token                        Value                   Use
  ---------------------------- ----------------------- -----------------------
  `--erander-navy`             `#14213D`               Primary brand anchor,
                                                       headings, navigation,
                                                       important controls

  `--erander-green`            `#20CC88`               Strong action/accent
                                                       colour where the design
                                                       needs a brighter green

  `--erander-mint`             `#35D07F`               Brand highlight, focus
                                                       ring, success accents
                                                       and selected states

  `--erander-pale`             `#E9FBF3`               Soft mint background

  `--erander-white`            `#FFFFFF`               Main surface

  `--erander-off-white`        `#F8FAFC`               App/page background

  `--erander-surface`          `#F7F8F6`               Neutral surface

  `--erander-surface-muted`    `#EEF2ED`               Muted surface

  `--erander-surface-dark`     `#101E34`               Dark sections and
                                                       panels

  `--erander-dark`             `#091426`               Deep dark background

  `--erander-text`             `#14213D`               Primary text

  `--erander-text-muted`       `#64748B`               Secondary text

  `--erander-text-subtle`      `#94A3B8`               Tertiary text and hints

  `--erander-text-inverse`     `#FFFFFF`               Text on dark surfaces

  `--erander-border`           `#E2E8F0`               Default border

  `--erander-border-soft`      `#F1F5F9`               Subtle dividers

  `--erander-border-strong`    `#CBD5E1`               Emphasized borders

  `--erander-border-surface`   `#DDE5DD`               Borders on neutral
                                                       surfaces

  `--erander-success`          `#15803D`               Success status and
                                                       confirmations

  `--erander-success-dark`     `#166534`               Dark success text

  `--erander-success-soft`     `#E9FBF3`               Success background
  ----------------------------------------------------------------------------

**Colour usage rules** - Navy is the primary brand colour; green/mint is
the accent, not a replacement for all navy elements. - Use
white/off-white/neutral surfaces to create hierarchy and breathing
room. - Use semantic status colours for status only. Do not use green to
communicate every kind of emphasis. - Do not use colour alone to
communicate status; include text, iconography, or another cue. - Do not
place small white text on pale mint or small mint text on white unless
contrast has been checked. - Do not use arbitrary hex colours in
components when an existing token or semantic token applies. - Any
additional warning, error, info, or disabled tokens must be defined
centrally before broad use and checked for contrast.

## 3. Typography

### Font family

-   Primary typeface: **Manrope**.
-   Fallback: `sans-serif`.
-   Use the existing Google Fonts import or a self-hosted equivalent
    approved by the project.
-   Do not add a second display font to an individual page.

### Typography scale

Use Tailwind's existing scale where possible. The following is the
default hierarchy, not a requirement to make every page oversized.

  ------------------------------------------------------------------------------------------------------------------
  Purpose                 Suggested classes                                                  Rules
  ----------------------- ------------------------------------------------------------------ -----------------------
  Display/marketing hero  `text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight`   Landing/marketing pages
                                                                                             only; short copy

  Page title              `text-2xl sm:text-3xl font-bold tracking-tight`                    One clear primary title
                                                                                             per screen

  Section title           `text-xl sm:text-2xl font-bold tracking-tight`                     Group related content

  Card title              `text-base sm:text-lg font-bold`                                   Clear and concise

  Body                    `text-sm sm:text-base leading-6`                                   Readable and calm

  Secondary body          `text-sm leading-5 text-content-muted`                             Supporting information

  Label                   `text-sm font-semibold`                                            Inputs and compact
                                                                                             metadata

  Helper/caption          `text-xs sm:text-sm text-content-muted`                            Secondary only; never
                                                                                             hide critical terms
                                                                                             here

  Financial amount        `text-base sm:text-lg font-bold tabular-nums`                      Use clear currency and
                                                                                             amount formatting
  ------------------------------------------------------------------------------------------------------------------

Typography rules: - Use a clear hierarchy with consistent heading
levels. - Avoid long paragraphs in dashboards; use concise labels and
grouped information. - Use sentence case for page headings, buttons,
labels, and navigation except for proper names. - Use `font-semibold` or
`font-bold` for emphasis; do not bold entire paragraphs. - Use
`tabular-nums` for amounts, balances, percentages, and aligned numeric
columns. - Financial terms, fees, currency, refunds, and security
balances must be readable and never rely only on tiny muted text.

## 4. Layout, grid, and responsive behaviour

### Container

-   Maximum content width: `1440px`.
-   Use `.erander-container` or `max-w-erander` for primary page
    content.
-   Centre content with auto inline margins.
-   On wide screens, avoid stretching long text and forms across the
    full viewport.
-   Keep dashboards dense enough to be useful but not cramped.

### Responsive principles

Design mobile-first. Every screen must work at narrow mobile widths,
tablets, laptops, and wide desktops.

-   Use responsive Tailwind utilities instead of fixed-width layouts
    wherever possible.
-   Avoid horizontal page overflow.
-   Stack complex columns on small screens; move to multi-column layouts
    when space permits.
-   Tables may become horizontally scrollable or switch to a carefully
    designed card layout on mobile.
-   Primary actions must remain easy to reach and tap on touch devices.
-   Forms should be one column on mobile; use multiple columns only when
    they improve scanning and do not break field order.
-   Do not hide important transaction totals, status, safety
    information, or required actions on mobile.
-   Use `min-w-0`, wrapping, and truncation carefully to prevent long
    names and IDs from breaking layouts.

### Spacing rhythm

Use a consistent spacing scale from Tailwind:
`1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24` (multiples of 4px in the
default Tailwind scale).

-   Tight inline groups: `gap-2` or `gap-3`.
-   Form fields: `space-y-4` or `gap-4`.
-   Card content: usually `p-4 sm:p-5 lg:p-6`.
-   Section spacing: usually `py-10 sm:py-14 lg:py-16`.
-   Major marketing sections: may use `py-16 sm:py-20 lg:py-24`.
-   Avoid arbitrary values such as `mt-[37px]` unless a real design
    constraint requires them.
-   Align cards in the same row and use consistent internal padding.

### Radius

Use a restrained, consistent radius system: - Small controls/chips:
`rounded-md` or `rounded-lg`. - Inputs and buttons: `rounded-lg` by
default. - Standard cards/panels: `rounded-2xl` only when consistent
with `.erander-card` or the page's established card pattern. - Large
marketing surfaces: `rounded-2xl` or `rounded-3xl` sparingly. - Avoid
mixing many different corner radii on one screen.

### Shadows

-   Use `shadow-erander-card` for standard elevated cards.
-   Use `shadow-erander-card-hover` for interactive card hover states
    where appropriate.
-   Prefer borders and surface contrast over shadows for dense
    application dashboards.
-   Avoid heavy black shadows, glowing outlines, and multiple stacked
    shadows.
-   Never add a hover lift to non-interactive content merely for
    decoration.

## 5. Design tokens and implementation rules

### CSS custom properties

The `:root` tokens in the project's global stylesheet are the source of
truth for brand values. Components should use Tailwind aliases mapped to
those tokens or the CSS variables directly.

### Tailwind

Use the shared Tailwind theme aliases: - `brand-*` for ERANDER brand
colours. - `surface-*` for surfaces. - `content-*` for text. - `line-*`
for borders. - `success-*` for success states. - `shadow-erander-card`
and `shadow-erander-card-hover` for approved shadows. - `max-w-erander`
for the standard maximum width. - `font-sans` / `font-manrope` for
Manrope.

Prefer:

``` jsx
<div className="bg-surface-white text-content">
  <div className="erander-container px-4 sm:px-6 lg:px-8">
    <section className="erander-card p-4 sm:p-6">
      ...
    </section>
  </div>
</div>
```

Avoid:

``` jsx
<div className="bg-[#123456] text-gray-713 shadow-[0_20px_50px_#0005]">
```

The second example invents arbitrary visual values and breaks the design
system.

### Token changes

If a token needs to change: 1. Search for all usages. 2. Update the
token in the central stylesheet/config, not just one page. 3. Check all
affected page types. 4. Confirm text contrast, focus states, and
semantic meaning. 5. Update this document if the design intent changes.

## 6. Global page structure

Pages may have different information architecture, but should share a
consistent frame.

### Public/marketing pages

-   Shared site header and navigation.
-   Consistent content container and section spacing.
-   One clear primary headline and primary call to action.
-   Reusable buttons, cards, badges, and footer.
-   Responsive mobile navigation using the same menu patterns.
-   Marketing pages may be more expressive, but must use the same
    typography, colours, spacing, and controls.

### Authenticated application pages

-   Shared app shell with consistent navigation, header, content
    container, and responsive behaviour.
-   Consistent page-heading area: title, optional description,
    breadcrumbs when useful, and primary action.
-   Consistent spacing between summary cards, filters, lists, forms, and
    content sections.
-   Navigation labels, active states, loading states, empty states, and
    errors must follow shared patterns.
-   Customer, erander, and business experiences can have different
    navigation items and task flows while retaining the same design
    language.

### Administrator pages

-   Use the same ERANDER tokens and components.
-   Prioritize information density, clear tables, filters, audit
    context, and precise actions.
-   Destructive and financial actions must be visually distinct,
    confirmed, authorized, and recorded.
-   Do not create a separate "admin brand".

## 7. Shared component standards

Build and reuse shared components instead of hand-styling each page.
Names below are suggested; match the actual repository conventions if
components already exist.

### Buttons

Create or standardize `Button` variants: - **Primary:** navy background,
readable white text; use for the main action. - **Accent:** green/mint
background only where contrast is sufficient; use sparingly for a key
positive action. - **Secondary:** white or neutral background with a
standard border. - **Ghost:** transparent with clear hover/focus
states. - **Danger:** semantic danger styling for destructive or
high-risk actions. - **Link:** text action for low-emphasis navigation.

Rules: - Use consistent height, padding, radius, font weight, and icon
spacing. - Every button must have hover, active, focus-visible,
disabled, and loading states as applicable. - Avoid multiple equally
prominent primary buttons in one action group. - Use a real `<button>`
for actions and an `<a>` for navigation. - Do not use icon-only buttons
without an accessible name/label. - Destructive actions must not be
styled as routine primary actions.

### Inputs and forms

Standardize `Input`, `Select`, `Textarea`, `Checkbox`, `Radio`,
`Switch`, `FormField`, and validation messages.

-   Labels must remain visible; placeholders are not labels.
-   Associate labels and controls programmatically.
-   Show field-level errors next to the relevant field.
-   Preserve entered values after validation errors where safe.
-   Clearly mark required fields and explain special requirements.
-   Use the same heights, border colours, radius, focus ring, and
    vertical rhythm.
-   Use input types and autocomplete attributes correctly.
-   Currency and amount fields must clearly show currency and expected
    format.

### Cards and panels

-   Use `.erander-card` or a shared card component.
-   Keep border, background, radius, padding, and shadow consistent.
-   Use a clear title/content/action hierarchy.
-   Cards should be clickable only if they actually navigate or perform
    an action.
-   Do not nest interactive controls inside a clickable card in a way
    that creates conflicting actions.

### Badges and status

Create a shared `Badge` / `StatusBadge` with semantic variants such as
neutral, success, warning, danger, and info.

-   Status text must be explicit: e.g. "Awaiting payment", "In
    progress", "Under review".
-   Do not communicate status by colour alone.
-   Keep badge shape and typography consistent across lists, detail
    pages, and dashboards.
-   Avoid inventing unique colours for individual pages.

### Dialogs, drawers, and menus

-   Use shared overlays, spacing, heading styles, buttons, and focus
    behaviour.
-   Dialogs must have an accessible name and appropriate focus
    management.
-   Escape and backdrop behaviour must be consistent and must not
    accidentally discard important work.
-   Confirm high-impact actions and explain the consequence.
-   On mobile, prefer full-width or bottom-sheet patterns only when
    appropriate and consistent.

### Tables and lists

-   Reuse table headers, row spacing, status badges, empty states,
    pagination, and action menus.
-   Keep column alignment consistent; right-align numeric and financial
    columns where practical.
-   Make loading, empty, error, and populated states explicit.
-   Provide mobile behaviour rather than allowing accidental overflow.
-   Do not rely on colour alone to distinguish rows or statuses.

### Feedback states

Every data-driven component should define: - Loading state (skeleton or
progress indicator). - Empty state with a useful next action when
possible. - Error state with a recovery path. - Success/confirmation
state. - Disabled state when an action is unavailable.

Use skeletons sparingly and in shapes that resemble the eventual
content. Avoid layout shifts when loading.

## 8. ERANDER-specific transaction UI

Money, scope, and trust must be especially clear.

### Transaction amount breakdown

When relevant, show separate line items for: - Approved item budget -
Erander service fee - Delivery/travel fee - ERANDER platform fee -
Payment-provider charges, if applicable and disclosed - Applicable
taxes/statutory charges - Tip, if any - Total authorized amount - Actual
evidenced spending - Refund/unspent balance - Erander earnings and
payout status, where appropriate

Never merge unrelated amounts into one unexplained total. Always label
currency explicitly. Do not silently convert currencies or change agreed
amounts.

### Security balances

-   Distinguish available security balance from reserved security funds.
-   Explain why funds are reserved and when they may be released.
-   Do not present a security deposit as a fee or as guaranteed
    insurance.
-   Make restrictions, disputes, and adjustments understandable.
-   Never imply that an internal balance is equivalent to money held by
    a provider unless that is true and validated.

### Agreements and material changes

-   Present task scope, budget, service fee, delivery/travel charges,
    currency, deadline, handover details, and relevant terms before
    confirmation.
-   Material changes to scope, budget, price, or deadline require
    explicit approval.
-   Show the updated terms and version/status before the user confirms.
-   Chat messages alone must not appear to change the formal agreement.

### Risky or destructive actions

For cancellations, refunds, security deductions, withdrawals, account
restrictions, and administrator financial actions: - State the exact
action and consequences. - Show the relevant amount and currency. -
Require confirmation when appropriate. - Use evidence and authorization
rules from the product policy. - Never design the interface to imply
that a complaint alone proves wrongdoing.

## 9. Icons, imagery, and motion

### Icons

-   Use the project's established icon library (currently Lucide in the
    existing landing page).
-   Keep stroke weight, size, alignment, and icon/text spacing
    consistent.
-   Icons support labels; they should not replace important text.
-   Do not mix multiple icon libraries on one page without a documented
    reason.
-   Avoid emoji as interface icons.

### Imagery and illustration

-   Use imagery only when it adds context, warmth, or understanding.
-   Keep image treatment and corner radius consistent.
-   Avoid stock imagery that contradicts the product's Nigerian launch
    context or suggests services ERANDER does not provide.
-   Do not use decorative images that reduce text contrast or obscure
    actions.
-   Ensure useful alternative text for meaningful images and empty alt
    text for purely decorative images.

### Motion

-   Motion should communicate state, hierarchy, or feedback---not
    distract.
-   Keep transitions short and restrained.
-   Framer Motion is already used in the landing-page implementation;
    reuse it only when it improves the experience.
-   Respect `prefers-reduced-motion`.
-   Avoid large parallax effects, continuous floating objects, excessive
    entrance animations, and animations that delay essential actions.

## 10. Accessibility and usability

-   Aim for WCAG 2.2 AA as the accessibility target.
-   Maintain visible keyboard focus.
-   Ensure controls can be used with keyboard and touch.
-   Use semantic HTML and correct heading order.
-   Ensure text and interactive control contrast is sufficient.
-   Do not convey errors, warnings, success, or required fields by
    colour alone.
-   Provide accessible labels for icon-only controls.
-   Keep touch targets comfortably usable, aiming for approximately
    44×44 CSS pixels where practical.
-   Make validation errors specific and actionable.
-   Support browser zoom and text resizing.
-   Use reduced-motion preferences.
-   Avoid unnecessary time limits; explain deadlines and expiry clearly.

## 11. Content and microcopy

-   Write in plain, direct English.
-   Use a confident, respectful, helpful tone.
-   Prefer short action labels: "Post an errand", "Review offer",
    "Confirm and fund", "Submit evidence".
-   Be explicit about who must act and what happens next.
-   Avoid vague messages such as "Something went wrong" without a
    recovery action.
-   Never promise instant payouts, universal coverage, escrow, emergency
    response, or guaranteed outcomes unless operationally verified.
-   Separate required service/security notifications from marketing
    messages.
-   Keep button wording consistent for the same action across the
    product.

## 12. Animation and interaction states

All interactive elements should have consistent state handling: -
Default - Hover (pointer-capable devices) - Active/pressed -
Focus-visible - Disabled - Loading - Success/error feedback where
relevant

Do not use hover as the only way to reveal important content. Do not
make a disabled control look enabled. Prevent duplicate submissions for
sensitive actions and provide clear in-progress feedback.

## 13. Technical conventions for AI coding assistants

When an AI assistant creates or edits a page, it must:

1.  Read this `design.md` before writing UI code.
2.  Inspect existing shared components and reuse them.
3.  Inspect the current global CSS and Tailwind configuration before
    adding styles.
4.  Use existing design tokens and Tailwind aliases first.
5.  Avoid new one-off colours, arbitrary spacing, custom shadows, and
    duplicate component implementations.
6.  Keep business logic out of purely visual components where practical.
7.  Preserve existing framework, routing, data flow, and project
    conventions unless asked to change them.
8.  Avoid adding dependencies without explaining why they are needed.
9.  Make the page responsive and include loading, empty, error,
    disabled, and success states as applicable.
10. Ensure accessible labels, focus states, keyboard use, and semantic
    markup.
11. Check that the page looks consistent beside at least one existing
    page or shared component.
12. Run the available lint, type-check, test, or build commands when
    possible and report what was actually run.
13. Do not claim to have tested something that was not tested.
14. If the design system lacks a needed token/component, propose a
    central addition rather than silently inventing a local variant.
15. Keep changes scoped; do not redesign unrelated pages during a
    targeted task.

### Required AI completion note

After implementing a page, report briefly: - Components reused or
created. - Tokens or global styles changed. - Responsive and
accessibility states addressed. - Checks run and any remaining issues.

## 14. Page acceptance checklist

Before considering a page complete, confirm:

-   [ ] It uses Manrope and the shared type hierarchy.
-   [ ] It uses ERANDER brand and semantic tokens, not invented colours.
-   [ ] It uses the shared container and spacing rhythm.
-   [ ] Buttons, inputs, cards, badges, dialogs, and navigation match
    established components.
-   [ ] Mobile, tablet, and desktop layouts are considered.
-   [ ] Loading, empty, error, success, disabled, and validation states
    exist where relevant.
-   [ ] Focus, keyboard access, labels, and contrast are addressed.
-   [ ] Financial amounts, currencies, fees, budgets, refunds, and
    security balances are explicit where relevant.
-   [ ] No material agreement change can happen without explicit
    approval.
-   [ ] No unverified operational or financial promise is made.
-   [ ] No unrelated design system has been introduced.
-   [ ] Available checks have been run, and results are reported
    honestly.

## 15. Global CSS baseline

The existing CSS is the starting point. Keep tokens centralized and add
new global rules only when they are genuinely shared. The repository's
current stylesheet may contain additional project-specific rules; merge
carefully rather than replacing it blindly.

``` css
@import url("https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap");

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --erander-navy: #14213d;
  --erander-green: #20cc88;
  --erander-mint: #35d07f;
  --erander-pale: #e9fbf3;

  --erander-white: #ffffff;
  --erander-off-white: #f8fafc;
  --erander-surface: #f7f8f6;
  --erander-surface-muted: #eef2ed;
  --erander-surface-dark: #101e34;
  --erander-dark: #091426;

  --erander-text: #14213d;
  --erander-text-muted: #64748b;
  --erander-text-subtle: #94a3b8;
  --erander-text-inverse: #ffffff;

  --erander-border: #e2e8f0;
  --erander-border-soft: #f1f5f9;
  --erander-border-strong: #cbd5e1;
  --erander-border-surface: #dde5dd;

  --erander-success: #15803d;
  --erander-success-dark: #166534;
  --erander-success-soft: #e9fbf3;

  --font-erander: "Manrope", sans-serif;
  --container-erander: 1440px;

  --shadow-erander-card: 0 12px 32px rgb(20 33 61 / 7%);
  --shadow-erander-card-hover: 0 18px 42px rgb(20 33 61 / 11%);
}

@layer base {
  html {
    scroll-behavior: smooth;
    scroll-padding-top: 6rem;
  }

  body {
    margin: 0;
    background-color: var(--erander-white);
    color: var(--erander-text);
    font-family: var(--font-erander);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  button,
  input,
  textarea,
  select {
    font: inherit;
  }

  button,
  a {
    -webkit-tap-highlight-color: transparent;
  }

  button:focus-visible,
  a:focus-visible,
  input:focus-visible,
  textarea:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--erander-mint);
    outline-offset: 3px;
  }

  ::selection {
    background: var(--erander-pale);
    color: var(--erander-navy);
  }
}

@layer components {
  .erander-container {
    width: 100%;
    max-width: var(--container-erander);
    margin-inline: auto;
    padding-inline: 1rem;
  }

  @media (min-width: 640px) {
    .erander-container {
      padding-inline: 1.5rem;
    }
  }

  @media (min-width: 1024px) {
    .erander-container {
      padding-inline: 2rem;
    }
  }

  .erander-card {
    border: 1px solid var(--erander-border);
    border-radius: 1rem;
    background: var(--erander-white);
    box-shadow: var(--shadow-erander-card);
    transition:
      box-shadow 200ms ease,
      border-color 200ms ease;
  }

  .erander-card:hover {
    box-shadow: var(--shadow-erander-card-hover);
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Implementation note:** The container now includes responsive
horizontal padding. If existing page wrappers already apply `px-*`,
avoid doubling the padding: either use `.erander-container` alone or
retain the original no-padding container and apply padding through the
shared page shell. Choose one convention project-wide.

## 16. Tailwind configuration baseline

Keep the existing Tailwind config and compatibility aliases if existing
pages use them. The config below illustrates the intended central
mapping. Merge it into the current
`tailwind.config.js`/`tailwind.config.ts`; do not overwrite other
required configuration without inspection.

``` js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--erander-navy)",
          navy: "var(--erander-navy)",
          green: "var(--erander-green)",
          mint: "var(--erander-mint)",
          pale: "var(--erander-pale)",
        },
        surface: {
          DEFAULT: "var(--erander-white)",
          white: "var(--erander-white)",
          muted: "var(--erander-surface)",
          soft: "var(--erander-surface-muted)",
          dark: "var(--erander-surface-dark)",
          deepest: "var(--erander-dark)",
        },
        content: {
          DEFAULT: "var(--erander-text)",
          muted: "var(--erander-text-muted)",
          subtle: "var(--erander-text-subtle)",
          inverse: "var(--erander-text-inverse)",
        },
        line: {
          DEFAULT: "var(--erander-border)",
          soft: "var(--erander-border-soft)",
          strong: "var(--erander-border-strong)",
          surface: "var(--erander-border-surface)",
        },
        success: {
          DEFAULT: "var(--erander-success)",
          dark: "var(--erander-success-dark)",
          soft: "var(--erander-success-soft)",
        },
        /* Compatibility aliases for legacy pages; prefer semantic tokens in new code. */
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "var(--erander-border)",
          300: "var(--erander-border-strong)",
          400: "var(--erander-text-subtle)",
          500: "var(--erander-text-muted)",
          600: "#475569",
          700: "var(--erander-navy)",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        emerald: {
          50: "var(--erander-pale)",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "var(--erander-mint)",
          500: "var(--erander-green)",
          600: "#16a875",
          700: "var(--erander-success)",
          800: "var(--erander-success-dark)",
          900: "#14532d",
          950: "#052e16",
        },
      },
      fontFamily: {
        sans: ["Manrope", "sans-serif"],
        manrope: ["Manrope", "sans-serif"],
      },
      maxWidth: {
        erander: "var(--container-erander)",
      },
      boxShadow: {
        "erander-card": "var(--shadow-erander-card)",
        "erander-card-hover": "var(--shadow-erander-card-hover)",
      },
      transitionTimingFunction: {
        erander: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
```

## 17. Suggested shared component inventory

Create these incrementally based on the current application structure.
Do not create duplicate components if equivalents already exist.

**Foundation** - `AppShell` - `PublicSiteLayout` - `DashboardLayout` -
`AdminLayout` - `PageContainer` - `PageHeader` - `SectionHeader`

**Inputs and actions** - `Button` - `IconButton` - `Input` -
`Textarea` - `Select` - `Checkbox` - `RadioGroup` - `Switch` -
`FormField` - `SearchInput`

**Display** - `Card` - `Badge` - `StatusBadge` - `Avatar` -
`EmptyState` - `ErrorState` - `LoadingState` - `Skeleton` - `Tooltip`

**Navigation and overlays** - `Sidebar` - `Topbar` - `MobileNav` -
`Breadcrumbs` - `Tabs` - `DropdownMenu` - `Dialog` - `Drawer` - `Toast`
/ notification system

**Marketplace and transaction** - `ErrandCard` - `OfferCard` -
`PriceBreakdown` - `CurrencyAmount` - `TransactionStatus` -
`EvidenceUploader` - `AgreementSummary` - `SecurityBalanceSummary` -
`ConfirmActionDialog`

**Operations** - `DataTable` - `FilterBar` - `Pagination` -
`AuditLogEntry` - `SupportTicketStatus`

## 18. Source-of-truth and repository guidance

Recommended project structure (adapt to the actual repository rather
than forcing a large restructure):

``` text
project-root/
├── design.md                  # Design-system source of truth
├── src/
│   ├── components/
│   │   ├── ui/                # Shared primitive components
│   │   ├── layout/            # App shells and navigation
│   │   └── marketplace/       # Errand/offer/transaction components
│   ├── pages/                 # Page composition
│   ├── styles/
│   │   └── index.css          # Global tokens and base styles
│   └── ...
├── tailwind.config.js
└── ...
```

### Rule for all future page work

Every new page should be composed from the existing layout and shared
components first. A page should define its content and task flow---not
its own design system.

When multiple AIs or developers work on the project, give them this
instruction:

> Read `design.md` before implementation. Treat it as the mandatory
> ERANDER visual source of truth. Inspect and reuse existing components
> and tokens. Do not invent page-specific visual systems. If a shared
> pattern is missing, propose and implement it centrally, update
> `design.md` when appropriate, and then use it consistently. Keep all
> pages responsive, accessible, and visually coherent.

## 19. Important implementation caveats

-   This document defines the intended system; it does not claim that
    every shared component already exists in the codebase.
-   The CSS and Tailwind excerpts are baselines to merge into the actual
    project. Inspect existing files and page usage before replacing
    them.
-   Tailwind's generated class detection must include every folder where
    class strings live.
-   Avoid dynamically constructing Tailwind class names in ways the
    compiler cannot detect; use explicit variant maps.
-   Keep transaction policy and financial calculations in the
    backend/domain layer. UI labels and styling must not be the source
    of truth for money movement or permissions.
-   Verify contrast for actual foreground/background combinations before
    release.
-   Test the design across public pages, customer/erander/business
    dashboards, and admin screens to ensure consistency.

------------------------------------------------------------------------

**Definition of done:** An ERANDER page is ready when it satisfies the
acceptance checklist in Section 14, uses the shared visual language, and
feels like a natural part of the same product as every other ERANDER
page.
