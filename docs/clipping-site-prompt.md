# Reusable Claude prompt — Clipping software website in the NeuroAbsorption design language

Copy everything inside the block below into a new Claude session when building the
clipping-software site. It carries the full design system (colors, glow, motion,
editing style) from this app so the new site matches it exactly.

---

```
You are an elite full-stack engineer and motion designer. Build me a website for
my short-form CLIPPING SOFTWARE (a tool that turns long videos into viral clips
with kinetic captions). Use Next.js (App Router) + TypeScript + Tailwind CSS +
Framer Motion. Follow my established design system EXACTLY as specified below —
do not invent a different palette or style.

== BRAND COLOR SYSTEM (use these exact hex values) ==

Dark app surfaces (backgrounds, cards):
- surface:         #0b0e14  (page background)
- surface-raised:  #131722  (cards, panels)
- surface-overlay: #1b2130  (hover states, inputs)
- borders:         neutral-800 (#262626), 1px, rounded-xl/2xl corners
- accent:          #6366f1 (indigo), hover #818cf8
- highlight red:   #ef4444 (used sparingly, for focal markers)

Atmospheric sky palette ("atmos") — the signature brand colors, sunrise → midnight:
- Dawn Gold #FFC857 · Morning Coral #FF8A65 · First Light Lavender #E2C0FF
- Zenith Azure #3A86FF · Classic Sky #87CEEB · Horizon Mist #DCEEFA
- Sunset Amber #F06543 · Crimson Horizon #D9381E · Twilight Violet #7B2CBF
- Blue Hour Indigo #1D2D50 · Midnight Sky #0B132B · Starlight Slate #1C2541
Rules: Midnight Sky #0B132B replaces flat black everywhere (it reads warmer and
organic). Brand gradient for headlines/CTAs/progress bars: linear left-to-right
from #FFC857 via #FF8A65 to #7B2CBF, often as bg-clip-text on bold titles.

Scene gradients (hero/section backgrounds — layered, top to bottom):
- Dawn:   #0B132B 0% → #1D2D50 30% → #7B2CBF 56% → #FF8A65 82% → #FFC857 100%
- Day:    #1D2D50 0% → #3A86FF 55% → #87CEEB 85% → #DCEEFA 100%
- Sunset: #0B132B 0% → #1C2541 26% → #7B2CBF 50% → #D9381E 76% → #F06543 92% → #FFC857 100%
- Night:  #0B132B 0% → #1D2D50 55% → #1C2541 100%
- Midnight (default): radial-gradient(120% 90% at 50% 115%, #1C2541 0%, #0B132B 65%)

== KINETIC TEXT / CAPTION STYLE (the product's signature) ==

Words appear big, bold, glowing — like premium short-form captions:
- Font: heavy sans (font-extrabold, tracking-tight); sizes text-5xl→8xl.
- Glow formula (text-shadow, where C is the theme color):
  0 0 14px C88, 0 0 42px C55, 0 0 90px C2e
- Theme colors: Gold #fde047 (glow #facc15), Neon cyan #67e8f9 (#22d3ee),
  Violet #c4b5fd (#8b5cf6), Ember #fdba74 (#f97316). Emphasized word inside a
  phrase flips to pure white with the same glow.
- "Aurora" mode: caption color drifts through
  #fde047 → #6ee7b7 → #67e8f9 → #93c5fd → #c4b5fd → #f9a8d4 → #fdba74,
  changing every ~5 words with 0.3s color/glow transitions.
- Word entrance: opacity 0.15→1 (or scale 0.92→1), 40–120ms.
- Micro-shake option: x keyframes [2,-2,1,0] over 0.12s as each word lands.
- Emphasis: important words (sentence-enders, long words) render ~12% larger.
- Over imagery, always put a readability veil first:
  gradient black/70 → black/45 → black/75, then the text.

== EDITING / MOTION LANGUAGE ==

- Backgrounds behind captions: full-bleed images with slow Ken Burns drift
  (scale 1 → 1.08 over ~10s, linear) and 1.6s opacity crossfades between images;
  rotate randomly, never the same image twice in a row.
- Ambient "breathing glow": a radial gradient light source low in the frame
  (55% 42% at 50% 80%, themeColor at ~33% alpha → transparent), animating
  opacity 0.35 → 0.75 → 0.35 on a 9s ease-in-out loop.
- Progress indication: hairline bar (h-0.5) along the bottom edge in accent or
  the brand gradient; percentage in tiny dim mono text.
- HUD/stats: small monospace text in dim neutral-600, pinned to corners
  (top-right for stats, bottom-left for hints); never competes with the content.
- Fullscreen/immersive views: content only, controls as small icon buttons in
  bg-black/50 backdrop-blur rounded-lg chips; tap-anywhere to play/pause.
- Cards animate in with opacity+y(8-12px) springs; bars/rings animate width or
  strokeDashoffset 0.8s ease-out on first view.
- Micro-interactions: hover transitions 150ms; active tabs/pills get bg-accent
  with white text; inactive are neutral-400 that brighten on hover.

== SITE TO BUILD ==

Landing page for the clipping tool with: hero on a Sunset or Midnight scene
gradient with an animated kinetic-caption demo (words flashing in gold glow over
a Ken Burns image, exactly per the caption spec above); features section as
surface-raised cards with lucide icons; a live "caption style picker" showing
the Gold/Neon/Violet/Ember/Aurora themes; pricing cards; and a waitlist/signup
form. Include an in-browser demo editor mock: video frame area with caption
preview, a timeline strip, theme picker, WPM/speed-style slider, and export
button — all styled with this system. Dark theme only, Midnight Sky base.
Make it responsive and keep all animation 60fps-friendly (transform/opacity
only). Use Georgia serif only for long-form quotes; UI text is the sans stack;
numbers are always monospace.
```
