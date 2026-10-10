# Landing Mascot Poses

Generated with the built-in `image_gen` tool on 2026-10-11, using
`public/landing/mascot.png` as the identity reference. Four new poses were
explicitly requested by the owner. The original pointing artwork is retained.

Final assets in `public/landing/`:

| Asset | Role | Bytes |
| --- | --- | ---: |
| mascot-wave.webp | Welcome in the hero | 37,734 |
| mascot-think.webp | Review records beside the AI introduction | 38,456 |
| mascot-save.webp | Saving goals in the connected-records section | 36,192 |
| mascot-guide.webp | Point toward the actual app features | 36,862 |
| mascot-cheer.webp | Encourage the closing next step | 40,882 |

Each final file is a transparent 512x512 WebP, encoded at quality 0.88 from
the generated PNG with browser canvas. This is only resizing/encoding; no
creative changes were made outside the image tool. Total: 190,126 bytes.
The guide is an optimized sibling of the original, not a generated redesign.
Below-hero images are lazy-loaded with explicit square dimensions. Existing
single greeting/reduced-motion behavior is preserved; no perpetual animation
or new animation dependency was added.

## Prompt Set

Each request used `transparent_background: true` and the original mascot as
`referenced_image_paths`. The shared identity constraint was: preserve the
orange/golden tabby, three forehead stripes, cream muzzle, large brown eyes
with white highlights, rosy cheeks, thick dark-brown outlines, small body,
striped curved tail, purple waistcoat with two gold buttons and pockets, and
soft-shaded polished 2D rendering. Keep the whole body within the frame with
transparent margins. No background, drawn checkerboard, words or watermark.

### Wave

Create ONE new full-body pose of this exact character cheerfully waving hello
with one raised open paw, other paw relaxed by its purple waistcoat. Match the
reference's face proportions and colors exactly. Remove the wooden pointer.
Front-facing welcoming expression, both feet visible. Single centered isolated
character with 8 percent transparent margin, truly transparent alpha, no text,
letters, extra cats, logo or watermark. A consistent pose variant, not a redesign.

### Think

Create ONE full-body pose of the same orange golden tabby thoughtfully reviewing
a small purple tablet held in one paw, with the other paw touching its chin, a
friendly thoughtful smile and attentive open eyes. Tablet has a few simple
green chart bars, no numbers or text. No pointer, other outfit or glasses.
Entire body, ears, paws, tablet and feet inside the frame. Centered isolated
character with 8 percent transparent margin. No floor, cast shadow or props
beyond the tablet.

### Save

Create ONE full-body pose of the same cheerful orange tabby dropping a single
plain gold coin into a small mint-green piggy bank held at waist height in its
other paw. Smile warmly and look at the piggy bank. No pointer. Entire body,
both feet, coin and piggy bank inside the frame, with transparent margin.
Small piggy bank, do not obscure the whole waistcoat. No numbers, currency
symbols, confetti or additional characters.

### Cheer

Create ONE full-body pose giving a clear cheerful thumbs-up with one paw, other
paw on hip, one eye winking and the other eye open with the same large brown
eye and white highlight, friendly happy smile. Both feet on the ground and
tail curved. Remove the pointer, add no props, confetti, stars, clothing changes
or extra limbs. Center the complete character with 8 percent transparent margin.
A reassuring encouraging expression, not a dramatic celebration.

## Verification

The public browser test checks all five distinct assets at six viewport sizes:
successful decode, 512px source width, transparent corner pixels, nonblank
opaque character pixels, viewport bounds, and no overlap with the AI, savings
or gallery headings. Screenshots cover desktop and mobile; existing login,
all local controls and reduced-motion tests remain in place.
