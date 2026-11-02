# Instructions for the agent building this app

You are building the first version of **JTS Lights for iPhone**, to be tested by Andrew in the
iOS Simulator. Everything you need is in this repo; the server and firmware code are not here and
you don't need them.

## Read first, in this order

1. `docs/DESIGN.md`: the agreed design, every screen, states, visual tokens, build plan.
2. `mockups/your-house.html`: open it in Safari and click through it. It is the reference for
   layout, wording and interaction. `mockups/screens/*.png` are stills of each screen.
3. `docs/API.md`: the cloud API contract (what exists, and what is proposed and must be mocked).
4. `docs/WLED-PRIMER.md`: controller behaviour that will bite if ignored.
5. `reference/`: `mock-data.json` (a complete fake account), `looks.json` (89 ready-made looks,
   exported from the web app's catalogue), `holidays.js` (the same catalogue plus its `resolve()`
   rule), `effects-preview.js` (how the web app approximates WLED effects for previews).

## Ground rules

- **SwiftUI, iOS 17+, Swift 5.9+**, `@Observable` models, async/await. No third-party
  dependencies in v1 unless there is a clear reason; ask first.
- Start with **mock mode** (DESIGN §9): every screen working against `reference/mock-data.json`
  and the bundled sample photos, no network. Live mode comes after Andrew has tried the mock.
- Build the screens exactly as designed. If something in the design doesn't work on iOS, or you
  want to deviate, write the question in `docs/QUESTIONS.md` and pick the closest option rather
  than inventing a new flow.
- The house picture with animated lights is the centre of the product. Make it smooth
  (`Canvas` + `TimelineView`), correct (normalised coordinates, glow, dimming of unpicked lines)
  and tappable (≥44 pt hit areas around each line).
- Camera isn't available in the Simulator: use `PhotosPicker` and the sample photos in
  `mockups/sample-photos/` (add them to the asset catalog for DEBUG builds).
- **The server address is user data, never a constant.** The default lives in one place.
- **No secrets in the repo.** No tokens, passwords or account emails in code, plists, tests or
  commits. Live mode asks for the email and password at runtime and keeps the token in the
  Keychain.
- **Commits:** small and descriptive. Do not mention AI, Claude or any assistant in commit
  messages, code comments, branch names or PR text, and add no `Co-Authored-By` lines.
- Keep `README.md` current: how to open, build and run in the Simulator, and what works.
- Record decisions and anything non-obvious you learn in `docs/NOTES.md` with absolute dates.

## Definition of done for the first build

- Opens in the Simulator to the Welcome screen; "Skip" goes to the House tab with the mock
  account.
- Photo flow: pick a sample photo → scanning → lines (from `autoTraceResult`) with draggable
  corners, tap to leave out, add a line → matching (the mock simulates "lit" by highlighting the
  right line) → which end → done → House tab draws the new lines.
- House: chips, tappable lines with badges, dimming, now-showing card with "Mixed", brightness,
  power, "Not on this photo" cards.
- Looks: search, occasion and pace filters, animated tiles, first tap previews on the mini house,
  second tap applies to the picked zones, "Showing now".
- Colour: three slots with roles, wheel dragging updates the picked zones live, candle↔daylight,
  swatches.
- "Which lights?" and "Copy to…" sheets working against the mock model.
- Times and Setup as placeholders (Setup → House photo restarts the photo flow).
- Sign-in screen with the server field and check (DESIGN §4.0, API §0); in mock mode it can
  accept anything.
- VoiceOver labels on the picture's lines, Reduce Motion respected.
