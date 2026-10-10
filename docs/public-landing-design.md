# Public Landing: Friendly Financial AI

## Design Read

Direction: the owner's request for a more fun Meowslim-inspired public page,
with AturDuitku's existing cat mascot and a stronger Dokter Keuangan AI story.
Anti-slop is applied during implementation, as selected by the owner.

Dials: ENERGY 3 / RHYTHM 3 / MOTION 2.

Language update: the owner requested English for the public page. All landing
copy, accessible labels, image descriptions and sharing metadata are English.
Brand names are preserved. Original app screenshots remain Indonesian, and the
document language returns to the existing app language when leaving the landing.
The copyright year stays 2025. Two-line question space keeps English demo
selections from resizing the conversation tool.

- Palette: brand purple identifies AturDuitku and login; mint makes the welcome
  warmer without turning the whole page purple. Yellow highlights the literal
  AI word and the mascot's introduction. No decorative gradient or background grid.
- Type: the existing system sans stays fast and familiar; heavier display
  weights create a playful voice without loading another font. Fixed responsive
  sizes, zero tracking, and smaller tool headings protect readability.
- Composition: centered welcome and real product scene, interactive AI example,
  editorial money-habit bridge, screenshot gallery, then specific account FAQs.
  The AI comes before the gallery because it is the requested primary story.
- Assets: existing branded cat and genuine seeded demo screenshots. No copied
  reference artwork, customer financial data, fictional testimonials or metrics.
- Motion: one-shot mascot greeting introduces Dokter Keuangan; one-time section
  reveals guide the narrative. Prompt feedback lasts 240ms. No perpetual motion;
  reduced-motion disables it all. Hover lifting is fine-pointer only.
- Controls: login opens the existing login screen, tabs support arrow/Home/End
  navigation, AI examples switch locally, and FAQs use native details elements.
- Honesty: AI examples are visibly simulated and never write financial data.
  Supported capabilities are contextual analysis and requested recording, with
  ambiguity and AI-error limitations stated. Existing authenticated routing is unchanged.

## Delivery Gate

Verified 2026-10-10 against the production build. Evidence: `qa:release`,
`e2e-public-landing.mjs`, `e2e-reconciliation.mjs`, and screenshots in
`.e2e-artifacts/public-hero-*`, `public-ai-tool-*`, and `public-full-*`.
Browser sizes: 360x720, 390x844, 600x900, 768x900, 1440x768, 1920x1080.

### Hard Gate

- R-02 PASS: no em dashes in public copy.
- R-03 PASS: six viewport tests find no overflow; controls fit and screenshots were inspected.
- R-17 PASS: no customer-count, uptime or performance statistics; product screenshots say demo.
- R-18 PASS: no testimonials or invented people.
- R-23 PASS: existing owner-approved brand assets and requested navigation are reused.
- R-24 PASS: navigation targets existing AI, gallery, FAQ and login destinations.
- R-25 PASS: computed text contrast checks pass AA thresholds at all six sizes.
- R-26 PASS: all local buttons, tabs, prompts and FAQs were exercised; external admin link uses the existing support number.
- R-27 PASS: examples are local static content, not a remote data view; all selection states work. Existing auth loading and error handling remain unchanged.
- R-28 PASS: FAQs address AI limitations, existing-account login, PWA, bank imports and approval.
- R-32 PASS: gallery arrow navigation and every FAQ Enter toggle pass; visible focus styles are present.
- R-33 PASS: source and styles edited directly with apply_patch, not rewriting scripts.
- R-34 PASS: no theme toggle is shipped on the public page.
- R-35 PASS: release suite, production build, six browser sizes, login reload and authenticated regressions pass.
- R-36 PASS: no invented safety, compliance or performance promises.
- R-37 PASS: owner's explicit fun/reference/AI brief establishes direction.
- R-38 PASS: real assets and supported features only; interactive examples visibly say simulation and never write data.

### Purpose Gate

- R-01 PASS: flat mint welcome and established purple brand; no decorative gradients or glows.
- R-04 PASS: wallet, target and chart identify the corresponding tools; message identifies conversation, shield identifies user control.
- R-06 PASS: existing system sans supports familiar, fast loading; display weight supplies playful voice; tracking stays zero.
- R-07 PASS: no grids, blueprint patterns or graph-paper background.
- R-08 PASS: login icons identify entry; arrows are limited to app/support navigation; chevrons mark scrolling or disclosure.
- R-09 PASS: no hype capsules; yellow AI highlight identifies the requested core feature.
- R-10 PASS: no glassmorphism.
- R-12 PASS: one subtle screenshot shadow separates the real product image from mint; sections are not floating cards.
- R-13 PASS: no decorative glows.
- R-14 PASS: gallery is one switchable screenshot, capabilities are unframed rows, not a repeating card grid.
- R-19 PASS: one-shot greeting, one-time reveal, 240ms selection feedback; no loops and reduced-motion is verified.
- R-22 PASS: original AturDuitku cat introduces the existing Dokter Keuangan persona, not generic stock illustration.

### Liveliness

- Dials PASS: ENERGY 3 / RHYTHM 3 / MOTION 2 is recorded above.
- Consistency PASS: mint mascot scene, editorial bridge, gallery and conversation tool vary composition visibly.
- Focal point PASS: brand/AI welcome, AI conversation, selected gallery screenshot and FAQ headings establish section priorities.
- Whitespace PASS: content bands and compact tool spacing separate narratives; prompt changes preserve stable dimensions.
- Accent PASS: yellow is limited to AI emphasis and the mascot greeting.
- Identity PASS: existing cat, purple action color and conversational money-specific language repeat across the page.
- Design Read PASS: explicit fun landing direction was declared before edits and recorded above.

### Craftsmanship And Quality Locks

- C-1 PASS: palette, type, composition, assets and motion each have a written purpose above.
- C-2 PASS: local interactions and login were browser-tested; no inert controls.
- C-3 PASS: AI leads because the owner asked to strengthen it; real gallery explains the financial product.
- C-4 PASS: six responsive sizes, keyboard, reduced motion and login/back/reload pass; public scrolling is scoped and removed on unmount.
- C-5 PASS: no fabricated claims or testimonials.
- R-05 PASS: varied scene, conversation, editorial, gallery and FAQ composition; no template trust bar or feature-card grid.
- R-11 PASS: controls/tools use 6-8px radii; AI highlight 4px; no universal pill treatment.
- R-15 PASS: product-specific login and AI-section actions.
- R-16 PASS: plain English descriptions, no revolutionary/AI-powered buzzwords.
- R-20 PASS: branded cat and real product screenshots keep the page specific to AturDuitku.
- R-21 PASS: welcoming light theme, no unrequested dark-theme implementation.
- R-29 PASS: purple, mint and yellow plus neutral text; existing screenshot colors belong to the demonstrated app.
- R-30 PASS: reference supplies friendliness, not copied layout, assets or content.
- R-31 PASS: every major visual decision has a one-line reason in Design Read.

Existing large-bundle build warning remains; no new animation library or font was added.
