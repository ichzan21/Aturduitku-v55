# Public Landing: Friendly Financial AI

## Design Read

Direction: the owner's request for a more fun Meowslim-inspired public page,
with AturDuitku's existing cat mascot and a stronger Dokter Keuangan AI story.
Anti-slop is applied during implementation, as selected by the owner.

Reading this as: an English public landing for people who feel unsure about
their personal finances, in AturDuitku's playful cat-led visual language, dial
ENERGY 3 / RHYTHM 3 / MOTION 2. This is a focused refinement of the existing
public surface, not a replacement of the app's design or authentication.

Dials: ENERGY 3 / RHYTHM 3 / MOTION 2.

Language update: the owner requested English for the public page. All landing
copy, accessible labels, image descriptions and sharing metadata are English.
Brand names are preserved. Original app screenshots remain Indonesian, and the
document language returns to the existing app language when leaving the landing.
The copyright year stays 2025. Stable question space keeps English demo
selections from resizing the conversation tool.

- Palette: brand purple identifies AturDuitku and login; mint makes the welcome
  warmer without turning the whole page purple. Yellow highlights the literal
  AI word and a concrete money question beside the mascot. No decorative gradient or background grid.
- Type: the existing system sans stays fast and familiar; heavier display
  weights create a playful voice without loading another font. Fixed responsive
  sizes, zero tracking, and smaller tool headings protect readability.
- Composition: centered welcome and real product scene, interactive AI example,
  selectable customer problems, connected-records bridge, screenshot gallery, then specific account FAQs.
  The AI comes before the gallery because it is the requested primary story.
- Assets: four generated pose variants of the existing branded cat, the original
  pointing pose, and genuine seeded demo screenshots. Wave welcomes, tablet
  review introduces AI, piggy-bank saving supports goals, pointer presents the
  real tools, and wink/thumbs-up encourages the next step. All five are 512px
  alpha WebP assets (190,126 bytes total); below-hero poses load lazily. No copied
  reference artwork, customer financial data, fictional testimonials or metrics.
- Motion: one-shot mascot greeting introduces Dokter Keuangan; one-time section
  reveals guide the narrative. Prompt feedback lasts 240ms. No perpetual motion;
  reduced-motion disables it all. Hover lifting is fine-pointer only.
- Controls: login opens the existing login screen, tabs support arrow/Home/End
  navigation, money-problem rows and prompt buttons switch the same local AI
  example, and FAQs use native details elements. Selected rows use mint to show
  state without a decorative badge; selection does not resize the conversation.
- Honesty: AI examples are visibly simulated and never write financial data.
  Supported capabilities are contextual analysis and requested recording, with
  ambiguity and AI-error limitations stated. Existing authenticated routing is unchanged.
- Copy: the hero names the desired next step; the examples address unclear
  spending, recording friction, and saving within actual commitments. Product
  categories appear naturally in descriptive copy, not in keyword lists.
- Product evidence: `src/App.jsx` AI context and prompts support cashflow,
  budget review, natural-language recording, and savings plans. Examples are
  clearly illustrative; no bank sync, guaranteed savings, or autonomous decision
  making is claimed. The incomplete-records FAQ explains the actual limit.

## Delivery Gate

Verified 2026-10-11 against the production build. Evidence: `qa:release`,
`e2e-public-landing.mjs`, `e2e-reconciliation.mjs`, and screenshots in
`.e2e-artifacts/public-hero-*`, `public-ai-tool-*`, and `public-full-*`.
Browser sizes: 360x720, 390x844, 600x900, 768x900, 1440x768, 1920x1080.

### Hard Gate

- R-02 PASS: no em dashes in public copy.
- R-03 PASS: six viewport tests find no overflow, verify five mascot poses stay in bounds and do not overlap section copy; screenshots were inspected.
- R-17 PASS: no customer-count, uptime or performance statistics; product screenshots say demo.
- R-18 PASS: no testimonials or invented people.
- R-23 PASS: owner explicitly requested more mascot styles; four identity-preserving raster poses were generated from the original, not from another brand.
- R-24 PASS: navigation targets existing AI, gallery, FAQ and login destinations.
- R-25 PASS: computed text contrast checks pass AA thresholds at all six sizes.
- R-26 PASS: all local buttons, tabs, prompts, three money-problem selectors and FAQs were exercised; external admin link uses the existing support number.
- R-27 PASS: examples are local static content, not a remote data view; all selection states work. Existing auth loading and error handling remain unchanged.
- R-28 PASS: FAQs address AI limitations, incomplete records, existing-account login, PWA, bank imports and approval.
- R-32 PASS: gallery arrow navigation, problem-selector Enter activation and every FAQ Enter toggle pass; visible focus styles are present.
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
- R-22 PASS: consistent AturDuitku cat poses support welcoming, AI review, saving, feature guidance, and encouragement, not generic stock illustration.

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

## Copywriting And SEO Refinement

2026-10-11: installed `antislop-copywriting` from the official
`miqdadbadjuber/anti-slop` repository at pinned release `v3.2.0`. This companion
uses the same R-01..R-38 rule numbering as the existing local core. The dedicated
copy skill was read and applied during drafting, not claimed before installation.

Voice: friendly, specific English for people who have lost track of spending,
put off recording, or cannot tell how much they can save. Keep the cat-led
identity without repeating fragment-heavy slogans or abstract promises.

- Headline: "Know where your money went. Plan what's next with AI." names the
  visitor's problem and intended next step without promising a financial result.
- Product: "expense tracker", "monthly budget planner", and "AI finance
  assistant" describe existing functionality and appear in relevant sections.
- Actions: "Open AturDuitku" goes to the existing login; "See AI examples"
  scrolls to visibly simulated conversations, not a live account analysis.
- Restarting records: the intro addresses gaps in tracking using the existing
  current-balance setup rather than pretending AI can recover missing spending.
- FAQ: the added monthly-period question explains actual transaction/report
  filters without suggesting deletion or a mandatory close-book action.

Draft audit: the previous page repeated short abstract slogans and "clearer"
without naming the product category. The revision uses everyday finance tasks,
varies sentence lengths, and removes those repetitions. No new performance,
customer, automatic-bank-sync, security, price, or savings claims were added.

### Copy Skill Checklist

- PASS: no invented numbers, testimonials, or claims; transaction examples remain
  explicitly simulated and screenshots remain labeled sample data.
- PASS: no empty AI buzzwords; AI review, requested recording, and savings-plan
  discussion are supported by the existing implementation.
- PASS: no em or en dashes in landing prose.
- PASS: quotation marks represent a sample question, not emphasis.
- PASS: AI is an acronym, not a shouted emphasis clause.
- PASS: sentences identify users or the AI; passive wording is limited to
  notices where the action's absence is the point.
- PASS: CTA labels identify the actual destination or example action.
- PASS: no forced trios or abstract aphorisms; three AI examples correspond to
  three implemented use cases, not an invented marketing framework.
- PASS: the approachable voice and original cat identity remain.
- PASS: read-aloud review finds direct, varied sentences without padded closers.

### SEO Evidence And Limits

The initial HTML now has an English language declaration, a descriptive product
title, matching search/social descriptions, image alt metadata, the existing
canonical, and factual WebSite structured data. A dedicated App effect preserves
the public title instead of overwriting it on mount; login and authenticated
views use the existing Indonesian language and short brand title.

`robots.txt` points to a valid sitemap containing only the public homepage.
API and auth-handler exclusions are crawler guidance, not access controls.
No private routes, login hash, ratings, fictitious prices, or rich-result promises
appear in the sitemap or schema.

Verification: the landing browser test checks initial metadata with JavaScript
disabled, parses structured data and sitemap XML, and verifies title/language
through public/login/back. Six viewport tests cover the unchanged interactions
and new copy. The authenticated fixture test also checks title and language
after login and after reopening the root URL. Impeccable detector: no findings.

Production QA note: the first runs encountered intermittent `decode()` errors
before a lazy image had selected its source. A browser diagnostic captured
`currentSrc: ""`, `complete: false`, and zero natural width immediately after
scrolling. The test now waits for an actual selected, loaded, nonzero image
before decoding it. This does not retry broken images or bypass alpha/pixel
checks; a failed asset still times out. All five production assets returned
HTTP 200 with image/webp and decoded successfully in a separate browser check.

Remaining limitation: page content is still client-rendered, not prerendered.
The JavaScript-disabled check confirms metadata, not a fully usable static
landing page. Index coverage and ranking were not measured in Search Console.
English copy does not establish relevance for every Indonesian-language query.
No claim of a perfect SEO score, indexing, or a first-page position is made.

References: [Google title guidance](https://developers.google.com/search/docs/appearance/title-link)
and [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).
