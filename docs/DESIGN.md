# Grow the Grid BC: design system

One page, one stylesheet (`src/styles/global.css`). Every value below is a token on `:root` or a fixed rule in this file. If a new style needs a value that is not here, add the token first, then use it.

## Colour

Light surfaces (text and UI sit on these):

| Token | Hex | Use |
|---|---|---|
| `--snow` | #f6fafb | Page background, light sections, panel |
| `--ice` | #e4eef0 | Alternating light section, nav, hero gradient end |
| `--ice-2` | #d3e3e6 | The action band (`#act`) only, the compose divider and the join-form divider |
| `--white` | #ffffff | Inputs, chips, text on orange buttons |

Ink and accents:

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--spruce` | #0d3a3f | Body text, headings, dark surfaces | 12.9:1 on snow |
| `--spruce-2` | #12494f | Card text, ledes, dark-button hover, chart track | 10.1:1 on snow |
| `--slate` | #4c6a70 | Muted text: hints, sources, labels, FAQ answers, chip borders on the wash. Never on ice-2 (4.41:1) | 5.55 snow, 4.94 ice |
| `--line` | #6f8b91 | Control borders on every surface, card rules on dark | 3.63 white, 3.46 snow, 3.41 spruce |
| `--marker` | #ff5a1f | Orange: art, bars, rules, focus ring on dark (never small text on light) | 3.98 on spruce |
| `--marker-ink` | #c93d0a | Orange button fill | white text 5.05:1 |
| `--marker-text` | #a8320a | Orange text on light; orange button hover | 6.39 snow, 5.09 ice-2 |
| `--marker-wash` | #ffe3d6 | The thank-you/share box (`.share.lit`) | spruce 10.2:1, slate 4.78:1 |

On the spruce surface (numbers band, footer, MLA card):

| Token | Hex | Use | Contrast on spruce |
|---|---|---|---|
| `--ice` | | Headings, strong text, links | 11.5:1 |
| `--on-dark-2` | #b9d1d5 | Body text | 7.76:1 |
| `--on-dark-3` | #9dbcc1 | Sources, captions, axis ticks, footer labels | 6.14:1 |
| `--rule-dark` | #1f4c52 | Dividers and the chart axis (decorative) | |

Art only: `--sky-far` #c3d8dc, `--sky-mid` #9fbfc5 (ridges, the 400 MW bar). Footer ridges use `--sky-mid`, `--slate`, `--spruce`.

Surface tokens: components read `--fg`, `--fg-2`, `--muted`, `--num` and `--card-rule`. `:root` sets them for light surfaces; `.numbers` resets them for dark. A card therefore needs no dark variant.

## Type

One family, Archivo variable. Display = weight 850, width 62% (`font-stretch` plus `'wdth' 62`). Reading = weight 400, width 100%.

| Role | Size | Weight / width | Line height | Where |
|---|---|---|---|---|
| Hero h1 | clamp(3.4rem, 10.5vw, 9.6rem) | 850 / 62 | 0.86 | Hero, 404 and privacy h1 use their own clamp, same style |
| Section h2 | clamp(2.6rem, 6.4vw, 5rem), max 16ch | 850 / 62 | 1 | Every section heading |
| Section h2, long | clamp(2.2rem, 4.6vw, 3.6rem), max 22ch | 850 / 62 | 1 | Only headings over 60 characters (`.long`, numbers band) |
| Sub-heading | clamp(1.9rem, 3vw, 2.4rem) | 850 / 62 | 1 | `.terms-h`, privacy h2, MLA name, footer brand |
| Card title | clamp(1.6rem, 2.4vw, 1.9rem) | 850 / 62 | 1 | Rule h3, `.stat-title` |
| Stat number | clamp(3.2rem, 6vw, 4.8rem) | 850 / 62 | 0.9 | `.stat-num` in every card family |
| Small number | 1.5rem (bar values 1.2rem below 860px) | 850 / 62 | 1 | Bar values, letter counter, 404 code |
| Statement | clamp(1.6rem, 3.2vw, 2.6rem) | 600 | 1.15 | `.opp-head` |
| Pull quote | clamp(1.15rem, 1.8vw, 1.45rem) | 600 | 1.3 | `.chart-note` |
| Hero lede | clamp(1.1rem, 1.7vw, 1.3rem) | 400 | 1.6 | Hero, 404 |
| Lead (`--fs-lg`) | 1.2rem | 400 or 700 | 1.6 | Section ledes, act intro, FAQ questions, step titles, footer intro |
| Body (`--fs-body`) | 1.0625rem | 400 | 1.6 | Everything else |
| Small (`--fs-sm`) | 0.95rem | 400-700 | 1.6 | Buttons in rows, chips, hints, notes, warnings, letter |
| Caption (`--fs-xs`) | 0.85rem | 400 | 1.6 | Sources, axis ticks, footer base |
| Label (`--fs-xs`) | 0.85rem uppercase, 0.06em | 700 | 1.2 | Card labels, "Rule n", footer column heads |

Text wraps with `text-wrap: balance` on headings and `pretty` on paragraphs, so no line ends on one word.

## Space

Scale: 4, 8, 12, 16, 24, 32, 40, 48, 72 px. Section and block rhythm use two tokens:

- `--section-y: clamp(80px, 11vw, 140px)`: top and bottom padding of every section (the hero's top included), the privacy page and the 404.
- `--block-gap: clamp(56px, 7vw, 80px)`: between two blocks in one section (chart to "also" cards, illustration to rules, rules to "A win for everyone", opportunity band to the h2).
- Intro (h2 + lede) to its content: 48px. Lede under h2 on one column: 24px.
- Card grids: 40px gaps both ways, 3 columns at 861px and wider, 1 column below; rules are 2 columns.
- Page gutter: `.wrap` = min(1180px, 100% - 48px).

## Radii, borders, shadow

- Radius: 6px controls and buttons (`--r-sm`), 10px boxes: panel, MLA card, send check, share, reason chips (`--r-md`), 999px pills (`--r-pill`), 2px chart bars.
- Borders: 2px on every control. 3px top rule on every card. 2px FAQ row rules. 1px dividers on dark.
- Shadow: one, on the letter panel only.
- Focus: 3px `--marker-text` ring, 3px offset, 3px snow gap. On dark surfaces (numbers band, MLA card, footer): `--marker` ring with a spruce gap.

## Components (one style each)

- **Button** `.btn`: 1rem bold, padding 0.95em 1.6em, 2px border, radius 6, at least 44px tall. `.btn-hot` orange (primary, one per view), `.btn-ink` spruce (secondary solid), `.btn-line` outline, `.btn-ghost` white with `--line` border (chooser). `.nav-cta` is the small orange button (44px, `--fs-sm`).
- **Chip** `.chip` and the send-alt buttons: pill, 2px `--line` border, `--fs-sm` 600, 44px tall. `.chip-main` is the filled spruce primary chip.
- **Field**: white, 2px `--line`, radius 6, spruce border on focus, orange (`--marker-ink`) when missing.
- **Card** (every family: opportunity stats, "also", water, data, rules, wins): a list item with a 3px `--card-rule` top rule and 16px padding above, in this order:
  1. label `.stat-label` (optional; rules show "Rule n" in the same style)
  2. big number `.stat-num` or title `.stat-title` / rule h3, 12px below
  3. text, `--fg-2`
  4. sources `.srcs`
- **Sources** `.srcs`: its own line, 4px above, `--fs-xs`, `--muted`, underlined links with 6px vertical padding and line height 1.5 (32px tall targets), wrapping in a row with a 12px gap (no separator characters). Used in cards, ledes, the chart caption, the FAQ and the steps. Links inside a sentence stay normal body links.
- **Steps** `.how-steps`: a numbered list beside the flow diagram (stacked under it on phones); spruce number circle, `--fs-lg` bold title, `--slate` text, sources.
- **FAQ row** `details`: 2px spruce rules, `--fs-lg` bold question, orange plus.

- **Nav button** `.nav-cta`: the small orange button. It turns into a spruce outline (`.in-act`, `.nav-quiet` on `body`) wherever another orange button is in view: the hero, the letter tool, the footer, and the 404, privacy, confirm and unsubscribe pages.
- **Join form** `JoinForm.astro` (`.join`): heading, unticked consent checkbox with the exact consent text, email field and button, Turnstile slot, status line, note. Light version on the thank-you box (`btn-ink`, `--sky-mid` divider on the wash); dark version in the footer (`.join-dark`: `--ice` heading, `--on-dark-2` text, light `--ice` button so the footer keeps one orange button). Errors use `.join-msg.error` and mark the field with `.need`.
- **Share bubbles** `.bubbles`: 44px white circles, bottom-left (a column on desktop, a row on phones), shown only when the hero, letter tool and footer are out of view; a label appears beside a bubble on hover, focus and after every click.
- **Footer share** `.foot-social`: icon links plus Copy link, on spruce.
- **Status pages** `.lost`: the shared layout of the 404, confirm and unsubscribe pages (h1, lede, one action).

## Illustration

Line drawings share one style: spruce strokes (pylons 2.2px), round joins and caps, no gradients. Orange is only the wire pulse in the hero; no marker balls. Each pylon stands on the lower of its two leg points, sunk slightly into the ridge, so no leg floats on a slope. "How it works" is one flow diagram, not a scene: a filled "New clean power" box splits into a grey "own use" band and an orange "extra for everyone" band, with labels in the SVG (named with `aria-label`). The footer edge is three ridges only.

## Section rhythm

| Section | Background |
|---|---|
| Hero | snow to ice gradient, ridge art into spruce |
| Numbers (`#numbers`) | spruce |
| Term 1 detail (`#deal`) | snow |
| Term 2, data (`#sovereign`) | ice |
| Term 3, water (`#water`) | snow |
| Wins (`#wins`) | spruce (`.band-dark`, the close before the action) |
| Act (`#act`) | ice-2 (the one deeper band: the action) |
| FAQ (`#faq`) | snow |
| Footer | ridge edge on snow into spruce |

Light sections alternate snow and ice. Two adjacent sections never share a background, and no pair differs by less than snow to ice (1.12:1). The privacy page and the 404 sit on snow, so the footer edge always meets the same colour.
