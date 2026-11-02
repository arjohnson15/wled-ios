# WLED facts the app depends on

Learned the hard way on Andrew's hardware (WLED 16.0.1 fork, `arjohnson15/WLED`, branch
`v16-house`). Each of these has already caused a real bug once.

1. **Zones are segments.** `state.seg[]`, addressed by `id`. Always send explicit ids. A `seg`
   write without `id` goes to every segment with `sel: true`.
2. **Effect and palette ids are not stable.** They are indexes into `/json/eff` and `/json/pal`,
   which differ between builds. Store and compare by **name**. The looks catalogue
   (`reference/looks.json`) lists names with fallbacks; first match wins.
3. **Three colour slots, and what they mean depends on the effect.** The 2nd field of an effect's
   `/json/fxdata` metadata (`"sliders;colours;palette;flags;defaults"`) names the slots, e.g.
   `"Fx,Bg"`; empty means the effect ignores that slot. The design shows all three and dims the
   unused ones.
4. **Palettes.** Palette 0 ("Default") lets three-colour effects use slots 1-3. Palettes whose
   names start with `*` ("* Color 1", "* Colors 1&2", "* Color Gradient", "* Colors Only") are
   built from the slots; every other palette ignores the colours you set. Palette names often
   don't describe their colours ("Red & Blue" is purple-magenta).
5. **Some effects are 2D-only** (flags field contains `2` but not `1`). On a roofline they light
   nothing. Hide them.
6. **Sliders and checkboxes persist** across an effect change unless the write sets them. Always
   send `sx`, `ix`, `c1-c3`, `o1-o3` with a new effect.
7. **Gamma 2.2 at output.** Any channel below ~15 comes out as 0, so a "dark blue background" of
   `[0,2,12]` is black on the house. The screen preview should not pretend otherwise.
8. **Brightness is per controller** (`bri` 0-255); a zone also has its own `bri`, which the app
   leaves at 255.
9. **Freezing.** Sending `i` (per-pixel colours) freezes the zone (`frz: true`) until `frz: false`.
   Used for the "light one zone" matching step. Always unfreeze.
10. **The controller is small.** Relayed requests are answered from the same loop that animates
    the lights. Don't poll; use the WebSocket. Throttle drags to one write in flight, ≥120 ms apart.
11. **Reserved scene slots.** Presets 249 ("Turn on") and 250 ("Turn off") are used by schedules.
    Don't show or overwrite them.
12. **`info.time`** is the controller's own clock in its local time zone
    (`"2026-11-2, 21:58:07"`). Schedules run by it, not by the phone.
13. **House order** (`ledmap` 1) is a mode where one zone runs left-to-right across the whole
    house. When `state.ledmap == 1` the controller has a single zone covering everything; the
    photo lines still show the physical runs. Don't fight it in v1: treat that controller as one
    zone named after the controller.
