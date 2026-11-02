# JTS Lights for iPhone: "Your house" design

Status: agreed direction, 2026-11-02. Nothing in this repo is built yet. This document is the
brief for the first build, which will be tested in the iOS Simulator.

**See it first.** Open `mockups/your-house.html` in Safari (on a Mac, or on an iPhone, where it
runs full screen like the app). Everything in it is clickable. `mockups/screens/*.png` are
stills of every screen at 390×844 @2x, in flow order. `mockups/three-directions.html` shows the
three directions considered before this one, for context only.

---

## 1. What the app is

JTS Lights controls permanent house lighting: addressable LED pixels (about one every 2 inches,
so ~1000 along a roofline) driven by small WLED controllers (ESP32 boards) fixed in the attic
or garage. Owners usually have several controllers, sometimes at more than one address, and
can share them with family.

The app talks only to a **JTS cloud panel**: `https://wled.cloudjohnson.com` by default, or any
self-hosted one the user names at sign-in (§4.0). The cloud relays
everything to the controllers over a link they hold open, so the phone never needs to be on
the same network as the lights. See `docs/API.md`.

The design idea in one sentence: **your house is the remote.** A photo of the house is the
home screen, the light lines on it glow in whatever the real lights are showing, and you pick
what to change by tapping the house.

### The three things Andrew asked for

1. **Photo → roofline, automatically.** Take a picture of the house; the app finds the lines
   the lights run along. AI is acceptable for this. Then each line is matched to the lights
   that drive it.
2. **Change several controllers at once.** Pick any mix of controllers and zones, including
   ones in another place or shared with you, and change their look or colour together. This
   is a selection, not a sync: nothing stays linked afterwards, and anything you didn't change
   stays different on each one. (Andrew uses WLED's sync today; it is hit and miss, and often
   he does *not* want them identical.)
3. **Copy to…** Copy what one controller (or zone) is showing to others you can access, once.

On top of that he chose the **dedicated Colour and Looks pages** from direction A (a tab each,
not a sheet).

---

## 2. Vocabulary (use these words in the UI)

| Word in the UI | What it is | WLED term |
|---|---|---|
| **Controller** | One box, e.g. "House", "Garage" | device |
| **Zone** / the line's name | A named stretch of lights on a controller, e.g. "Front roof" | segment (`seg`, by `id`) |
| **Line** | A zone drawn on the house photo | photo run |
| **Look** | A ready-made combination of effect, colours, palette and speed, e.g. "Candy cane" | preset-like bundle (`reference/looks.json`) |
| **Colour 1 / 2 / 3** | The three colour slots a look uses; the role under each changes with the effect ("Stripe", "Base", "Twinkle"…) | `col[0..2]` |
| **Place** | Where a controller is: Home, Lake house, Shared with you | ours, not WLED's |
| **Picked** | What the next change applies to | client-side selection |

Never show users: segment, preset id, palette id, fx id, bus, GPIO, "sync".

---

## 3. Navigation

A bottom **tab bar**, five tabs, always visible on the main screens:

| Tab | SF Symbol suggestion | Screen |
|---|---|---|
| House | `house` | Home: the photo, the picked lights, power, brightness |
| Looks | `square.grid.2x2` | Ready-made looks with live preview on your house |
| Colour | `circle.circle` / `paintpalette` | Colour wheel, three slots, candle↔daylight |
| Times | `clock` | Schedules (placeholder in v1) |
| Setup | `gearshape` | House photo, Keep in step, wiring, family (placeholder in v1 except "House photo") |

The **onboarding flow** (Welcome → Camera → Check lines → Match) is full screen with no tab bar.
Sheets ("Which lights?", "Copy to…") slide up over any tab.

**The selection is global.** The same picked set drives House, Looks and Colour, so you pick
once on the house and then go to Looks or Colour to change them. Looks and Colour show it in a
**"Changing: House + Garage (roof) · Pick ▾"** bar that opens the "Which lights?" sheet.

---

## 4. Screens

Screen stills are referenced as `[NN]` → `mockups/screens/NN-*.png`.

### 4.0 Sign in, and which server

The panel can be hosted by anyone, so the server is chosen at sign-in, not built in.

- The sign-in screen shows email and password, and under them **"Server: wled.cloudjohnson.com
  · Change"**. Most people never touch it.
- **Change** opens a field ("Your panel's address, e.g. lights.example.com") and a **Check**
  button. The app checks it is a JTS panel (API §0) before any password is sent, and says
  plainly what is wrong otherwise: "Can't reach that address", "That address isn't a JTS Lights
  panel", "This panel needs a newer version of the app".
- Opening an invite link sets the server automatically.
- **Setup → Account** shows the server and the signed-in email, with **Change server** (signs
  out) and **Sign out**.
- If the panel moves to a new address and the old one redirects, the app follows on its own
  (API §0). If the old address is simply gone, the user sees "Can't reach your panel" with
  **Change server**.
- One server at a time in v1; several accounts is not designed.

### 4.1 Welcome `[01]`

- Eyebrow "WELCOME", title "Put your house on screen", one sentence of explanation.
- A night render of a house with glowing lights (in the app: the sample photo with animated
  lights, or an illustration).
- Three numbered steps: **Take a photo** (dusk or daylight, every roofline in frame) · **Check
  the lines** (drag a corner if one is off) · **Match them up** (each zone lights up and you tap
  where).
- Primary button **📷 Take a photo of my house**. Secondary text button **Skip and show me the
  finished app** (in the real app: "Not now"; the home screen then falls back to the list layout,
  §4.10).
- Shown on first launch after sign-in when the account has no house photo, and from Setup →
  House photo.

### 4.2 Camera `[02]`

- Full-screen camera with corner brackets and the hint "Stand across the street and get every
  roofline in". Shutter button, "Library" on the left (pick an existing photo), zoom on the right.
- Landscape and portrait both allowed; the photo is stored as taken.
- **Simulator:** there is no camera. Use `PhotosPicker` and the bundled sample photos in
  `mockups/sample-photos/` (`house-dusk.png` is the "daytime" photo; `house-night.png` is what
  the home screen looks like once lit).

### 4.3 Check the lines `[03] [04]`

- Header "‹ Retake" / "Step 1 of 2".
- While working: title "Finding your roofline…", subtitle "Looking for the edges a string of
  lights would run along.", the photo with a scanning band sweeping down. Typically 3-10 s on
  the real service, so it needs a cancel and a timeout message.
- Result: title "Found 3 light lines", each line drawn in brand blue with a glow, labelled
  **A, B, C**, with a white **handle at every corner**.
  - **Drag a handle** to move that corner (show a magnifier loupe under the finger on a phone;
    the mockup doesn't, the app should).
  - **Tap a line** to leave it out (it turns into a dashed grey line labelled "A · left out");
    tap again to bring it back.
  - **+ Add a line**: drag from corner to corner to draw one the detector missed. Tap to add
    more corners; double-tap or "Done" to finish.
- Help card: "The lines are a best guess, so expect a corner or two to be a little off. Drag a
  white dot to move a corner. Tap a line with no lights on it to leave it out."
- Primary button **Looks right** (disabled when no lines remain).
- The mockup's lines are deliberately a few pixels off, to show why the handles are there.

### 4.4 Match the lines to the lights `[05] [06] [07]`

Goes through **every zone of every controller the user owns at this place**, one at a time.

1. **Tap the lit line** `[05]`: card reads "● House, Front roof, is lit now · Look at your house
   and tap the line on the picture that's lit." Behind the scenes that zone lights up solid
   with its **first pixel green**, and every other zone on that controller goes dark (API.md
   §6.2). Lines already matched are green and labelled with their zone. Secondary button **It
   isn't on this photo** skips the zone (it will appear under "Not on this photo" at home).
   (In the mockup the correct line blinks on the picture, because there is no real house to
   look at.)
2. **Which end is green?** `[06]`: the tapped line goes white and both ends pulse. "The first
   light on that zone has turned green. Tap that end, so effects run the right way along the
   line." Tapping the far end reverses the line's point order. **‹ That was the wrong line**
   goes back.
3. Repeat for each zone. Progress "Zone 2 of 3".
4. **Done** `[07]`: "All matched: 3 lines on 2 controllers · Your lights now draw on the
   picture, in the right order. You can redo this any time under Setup → House photo."
   **Open my house**.

On finish (and on cancel, and if the app is backgrounded), **restore every zone that was
lit or darkened** (API.md §6.2). Never leave a controller frozen.

Saving: `PUT /api/photos/:pid/runs` with one run per matched line (`deviceId`, `segId`,
`name` = zone name, `ledStart`, `ledCount` from the zone, `points` normalised 0..1 in pixel-1
order).

### 4.5 House (home) `[08] [09] [10]`

Top to bottom:

- Eyebrow = the place ("HOME"), title "Your house", and a **power switch** on the right that
  turns the *picked* controllers on/off (all on → turns off; otherwise turns on).
- **Controller chips**, horizontally scrolling: one per controller the user can reach, all
  places. Chip states: ✓ filled (all its zones picked), "–" dashed outline (some zones picked),
  empty (none). Controllers not at this place carry a small "away" or "shared" suffix. Tapping
  a chip picks/unpicks all its zones.
- **The house photo**, full width, at night tint, with every matched line drawn as a row of
  **glowing dots, animated with what the lights are actually showing** (§7). Each line has a
  small name **badge** at its midpoint: blue with "✓ Front roof" when picked, dark when not.
  - **Tap a line or its badge** to pick/unpick that zone.
  - Lines that are not picked are **dimmed to ~40% opacity** whenever something is picked, so
    the picture shows exactly what the next change hits.
  - Pinch to zoom on a large house (not in the mockup).
- Hint line: "Changes go to **House and Garage (roof)**. Tap a line on the picture to add or
  remove it. The dimmed lines are left as they are."
- **Now showing card**: title = the look name ("Candy cane", or "Candy cane (changed)" after a
  colour edit, or **"Mixed: 2 different looks"** when the picked zones differ), subtitle = where
  ("On House + Garage (roof)") or the list of looks when mixed. Buttons: **Change look ›** (→
  Looks tab), **Colour** (→ Colour tab), **Copy to…** (sheet, §4.9).
- **Brightness** slider, full width, 46 pt tall, warm fill, "☀" left and "70%" right. Applies to
  every picked controller. When they differ it shows the average and moves them all to the new
  value.
- **Not on this photo**: one card per zone that has no line (other places, shared controllers,
  skipped zones). Each card: round tick (picked or not; tap the card to toggle), controller
  name, "zone · look", a small live strip of dots, and its own power switch.

Empty selection: the card says "Nothing picked. Tap a roofline on the picture, or a name above.",
brightness is disabled.

### 4.6 Looks `[11] [12]`

- Title "Looks", **Copy to…** pill top right.
- "Changing … · Pick ▾" bar.
- **Mini house**: the same photo, smaller (cropped to the roof area), live.
- Hint: "Tap a look to see it on your house. Tap it again to use it."
- Search field ("Search looks"), then two chip rows: **occasion** (All, Everyday, Christmas,
  Hanukkah, Halloween, …, from `reference/looks.json` `occasions`) and **pace** (Any pace, Still,
  Slow, Medium, Fast).
- Two-column grid of **look tiles**: an animated strip of dots on top, the name, and
  "Occasion · Pace". The tile already showing on all picked zones has a green border and
  "● Showing now".
- **Interaction** (this rule is used across the existing web app too):
  - **First tap = preview.** The tile gets a blue border and "Tap again to use it"; the mini house
    shows that look **on the picked lines only**; nothing is sent to the lights. The hint reads
    "Showing **Icicle twinkle** on the picture only. Tap it again to put it on House + Garage (roof)."
  - **Second tap = apply** to every picked zone (API.md §6.3), toast "Icicle twinkle is on House
    + Garage (roof)".
  - Tapping another tile moves the preview. Leaving the tab cancels the preview.
- Looks marked `flashing: true` in the catalogue carry a small "Flashes" label.
- A look whose effect a controller doesn't have resolves to null there (`resolve()` in
  `reference/holidays.js`); apply it to the others and say "Not available on Mom's porch".

### 4.7 Colour `[13]`

- Title "Colour", the "Changing … · Pick ▾" bar, the mini house (live).
- **Three slot buttons**: swatch circle, "Colour 1/2/3", and the role underneath, which depends
  on the effect ("Stripe / Stripe / not used now", "Base / Twinkle", "Flame / Embers"…). Slots
  the current effect doesn't use are dimmed and say "not used now" but stay selectable. The
  selected slot has a blue ring. Shows the colours of the first picked zone.
- **Colour wheel**, ~220 pt, hue around, saturation outward, with a knob showing the current
  slot's colour. **Dragging streams the colour to every picked zone live** (throttled, API.md
  §6.6), so the real house follows the finger. The wheel must not be rebuilt while it is being
  dragged (this was a real bug on the web app: the panel re-rendered under the finger and
  closed).
- **Candle ↔ Daylight** slider (1900 K → 6500 K) for whites, same live behaviour.
- A row of 8 swatches: warm white, cream, white, red, green, blue, purple, orange.
- If a picked zone is on a look that makes its own colours (e.g. Rainbow), toast once: "Rainbow
  makes its own colours, so those lights won't change".
- After any colour change, the zone's look name gets "(changed)".

### 4.8 "Which lights?" sheet `[14]`

Opened from any "Changing … · Pick ▾" bar, or when the user tries to change something with
nothing picked.

- Title "Which lights?", sentence: "Changes go to everything ticked, on whichever controller it
  is. Anything you don't change stays as it is on each one."
- Shortcuts: **Everything on the photo**, **Everything**, **None**.
- Grouped by place ("AT HOME · ON YOUR PHOTO", "LAKE HOUSE", "SHARED WITH YOU"). Each controller
  is a row with a round tick (✓ / – / empty), its name, and its current look or "off". Under a
  controller with more than one zone, a chip per zone.
- **Done**.

### 4.9 "Copy to…" sheet `[15]`

- Title "Copy to…".
- **From**: a picker of every zone ("House · Front roof"), defaulting to the first picked zone.
  Under it a live strip of the source and its look name.
- **What to copy**: four toggle chips, **The look** (effect, palette and their sliders),
  **Colours**, **Speed** (speed and intensity), **Brightness** (controller brightness). First
  three on by default.
- **To**: every other zone the user can control, grouped by controller ("Lake house", "Mom's
  porch · shared with you"), each a checkbox row showing what it shows now.
- Primary button reads **Copy to 1 light / Copy to 3 lights**, or "Tick where to copy it" /
  "Choose what to copy" (disabled) when it can't run.
- Footnote: "A one-off copy. They won't stay in step afterwards; that's "Keep in step" in Setup."
- Result toast lists where it went; any controller that failed is named ("Mom's porch is
  offline").
- A copy to an **off** controller turns it on.

### 4.10 No photo yet

Until a photo is matched, House shows the same chips, a list of controller cards (name, live
strip, power switch, tick to pick) instead of the picture, and a card "Put your house on
screen →" that starts §4.1. Everything else works the same. This is also what a household
member sees if the owner's photo isn't shared with them (open question §11).

### 4.11 Times and Setup (v1 placeholders)

Times: show the mockup's static timeline card and two rows; label "Coming soon". Setup: a list
with **House photo** (retake / redo the matching), and rows for Keep in step, Lights & wiring,
Who can use it, that open "Not in the app yet, use the web panel" with a link to
`https://wled.cloudjohnson.com`.

---

## 5. States and edge cases

| Situation | Behaviour |
|---|---|
| Controller offline | Its lines draw as dark grey dots, its chip shows a small "offline" suffix, it can still be picked but changes skip it and the toast says so. `device.online` and WS `device` events (API §5). |
| Controller "stalled" (`stalled: true`) | Same as offline, wording "not answering". |
| View-only role (`role: "view"`) | Can pick and preview, cannot apply: buttons say "View only" and are disabled for those zones. |
| Mixed selection | Now-showing says "Mixed: N different looks"; Colour shows the first picked zone's colours; applying sets all picked zones. |
| Nothing picked | Change buttons open the "Which lights?" sheet instead. |
| A write fails on one controller | Others still apply (independent requests); toast "Applied to 2 of 3 · Garage didn't answer". Never roll back the others. |
| Look not available on one controller | Apply to the rest, toast names the one skipped. |
| Network gone | Banner "No connection", controls disabled, picture keeps the last state. |
| Signed out (401) | Back to sign-in. Sessions never expire on the server; a 401 means sign-out elsewhere or password reset. |

---

## 6. Visual design

Dark only in v1 (lights read best on dark). Values from the mockup's CSS:

| Token | Value | Use |
|---|---|---|
| `bg` | `#07090D` | screen background |
| `card` | `#151922` | cards, tiles |
| `card2` | `#1C212C` | chips, secondary buttons |
| `line` | white @ 8% (`#FFFFFF14`) | card borders |
| `line2` | white @ 15% (`#FFFFFF26`) | stronger borders, sheet top |
| `fg` | `#EEF0F5` | primary text |
| `dim` | `#B3BCCD` | secondary text |
| `mut` | `#8792A8` | captions, eyebrows |
| `brand` | `#0090F0` | selection, links, primary accents |
| `ink` | `#0A6FD8` | bottom of the primary button gradient (`#159CFF` → `#0A6FD8`) |
| `ok` | `#33D17A` | switches on, "showing now", matched lines |
| `warn` | `#FFB84D` | warnings |
| brightness fill | `#FFB35C` @ 27% → `#FFCF8A` | brightness slider |

- Type: SF Pro. Large title 26 bold (−0.03em), section title 19 bold, card title 15 semibold,
  body 14, caption 12.5, micro 11. Eyebrows 11 bold, uppercase, +0.14em tracking, `mut`.
- Corner radius: cards 20, tiles 16, buttons 14, chips fully round, sheets 26 (top only).
- Spacing: screen padding 16; gaps 8-12.
- Hit targets ≥ 44 pt (the house badges and line hit areas included: the mockup uses a 26 pt
  invisible stroke around each line).
- Switches are green when on (`ok`).
- Toasts: dark pill above the tab bar, ~2.8 s, also announced to VoiceOver.
- Brand: logo in `brand/` (`JTS_WLED.png` square, `JTS_WLED_wide.png` wide). App name "JTS Lights".

### Motion

- The lights on the house animate continuously (`TimelineView(.animation)` + `Canvas`); pause
  when the screen is not visible. Target 30-60 fps, cheap: ~100-300 dots per screen.
- Line drawing on "Found 3 light lines": each line strokes in over 0.9 s.
- Scanning band while tracing: 1.1 s per sweep, repeating.
- Sheets: standard iOS sheet presentation with detents (.medium, .large).

### Accessibility

- Every line on the photo is also reachable as a list (the chips and the "Which lights?" sheet),
  so the picture is never the only way to pick.
- VoiceOver labels: line badges "Front roof, House, picked, button"; brightness "Brightness,
  70 percent, adjustable".
- Respect Reduce Motion: stop the light animation (show each zone's colour 1), skip the line
  draw-in and scanning sweep.
- Dynamic Type on all text except the badges on the photo.

---

## 7. Drawing the lights on the photo

- A line is a polyline of normalised points (0..1 of the image's width/height). Sample along it
  at a fixed spacing (the mockup uses 6.5 units on a 360-wide image, ~1.8% of width) to place
  the dots, so dot spacing is even regardless of the real LED count.
- Each dot's colour comes from an **approximation of the effect** running on that zone, using
  the zone's own effect, colours, speed and the controller's brightness. Dots are drawn with a
  soft glow (blur ~2.6 pt behind each dot) over a dark cable line.
- v1: port the nine simple families in the mockup's `FX` table (solid, two-colour chase,
  three-colour chase, twinkle, multicolour, wave, breathe, candle, rainbow), mapping WLED
  effect names to them. Later: port `reference/effects-preview.js`, which approximates ~40 WLED
  effects faithfully (it is what the web app uses).
- When the controller is reachable, real colours are available via the live feed (API §5.2) and
  can replace the approximation for the selected controller. v1 can stay on the approximation.
- Brightness: scale colours by 0.25 + 0.75 × bri/255 so dim lights stay visible on screen.
- Off: dots `#22242A`, no glow.

The home picture is a **night-tinted** version of the photo: darken and cool the photo
(e.g. multiply by ~0.35, slight blue) so the lights pop. Don't ask for a second photo.

---

## 8. Data model (client)

```
Device      id, name, online, stalled, role (owner|configure|control|view), place, lanIp,
            follows, followers, state (from /json/state: on, bri, seg[])
Zone        deviceId + segId; name (seg.n), len, fx, pal, sx, ix, c1..c3, o1..o3, col[3]
Photo       id, name, image, runs[]
Run (line)  id, deviceId, segId, name, ledStart, ledCount, points[[x,y]] (0..1, pixel-1 first)
Selection   Set<ZoneRef>   // ZoneRef = (deviceId, segId); global, survives tab switches
Look        from reference/looks.json: id, occasion, name, pace, blurb, fx[names], pal[names],
            sx, ix, col[3], c1..c3, o1..o3, flashing?
```

"Place" is not stored on the server yet (§11). For v1 derive it: controllers with a run on the
photo → "Home"; `role != owner` → "Shared with you"; the rest → their own name or "Elsewhere".
`reference/mock-data.json` has a complete fake account in these shapes.

---

## 9. Build plan for the first version

1. **Mock mode first.** All screens against `reference/mock-data.json`, sample photos bundled,
   writes applied to the in-memory model, auto-trace returning `autoTraceResult` after a
   2 s delay. This is what Andrew tests in the Simulator.
2. **Live mode** behind the sign-in screen (§4.0, with the server field): real devices, state, live WS, apply/copy/brightness/
   power via the endpoints in API.md §6. Mock/live switch in a debug menu.
3. Photo upload and run saving against the real API (both exist today). Auto-trace and the
   zone-lighting step use the client-side mechanisms in API.md §6.2 / §7 until the server
   endpoint exists.

Out of scope for v1: schedules, setup/wiring, firmware updates, backups, curtains, AI scene
generation, household management, push notifications, widgets.

---

## 10. Why it's built this way (decisions)

- **Selection, not sync.** WLED's own sync mirrors everything and needs controllers on one
  network; the cloud's "mirroring" (`follows`) is permanent. Andrew's real use is "usually
  change them together, sometimes not", so the app picks per change and sends each controller
  its own write. One unreachable controller never blocks the others.
- **Preview before apply.** Applying a look to ~1000 pixels on a house is visible to the street;
  every look and effect in this product previews first (on the picture) and applies on the
  second tap.
- **Matching needs no AI.** Lighting one zone at a time with pixel 1 green tells the app which
  line is which zone and which way it runs, with no guessing. AI is used only to find the lines.
- **AI lines are expected to be off by a little.** Vision models find rooflines well but place
  corners a few pixels off; the handles are part of the design, not a fallback. The server may
  also snap each line to the nearest strong edge in the photo before returning it.
- **Names, never ids, for effects and palettes.** Ids change between firmware builds.

---

## 11. Open questions (ask Andrew; don't guess)

- **Places**: should "place" be a real thing on the server (a controller belongs to a place, a
  photo belongs to a place), with one photo per place? The design assumes one house photo per
  place; v1 handles one photo.
- Should household members see the owner's house photo? (Photos are per-user on the server
  today.)
- More than one photo of the same house (front and back)? Probably a swipe between photos on the
  House tab; not designed yet.
- Times and Setup content (direction B's schedule timeline is the likely Times design).
- Light mode: not planned.
