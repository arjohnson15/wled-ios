/* Ready-made looks for the times of year people actually decorate for.

   Everything here refers to effects and palettes **by name**, never by id. Ids shift between
   firmware builds — that is the whole reason the AI request lists them explicitly — so a
   catalogue with numbers baked in would silently point at the wrong effect after an update.
   resolve() looks the names up against what the controller reports and returns null when
   nothing matches, so a look that cannot be rendered is hidden rather than applied wrong.

   2026-10-08 — rewritten for a roofline seen from the street, in two passes. The first pass
   leaned on permanent-lighting vendors (Trimlight, Gemstone, JellyFish, Oelo, EverLights, the
   extlighting.com and Christmas Light Emporium guides, sideshot/wled-christmas-presets) and came out
   mostly still and blocky. Andrew corrected it: "effects don't need to be still … they need to look
   good on a house … each pixel can be treated as individual colors sometimes … that's the whole
   point of having very close pixels." Vendor advice is written for bulbs 6–12" apart, where motion
   and per-pixel colour cannot work; at 2" they can. So the second pass keeps the good still looks
   and gives every occasion a spread — slow fades and twinkles, medium chases and colour waves, fast
   sparkles, comets and fireworks — with per-pixel colour wherever the effect is built for it
   (mini-light strings, twinkles, sparkles, flicker, alternating-pixel shimmers). `pace` on each
   entry says which: still / slow / medium / fast, and the test checks it against the preview.

   What still holds from the research: two or three colours per look, red never flashing against
   blue (emergency lighting), and anything that strobes is marked `flashing`.

   Scale. A pixel every 2" (six to the foot, about a thousand on the front, often four zones of
   ~250). Every size and speed in a blurb is counted from FX.cpp at that pitch, and the test pins
   the stripe widths to the sliders.

   The firmware rules every entry follows, each read out of v16-house's FX.cpp / FX_fcn.cpp:

   • color_from_palette(i, …, mcol) returns the segment colour in slot `mcol` ONLY on the
     Default palette. Three-colour effects (Solid Pattern Tri is the exception — it reads the
     slots directly) therefore use Default: on "* Color 1", "Chase 3" and "Tri Fade" lose their
     third colour.
   • Global gamma 2.2 is applied to every pixel at output (WS2812FX::show, gammaCorrectCol on by
     default), so a channel below 15 comes out as 0. Colours here are chosen as they look on a
     screen, and backgrounds that must show are kept well above that. "[0, 2, 12] dark blue" is
     black on the house.
   • The C9 palettes (C9, C9 2, C9 New) are raw output values from the pre-gamma days, so they now
     pass through gamma twice: on the house C9 New's green is 54/255 and its blue 43/255 next to a
     full red. For a mini-light string, "Colorful" at intensity 80-160 on Default draws the
     firmware's own bright red / gold / green / blue one pixel each, which is what is used.
   • Solid Pattern is 1+sx pixels of colour 1, then 1+ix of colour 2 — any widths, still.
     Solid Pattern Tri is three blocks of (ix>>5)+1 pixels, so at most 8 (16") — still.
     Chase 2 is two bands of 1+(ix>>4) pixels (≤16, 32"), one pixel per 50+(255-sx) ms.
     Chase 3 is three bands of the same width, one pixel per 50+2·(255-sx) ms.
     None of these can stop or reach other widths; a look's numbers are what they are.
   • Twinkleup keeps colour 2 lit at full as the base and swells (ix+1)/256 of the pixels to
     colour 1 and back on a sine of 16·(256-sx) ms. It is the twinkle with a lit base, so it is
     the one used wherever a twinkle sits on a colour.
   • Twinklefox dims colour 2 to between 1/16 and 1/3 for its background and then gamma darkens it
     further — its background is near-black whatever is set, so it is used only over black.
   • Meteor with "Smooth" (o3) and without "Gradient" (o1) colours the trail by looking its
     brightness up as a palette index: on "* Color 1" every pixel is colour 1 at full, the whole
     run fills, and the "Ghost" look was a solid bar. Gradient on makes it colour 1 scaled by the
     trail, which is the shape the name promises.
   • Tri Fade fades the whole run colour 1 → 2 → 3 → 1; one round is 65.5 s / ((sx>>3)+1).
   • DNA, DNA Spiral and Ghost Rider are 2D-only (they light nothing on a roofline); Glitter and
     Solid Glitter set one pixel per frame (nothing on a thousand); Fire 2012 burns only near
     pixel 0. None are used, and the test refuses them.
   • "Palette", "Spots" and Halloween Eyes size themselves from the zone's length, so the same
     look is coarser on one long zone than on four short ones. Their blurbs say so.
   • An effect's custom sliders and checkboxes persist unless a write sets them; every look
     carries c1-c3 and o1-o3 explicitly (firmware defaults, then the effect's declared defaults,
     then the entry's).

   • Meteor without "Smooth" colours its trail through mcol 0, so Default / "* Color 1" are fine;
     with Smooth on, Gradient (o1) must be on too (see above).
   • Glitter / Solid Glitter set at most ONE pixel per frame, and Fire 2012 burns only near pixel 0
     of each zone — those two are the scale problems that are real firmware facts, so they stay out.

   Anything that flashes hard is marked `flashing` so it is labelled rather than sprung on
   somebody. Red and blue never alternate quickly. What the source cannot tell us is how any of
   this looks on the real house; that is Andrew's eyes. */
(() => {
  // Colours are chosen as they look on a screen; the firmware's gamma maps them to the LEDs.
  const WARM = [255, 180, 105];       // ~2700 K on RGB pixels
  const AMBER = [255, 145, 30];
  const COOL = [225, 235, 255];
  const WHITE = [255, 255, 255];
  const RED = [255, 0, 0];
  const GREEN = [0, 200, 40];
  const BLUE = [0, 50, 255];
  const ICE = [140, 190, 255];
  const NIGHT = [0, 40, 150];
  const GOLD = [255, 205, 50];
  const YELLOW = [255, 200, 0];
  const ORANGE = [255, 120, 0];
  const BURNT = [255, 70, 0];
  const PURPLE = [150, 0, 230];
  const TOXIC = [90, 255, 0];
  const PINK = [255, 110, 170];
  const BLUSH = [255, 215, 230];
  const CRANBERRY = [190, 0, 30];
  const CREAM = [255, 215, 160];
  const GHOST = [215, 225, 255];
  const LAVENDER = [185, 140, 255];
  const MINT = [130, 255, 175];
  const SKY = [110, 200, 255];
  const OFF = [0, 0, 0];

  // fx / pal are lists: the first name the controller actually has wins. c1-c3 / o1-o3 are the
  // effect's custom sliders and checkboxes; anything not given here falls back to the effect's
  // own declared defaults, then the firmware's.
  //
  // Sizes in blurbs: a pixel is 2", so 6 pixels = 1 ft.
  const list = [
    // ---------------------------------------------------------------- everyday ----
    // Everyday is ambient, so it is the one occasion allowed to be mostly still.
    { id: 'every-warm', occasion: 'Everyday', name: 'Warm white', pace: 'still',
      blurb: 'Steady warm white the whole way along. Not a display; the one that gets used most.',
      fx: ['Solid'], pal: ['Default'], sx: 128, ix: 128, col: [WARM, OFF, OFF] },
    // Solid Pattern: 1+sx lit, 1+ix dark — a 4" point every foot, where C9 bulbs sit
    { id: 'every-bulbs', occasion: 'Everyday', name: 'Warm white bulbs', pace: 'still',
      blurb: 'A 4-inch point of warm white every foot with dark between, like a string of C9 bulbs. Still.',
      fx: ['Solid Pattern'], pal: ['Default'], sx: 1, ix: 3, col: [WARM, OFF, OFF] },
    { id: 'every-amber', occasion: 'Everyday', name: 'Soft amber', pace: 'still',
      blurb: 'Steady amber, warmer and lower than white. Kind to the neighbours.',
      fx: ['Solid'], pal: ['Default'], sx: 128, ix: 128, col: [AMBER, OFF, OFF] },
    { id: 'every-cool', occasion: 'Everyday', name: 'Cool white', pace: 'still',
      blurb: 'Steady cool white. Suits a grey, dark or modern house, where warm white can look yellow.',
      fx: ['Solid'], pal: ['Default'], sx: 128, ix: 128, col: [COOL, OFF, OFF] },
    // Twinkleup: colour 2 is the base at full, (ix+1)/256 of the pixels swell to colour 1 and back
    // on a sine of 16·(256-sx) ms — 3.5 s here
    { id: 'every-twinkle', occasion: 'Everyday', name: 'Warm white with a twinkle', pace: 'slow',
      blurb: 'Steady warm white with about one pixel in four slowly brightening and settling back, every three or four seconds.',
      fx: ['Twinkleup'], pal: ['Default'], sx: 40, ix: 60, col: [[255, 235, 205], [230, 150, 75], OFF] },
    // Candle Multi: every pixel wanders on its own between colour 2 and colour 1
    { id: 'every-candle', occasion: 'Everyday', name: 'Candlelight', pace: 'slow',
      blurb: 'Amber, every pixel flickering gently on its own, like a long row of candles.',
      fx: ['Candle Multi'], pal: ['Default'], sx: 40, ix: 110, col: [AMBER, OFF, OFF] },
    // Pacifica on Default uses its own ocean palettes; any other palette recolours it
    { id: 'every-ocean', occasion: 'Everyday', name: 'Ocean', pace: 'medium',
      blurb: "WLED's own Pacifica: layers of deep blue and teal rolling past each other, with white where they crest. Pool-party rather than porch light.",
      fx: ['Pacifica'], pal: ['Default'], sx: 100, ix: 128, col: [OFF, OFF, OFF] },
    // Colorloop: the whole run one colour, once round the wheel every 65.5 s / ((sx>>2)+2) = 33 s
    { id: 'every-cycle', occasion: 'Everyday', name: 'Slow colour cycle', pace: 'slow',
      blurb: 'The whole house one colour, drifting round the colour wheel once every half a minute.',
      fx: ['Colorloop'], pal: ['Default'], sx: 0, ix: 255, col: [OFF, OFF, OFF] },

    // --------------------------------------------------------------- christmas ----
    // Solid Pattern Tri: blocks of (ix>>5)+1 = 8 pixels in colours 1, 2, 3
    { id: 'xmas-rwg', occasion: 'Christmas', name: 'Red, white and green', pace: 'still',
      blurb: 'Red, warm white and green in 16-inch blocks along the roofline. Still. The classic.',
      fx: ['Solid Pattern Tri'], pal: ['Default'], sx: 0, ix: 255, col: [RED, WARM, GREEN] },
    { id: 'xmas-candy', occasion: 'Christmas', name: 'Candy cane', pace: 'still',
      blurb: 'Red and white stripes, 18 inches each. Still.',
      fx: ['Solid Pattern'], pal: ['Default'], sx: 8, ix: 8, col: [RED, WHITE, OFF] },
    { id: 'xmas-holly', occasion: 'Christmas', name: 'Holly', pace: 'still',
      blurb: 'Deep green in 4-foot runs, each finished with an 8-inch red berry. Still.',
      fx: ['Solid Pattern'], pal: ['Default'], sx: 23, ix: 3, col: [GREEN, RED, OFF] },
    // Colorful, Default palette, ix 80-160: the firmware's own FF0000 / EEBB00 / 00EE00 / 0077CC,
    // one pixel each — bright, unlike the C9 palettes, which gamma twice. sx 0 holds it still.
    { id: 'xmas-minis', occasion: 'Christmas', name: 'Multicolour minis', pace: 'still',
      blurb: 'Every pixel its own bulb colour — red, gold, green and blue in turn, the set repeating every 8 inches, like a string of mini lights. Still.',
      fx: ['Colorful'], pal: ['Default'], sx: 0, ix: 120, col: [RED, GOLD, GREEN] },
    // the same, stepping one pixel every 50 + 8·(255-sx) = 290 ms
    { id: 'xmas-minis-chase', occasion: 'Christmas', name: 'Chasing minis', pace: 'medium',
      blurb: 'The red, gold, green and blue mini-light string, its colours stepping along one pixel about three times a second.',
      fx: ['Colorful'], pal: ['Default'], sx: 225, ix: 120, col: [RED, GOLD, GREEN] },
    // Twinklefox: each pixel twinkles in a palette colour (no blending) on its own clock; at sx
    // 120 a twinkle lasts about 2-5 s. "* Colors Only" is the three colours. Over black.
    { id: 'xmas-multi-twinkle', occasion: 'Christmas', name: 'Multicolour twinkle', pace: 'medium',
      blurb: 'Red, green and blue points fading in and out on their own over a dark roofline, every pixel its own colour, like a string of twinkle bulbs.',
      fx: ['Twinklefox'], pal: ['* Colors Only'], sx: 120, ix: 150, col: [RED, GREEN, BLUE], o1: false },
    // Railway: neighbouring pixels in palette(255-pos) / palette(pos); on "* Colors 1&2" that is
    // red / white, swapping over ix/256 of each (256-sx)·40 = 3.8 s half-cycle
    { id: 'xmas-peppermint', occasion: 'Christmas', name: 'Peppermint twist', pace: 'medium',
      blurb: 'Red and white alternating pixel by pixel, the pairs swapping colours every four seconds in a smooth two-second cross-fade — a shimmering candy stripe.',
      fx: ['Railway'], pal: ['* Colors 1&2'], sx: 160, ix: 128, col: [RED, WHITE, OFF] },
    // Chase 2: bands of 1+(ix>>4) = 7 pixels, one pixel per 50+(255-sx) = 165 ms (~1 ft/s)
    { id: 'xmas-candy-march', occasion: 'Christmas', name: 'Candy cane, marching', pace: 'medium',
      blurb: 'Red and white 14-inch stripes running along the roofline at about a foot a second.',
      fx: ['Chase 2'], pal: ['Default'], sx: 140, ix: 96, col: [RED, WHITE, OFF] },
    // Theater: one pixel of colour 1 in every 3+(ix>>4) = 3, stepping every 50+(255-sx) = 105 ms
    { id: 'xmas-marquee', occasion: 'Christmas', name: 'Marquee', pace: 'fast',
      blurb: 'Warm white points every 6 inches over red, running quickly along like the lights round a theatre sign.',
      fx: ['Theater'], pal: ['Default'], sx: 200, ix: 0, col: [WARM, RED, OFF] },
    // Multi Comet: up to 8 comets per zone, one pixel per 10+(255-sx) = 60 ms (~3 ft/s), fading
    // towards colour 2 by fade_out(ix/2+128) — so colour 2 is also the background
    { id: 'xmas-stars', occasion: 'Christmas', name: 'Shooting stars', pace: 'fast',
      blurb: 'White streaks with long fading tails shooting along a night-blue roofline, several at a time, about three feet a second.',
      fx: ['Multi Comet'], pal: ['Default'], sx: 205, ix: 150, col: [WHITE, NIGHT, OFF] },
    // Colorwaves: the palette swept along the run under rolling brightness swells 1-2 ft long
    { id: 'xmas-waves', occasion: 'Christmas', name: 'Christmas waves', pace: 'medium',
      blurb: 'Red, gold and green flowing along the roofline in soft rolling swells, the colours slowly shifting.',
      fx: ['Colorwaves'], pal: ['* Colors Only'], sx: 50, ix: 128, col: [RED, GOLD, GREEN] },
    { id: 'xmas-icicle', occasion: 'Christmas', name: 'Icicles', pace: 'slow',
      blurb: 'Steady icy blue with about a third of the pixels slowly brightening to white and back. Cool and modern.',
      fx: ['Twinkleup'], pal: ['Default'], sx: 50, ix: 85, col: [WHITE, ICE, OFF] },
    // Tri Fade, Default palette (colour 3 is read through the palette); sx 16 → about 7 s a colour
    { id: 'xmas-fade', occasion: 'Christmas', name: 'Red, white and green fade', pace: 'slow',
      blurb: 'The whole roofline slowly turning red, then warm white, then green, about seven seconds for each.',
      fx: ['Tri Fade'], pal: ['Default'], sx: 16, ix: 128, col: [RED, WARM, GREEN] },

    // --------------------------------------------------------------- hanukkah ----
    { id: 'hanu-stripes', occasion: 'Hanukkah', name: 'Blue and white', pace: 'still',
      blurb: 'Royal blue and white in 2-foot sections. Still.',
      fx: ['Solid Pattern'], pal: ['Default'], sx: 11, ix: 11, col: [BLUE, WHITE, OFF] },
    { id: 'hanu-gold', occasion: 'Hanukkah', name: 'Blue, white and gold', pace: 'still',
      blurb: 'Blue, white and gold in 16-inch blocks. Still. Gold for the candle flames.',
      fx: ['Solid Pattern Tri'], pal: ['Default'], sx: 0, ix: 255, col: [BLUE, WHITE, GOLD] },
    { id: 'hanu-twinkle', occasion: 'Hanukkah', name: 'Blue with white twinkle', pace: 'slow',
      blurb: 'Steady royal blue with about a third of the pixels slowly brightening to white and back.',
      fx: ['Twinkleup'], pal: ['Default'], sx: 45, ix: 85, col: [WHITE, BLUE, OFF] },
    { id: 'hanu-march', occasion: 'Hanukkah', name: 'Blue and white, marching', pace: 'medium',
      blurb: 'Blue and white 14-inch stripes running along the roofline at about a foot a second.',
      fx: ['Chase 2'], pal: ['Default'], sx: 130, ix: 96, col: [BLUE, WHITE, OFF] },
    { id: 'hanu-waves', occasion: 'Hanukkah', name: 'Blue and white waves', pace: 'medium',
      blurb: 'Blue and white flowing along the roofline in soft rolling swells.',
      fx: ['Colorwaves'], pal: ['* Colors 1&2'], sx: 50, ix: 128, col: [BLUE, WHITE, OFF] },
    { id: 'hanu-lights', occasion: 'Hanukkah', name: 'Festival of lights', pace: 'medium',
      blurb: 'White, gold and blue points twinkling in and out over a dark roofline, every pixel its own colour.',
      fx: ['Twinklefox'], pal: ['* Colors Only'], sx: 120, ix: 150, col: [WHITE, GOLD, BLUE], o1: true },

    // --------------------------------------------------------------- halloween ----
    { id: 'hall-orangepurple', occasion: 'Halloween', name: 'Orange and purple', pace: 'still',
      blurb: 'Orange in 28-inch sections with 14 inches of purple between. Still. Orange leads, as it should.',
      fx: ['Solid Pattern'], pal: ['Default'], sx: 13, ix: 6, col: [ORANGE, PURPLE, OFF] },
    { id: 'hall-candycorn', occasion: 'Halloween', name: 'Candy corn', pace: 'still',
      blurb: 'Yellow, orange and white in 16-inch blocks. Still. Cheerful rather than spooky.',
      fx: ['Solid Pattern Tri'], pal: ['Default'], sx: 0, ix: 255, col: [YELLOW, BURNT, [255, 245, 225]] },
    { id: 'hall-opg', occasion: 'Halloween', name: 'Orange, purple and green', pace: 'still',
      blurb: 'Orange, purple and green in 16-inch blocks. Still. All three Halloween colours.',
      fx: ['Solid Pattern Tri'], pal: ['Default'], sx: 0, ix: 255, col: [ORANGE, PURPLE, TOXIC] },
    // Candle Multi, speed 100-252: each pixel retargets about every 100 ms
    { id: 'hall-pumpkin', occasion: 'Halloween', name: "Jack-o'-lantern", pace: 'fast',
      blurb: 'Orange the whole way along, every pixel flickering quickly on its own between bright orange and a deeper red-orange, like candles in carved pumpkins.',
      fx: ['Candle Multi'], pal: ['Default'], sx: 110, ix: 200, col: [[255, 130, 0], [200, 35, 0], OFF] },
    { id: 'hall-haunted', occasion: 'Halloween', name: 'Haunted candlelight', pace: 'slow',
      blurb: 'Pale ghostly white, every pixel guttering on its own like a candle in a draught.',
      fx: ['Candle Multi'], pal: ['Default'], sx: 40, ix: 170, col: [GHOST, OFF, OFF] },
    // Halloween Eyes: eyes are (len/32)/2 pixels wide, len/32 apart; one pair per zone at a time
    { id: 'hall-eyes', occasion: 'Halloween', name: 'Watching eyes', pace: 'slow',
      blurb: 'Dark, until a pair of orange eyes fades in somewhere, watches, blinks and goes out. One pair per zone; on a 250-pixel zone each eye is 6 inches with a foot between.',
      fx: ['Halloween Eyes'], pal: ['Default'], sx: 40, ix: 120, col: [[255, 90, 0], OFF, OFF] },
    // Meteor, Smooth + Gradient: a head of len/20 pixels with a random, slowly decaying trail
    { id: 'hall-ghost', occasion: 'Halloween', name: 'Ghost', pace: 'medium',
      blurb: 'One pale shape drifting along the dark roofline, its trail breaking up and fading behind it. About 13 seconds end to end.',
      fx: ['Meteor'], pal: ['* Color 1'], sx: 30, ix: 200, col: [GHOST, OFF, OFF], o1: true, o3: true },
    // Running: sin of i·(ix>>2) − t·sx/512. ix 16 → a 64-pixel (10 ft) wave; sx 12 → ~1 ft/s.
    { id: 'hall-ooze', occasion: 'Halloween', name: 'Creeping ooze', pace: 'slow',
      blurb: 'Long, soft swells of acid green, about ten feet apart, crawling along the dark roofline at a foot a second.',
      fx: ['Running'], pal: ['Default'], sx: 12, ix: 16, col: [TOXIC, OFF, OFF] },
    { id: 'hall-march', occasion: 'Halloween', name: 'Orange and purple, marching', pace: 'medium',
      blurb: 'Orange and purple 14-inch stripes running along the roofline at about a foot a second.',
      fx: ['Chase 2'], pal: ['Default'], sx: 140, ix: 96, col: [ORANGE, PURPLE, OFF] },
    // Colortwinkles: over black, up to len/50+1 pixels a frame light in a pure palette colour
    { id: 'hall-cauldron', occasion: 'Halloween', name: 'Cauldron sparks', pace: 'fast',
      blurb: 'Purple, acid-green and orange sparks flaring up and dying away all along a dark roofline, every pixel its own colour.',
      fx: ['Colortwinkles'], pal: ['* Colors Only'], sx: 140, ix: 200, col: [PURPLE, TOXIC, ORANGE] },
    // Ripple: rings in a random palette colour (always the palette) growing to ~30 px across;
    // "Toxy Reaf" runs acid green → violet; Blur (c1) off so the background stays colour 2 (black)
    { id: 'hall-ripple', occasion: 'Halloween', name: 'Toxic ripples', pace: 'medium',
      blurb: 'Rings of acid green and violet bursting out from random points, spreading a couple of feet and fading, over black.',
      fx: ['Ripple'], pal: ['Toxy Reaf'], sx: 140, ix: 160, col: [TOXIC, OFF, OFF], c1: 0 },
    { id: 'hall-storm', occasion: 'Halloween', name: 'Thunderstorm', pace: 'fast', flashing: true,
      blurb: 'Dark, with a flickering strike of pale lightning across part of the roofline every ten seconds or so. This one flashes.',
      fx: ['Lightning'], pal: ['Default'], sx: 60, ix: 128, col: [GHOST, OFF, OFF] },

    // ------------------------------------------------------------- autumn ----
    { id: 'fall-harvest', occasion: 'Autumn', name: 'Harvest', pace: 'still',
      blurb: 'Burnt orange, gold and deep red in 16-inch blocks. Still.',
      fx: ['Solid Pattern Tri'], pal: ['Default'], sx: 0, ix: 255, col: [BURNT, GOLD, [200, 0, 10]] },
    // "Palette" at ix 160 repeats "* Color Gradient" three times per zone (colour 3 → 2 → 1)
    { id: 'fall-leaves', occasion: 'Autumn', name: 'Turning leaves', pace: 'slow',
      blurb: 'Gold shading through orange to red and back, three times across each zone, drifting very slowly.',
      fx: ['Palette'], pal: ['* Color Gradient'], sx: 0, ix: 160, col: [[230, 20, 0], ORANGE, GOLD], o1: true },
    { id: 'fall-flicker', occasion: 'Autumn', name: 'Falling leaves', pace: 'slow',
      blurb: 'Steady amber with about a third of the pixels slowly turning deep red-orange and back.',
      fx: ['Twinkleup'], pal: ['Default'], sx: 40, ix: 85, col: [[220, 40, 0], AMBER, OFF] },
    { id: 'fall-scatter', occasion: 'Autumn', name: 'Leaf scatter', pace: 'medium',
      blurb: 'Red, burnt-orange and gold points flaring up and fading all along a dark roofline, every pixel its own colour.',
      fx: ['Colortwinkles'], pal: ['* Colors Only'], sx: 60, ix: 140, col: [[230, 20, 0], BURNT, GOLD] },
    { id: 'fall-wind', occasion: 'Autumn', name: 'Autumn wind', pace: 'slow',
      blurb: 'Red, orange and gold flowing slowly along the roofline in soft swells.',
      fx: ['Colorwaves'], pal: ['* Colors Only'], sx: 20, ix: 128, col: [[230, 20, 0], ORANGE, GOLD] },

    // ------------------------------------------------------------ thanksgiving ----
    { id: 'thnx-glow', occasion: 'Thanksgiving', name: 'Harvest glow', pace: 'still',
      blurb: 'Warm white and orange in 2-foot sections. Still. The table, not the yard.',
      fx: ['Solid Pattern'], pal: ['Default'], sx: 11, ix: 11, col: [WARM, ORANGE, OFF] },
    { id: 'thnx-table', occasion: 'Thanksgiving', name: 'Gold, orange and cream', pace: 'still',
      blurb: 'Gold, burnt orange and warm cream in 16-inch blocks. Still.',
      fx: ['Solid Pattern Tri'], pal: ['Default'], sx: 0, ix: 255, col: [GOLD, BURNT, CREAM] },
    // Chase 2: 1+(112>>4) = 8-pixel bands, one pixel per 205 ms
    { id: 'thnx-cranberry', occasion: 'Thanksgiving', name: 'Cranberry and cream', pace: 'medium',
      blurb: 'Deep cranberry and warm cream 16-inch stripes moving along at a gentle walk.',
      fx: ['Chase 2'], pal: ['Default'], sx: 100, ix: 112, col: [CRANBERRY, CREAM, OFF] },
    // Chase 3: 16" bands, one pixel per 50+2·(255-sx) = 400 ms — about 5" a second
    { id: 'thnx-chase', occasion: 'Thanksgiving', name: 'Harvest procession', pace: 'slow',
      blurb: 'Gold, burnt orange and cranberry 16-inch bands drifting slowly along, about five inches a second.',
      fx: ['Chase 3'], pal: ['Default'], sx: 80, ix: 112, col: [GOLD, BURNT, CRANBERRY] },
    { id: 'thnx-hearth', occasion: 'Thanksgiving', name: 'Hearth', pace: 'medium',
      blurb: 'Every pixel glowing between orange and a deep red at a lazy pace. The fireplace, not the bonfire.',
      fx: ['Candle Multi'], pal: ['Default'], sx: 70, ix: 170, col: [[255, 120, 0], [150, 20, 0], OFF] },
    // Tri Fade sx 8: (8>>3)+1 = 2 → a round in 33 s, about 11 s a colour
    { id: 'thnx-sunset', occasion: 'Thanksgiving', name: 'Harvest sunset', pace: 'slow',
      blurb: 'The whole roofline slowly turning gold, then burnt orange, then cranberry, about eleven seconds for each.',
      fx: ['Tri Fade'], pal: ['Default'], sx: 8, ix: 128, col: [GOLD, BURNT, CRANBERRY] },

    // ---------------------------------------------------------------- patriotic ----
    // Memorial Day, Flag Day, the Fourth, Labor Day, Veterans Day share these.
    { id: 'usa-stripes', occasion: 'Fourth of July', name: 'Red, white and blue', pace: 'still',
      blurb: 'Red, white and blue in 16-inch blocks. Still. Right for any of the patriotic holidays.',
      fx: ['Solid Pattern Tri'], pal: ['Default'], sx: 0, ix: 255, col: [RED, WHITE, BLUE] },
    { id: 'usa-honour', occasion: 'Fourth of July', name: 'White with blue', pace: 'still',
      blurb: 'White in 4-foot runs, each finished with a foot of blue. Still and restrained, for Memorial and Veterans Day.',
      fx: ['Solid Pattern'], pal: ['Default'], sx: 23, ix: 5, col: [WHITE, BLUE, OFF] },
    // Chase 3: bands 16 wide (32"), one pixel per 50+2·(255-sx) = 360 ms
    { id: 'usa-drift', occasion: 'Fourth of July', name: 'Red, white and blue, drifting', pace: 'slow',
      blurb: 'Broad red, white and blue bands, about 32 inches each, drifting slowly along.',
      fx: ['Chase 3'], pal: ['Default'], sx: 100, ix: 255, col: [RED, WHITE, BLUE] },
    { id: 'usa-stars', occasion: 'Fourth of July', name: 'Stars on blue', pace: 'slow',
      blurb: "Steady blue with scattered pixels slowly brightening to white and back — the flag's field of stars.",
      fx: ['Twinkleup'], pal: ['Default'], sx: 45, ix: 60, col: [WHITE, BLUE, OFF] },
    { id: 'usa-fade', occasion: 'Fourth of July', name: 'Red, white and blue fade', pace: 'slow',
      blurb: 'The whole roofline slowly turning red, then white, then blue, about five seconds for each.',
      fx: ['Tri Fade'], pal: ['Default'], sx: 24, ix: 128, col: [RED, WHITE, BLUE] },
    // Colortwinkles over black: individual pixels flaring red, white or blue at random — scattered,
    // never a red/blue alternation
    { id: 'usa-sparkle', occasion: 'Fourth of July', name: 'Freedom sparkle', pace: 'medium',
      blurb: 'Red, white and blue points flaring up and fading at random all along a dark roofline.',
      fx: ['Colortwinkles'], pal: ['* Colors Only'], sx: 100, ix: 180, col: [RED, WHITE, BLUE] },
    // Meteor without Smooth: head 1+len/20 (about 2 ft on a 250-pixel zone), a pass every
    // 65.5 s / ((sx>>2)+8) = 1.4 s, colour 1 through mcol 0 with a crackling random-decay trail
    { id: 'usa-sparkler', occasion: 'Fourth of July', name: 'Sparkler', pace: 'fast',
      blurb: 'A bright gold streak with a crackling tail racing along each zone, end to end in under a second and a half.',
      fx: ['Meteor'], pal: ['Default'], sx: 160, ix: 128, col: [GOLD, OFF, OFF], o1: false, o3: false },
    // Starburst: bursts in palette colours ("* Colors Only" = the three)
    { id: 'usa-fireworks', occasion: 'Fourth of July', name: 'Fireworks', pace: 'fast', flashing: true,
      blurb: 'Red, white and blue bursts flashing and spreading all along the roofline. Busy by design.',
      fx: ['Fireworks Starburst', 'Fireworks'], pal: ['* Colors Only'], sx: 120, ix: 150, col: [RED, WHITE, BLUE] },

    // ------------------------------------------------------------- valentine's ----
    { id: 'val-pinkred', occasion: "Valentine's", name: 'Pink and red', pace: 'still',
      blurb: 'Soft pink in 2-foot sections with a foot of red between. Still.',
      fx: ['Solid Pattern'], pal: ['Default'], sx: 11, ix: 5, col: [PINK, RED, OFF] },
    { id: 'val-prw', occasion: "Valentine's", name: 'Red, pink and white', pace: 'still',
      blurb: 'Red, pink and white in 16-inch blocks. Still.',
      fx: ['Solid Pattern Tri'], pal: ['Default'], sx: 0, ix: 255, col: [RED, PINK, WHITE] },
    { id: 'val-shimmer', occasion: "Valentine's", name: 'Pink shimmer', pace: 'slow',
      blurb: 'Steady pink with about a third of the pixels slowly brightening to blush white and back.',
      fx: ['Twinkleup'], pal: ['Default'], sx: 45, ix: 85, col: [BLUSH, PINK, OFF] },
    { id: 'val-twinkle', occasion: "Valentine's", name: 'Sweetheart twinkle', pace: 'medium',
      blurb: 'Red, pink and white points twinkling in and out over a dark roofline, every pixel its own colour.',
      fx: ['Twinklefox'], pal: ['* Colors Only'], sx: 110, ix: 150, col: [RED, PINK, WHITE], o1: true },
    // Heartbeat: 40 + sx/8 bpm; colour 2 is a real red so the house never goes dark between beats
    { id: 'val-heart', occasion: "Valentine's", name: 'Heartbeat', pace: 'medium',
      blurb: 'Deep red, with the whole roofline beating brighter in a double heartbeat, fifty times a minute. Never goes dark.',
      fx: ['Heartbeat'], pal: ['Default'], sx: 80, ix: 128, col: [[255, 30, 60], [150, 0, 15], OFF] },
    { id: 'val-arrows', occasion: "Valentine's", name: "Cupid's arrows", pace: 'fast',
      blurb: 'Pale pink streaks with fading tails shooting along a deep red roofline, several at a time.',
      fx: ['Multi Comet'], pal: ['Default'], sx: 200, ix: 150, col: [[255, 180, 210], [150, 0, 15], OFF] },

    // ----------------------------------------------------------- st patrick's ----
    { id: 'stpat-luck', occasion: "St Patrick's", name: 'Luck of the Irish', pace: 'still',
      blurb: 'Green, gold and white in 16-inch blocks. Still.',
      fx: ['Solid Pattern Tri'], pal: ['Default'], sx: 0, ix: 255, col: [GREEN, GOLD, WHITE] },
    { id: 'stpat-shamrock', occasion: "St Patrick's", name: 'Shamrock', pace: 'still',
      blurb: 'Green in 3-foot runs, each finished with a foot of white. Still.',
      fx: ['Solid Pattern'], pal: ['Default'], sx: 17, ix: 5, col: [GREEN, WHITE, OFF] },
    { id: 'stpat-flag', occasion: "St Patrick's", name: 'Tricolour', pace: 'still',
      blurb: 'Green, white and orange in 16-inch blocks, the Irish flag. Still.',
      fx: ['Solid Pattern Tri'], pal: ['Default'], sx: 0, ix: 255, col: [GREEN, WHITE, ORANGE] },
    { id: 'stpat-emerald', occasion: "St Patrick's", name: 'Emerald shimmer', pace: 'slow',
      blurb: 'Steady green with about a third of the pixels slowly brightening to a pale green and back.',
      fx: ['Twinkleup'], pal: ['Default'], sx: 40, ix: 85, col: [[170, 255, 170], GREEN, OFF] },
    { id: 'stpat-gold', occasion: "St Patrick's", name: 'Pot of gold', pace: 'slow',
      blurb: 'Steady green with scattered pixels slowly warming to gold and back.',
      fx: ['Twinkleup'], pal: ['Default'], sx: 40, ix: 60, col: [GOLD, GREEN, OFF] },
    { id: 'stpat-march', occasion: "St Patrick's", name: 'Shamrock parade', pace: 'medium',
      blurb: 'Green and white 14-inch stripes running along the roofline at about a foot a second.',
      fx: ['Chase 2'], pal: ['Default'], sx: 140, ix: 96, col: [GREEN, WHITE, OFF] },
    { id: 'stpat-sparkle', occasion: "St Patrick's", name: 'Lucky sparkle', pace: 'medium',
      blurb: 'Green, gold and white points flaring up and fading at random all along a dark roofline.',
      fx: ['Colortwinkles'], pal: ['* Colors Only'], sx: 100, ix: 160, col: [GREEN, GOLD, WHITE] },

    // --------------------------------------------------------------- new year ----
    { id: 'ny-goldsilver', occasion: 'New Year', name: 'Gold and silver', pace: 'still',
      blurb: 'Gold and bright white in 18-inch sections. Still.',
      fx: ['Solid Pattern'], pal: ['Default'], sx: 8, ix: 8, col: [GOLD, WHITE, OFF] },
    { id: 'ny-champagne', occasion: 'New Year', name: 'Champagne', pace: 'medium',
      blurb: 'Steady gold with about a third of the pixels brightening to white and back, a little quicker than the other twinkles.',
      fx: ['Twinkleup'], pal: ['Default'], sx: 90, ix: 85, col: [WHITE, GOLD, OFF] },
    // Twinklefox, "Cool" on so the white stays white as it fades, over black
    { id: 'ny-sparkle', occasion: 'New Year', name: 'Silver sparkle', pace: 'fast',
      blurb: 'White points twinkling quickly in and out over a dark roofline.',
      fx: ['Twinklefox'], pal: ['* Color 1'], sx: 140, ix: 160, col: [WHITE, OFF, OFF], o1: true },
    // Multi Comet with colour 3 set: every other comet is colour 3
    { id: 'ny-streaks', occasion: 'New Year', name: 'Gold rush', pace: 'fast',
      blurb: 'Gold and white streaks with fading tails racing along a dark roofline, several at a time.',
      fx: ['Multi Comet'], pal: ['Default'], sx: 215, ix: 140, col: [GOLD, OFF, WHITE] },
    { id: 'ny-midnight', occasion: 'New Year', name: 'Midnight', pace: 'fast', flashing: true,
      blurb: 'White and gold bursts flashing and spreading along the roofline, for the countdown.',
      fx: ['Fireworks Starburst', 'Fireworks'], pal: ['* Colors 1&2'], sx: 140, ix: 150, col: [WHITE, GOLD, OFF] },

    // ---------------------------------------------------------- easter / spring ----
    // Pastels wash towards white on RGB pixels, so these are mid-strength tints
    { id: 'spring-eggs', occasion: 'Easter & spring', name: 'Easter eggs', pace: 'still',
      blurb: 'Pink, yellow and sky blue in 16-inch blocks. Still.',
      fx: ['Solid Pattern Tri'], pal: ['Default'], sx: 0, ix: 255, col: [PINK, YELLOW, SKY] },
    { id: 'spring-pastel', occasion: 'Easter & spring', name: 'Spring pastels', pace: 'still',
      blurb: 'Lavender, mint and pink in 16-inch blocks. Still.',
      fx: ['Solid Pattern Tri'], pal: ['Default'], sx: 0, ix: 255, col: [LAVENDER, MINT, PINK] },
    { id: 'spring-blossom', occasion: 'Easter & spring', name: 'Cherry blossom', pace: 'slow',
      blurb: 'Steady soft pink with about a third of the pixels slowly brightening to white and back.',
      fx: ['Twinkleup'], pal: ['Default'], sx: 35, ix: 85, col: [WHITE, PINK, OFF] },
    { id: 'spring-twinkle', occasion: 'Easter & spring', name: 'Spring twinkle', pace: 'medium',
      blurb: 'Pink, lavender and mint points twinkling in and out over a dark roofline, every pixel its own colour.',
      fx: ['Twinklefox'], pal: ['* Colors Only'], sx: 100, ix: 150, col: [PINK, LAVENDER, MINT], o1: true },
    // Chase 3: 16" bands, one pixel per 360 ms
    { id: 'spring-parade', occasion: 'Easter & spring', name: 'Easter parade', pace: 'slow',
      blurb: 'Pink, yellow and sky-blue 16-inch bands drifting slowly along.',
      fx: ['Chase 3'], pal: ['Default'], sx: 100, ix: 112, col: [PINK, YELLOW, SKY] },
    // Colorful at ix < 80 on Default: the firmware's FF8040 / E5D241 / 77FF77 / 77F0F0, which come
    // out orange, yellow, light green and aqua after gamma; one step every 50+8·(255-sx) = 490 ms
    { id: 'spring-minis', occasion: 'Easter & spring', name: 'Easter minis', pace: 'medium',
      blurb: 'Orange, yellow, light green and aqua, one per pixel like a string of mini lights, stepping along twice a second.',
      fx: ['Colorful'], pal: ['Default'], sx: 200, ix: 40, col: [PINK, YELLOW, SKY] },

    // -------------------------------------------------------------- mardi gras ----
    { id: 'mardi-carnival', occasion: 'Mardi Gras', name: 'Carnival', pace: 'still',
      blurb: 'Purple, gold and green in 16-inch blocks. Still.',
      fx: ['Solid Pattern Tri'], pal: ['Default'], sx: 0, ix: 255, col: [PURPLE, GOLD, GREEN] },
    { id: 'mardi-fade', occasion: 'Mardi Gras', name: 'Carnival fade', pace: 'slow',
      blurb: 'The whole roofline slowly turning purple, then gold, then green, about five seconds for each.',
      fx: ['Tri Fade'], pal: ['Default'], sx: 24, ix: 128, col: [PURPLE, GOLD, GREEN] },
    // Chase 3: 16" bands, one pixel per 50+2·75 = 200 ms (~10"/s)
    { id: 'mardi-parade', occasion: 'Mardi Gras', name: 'Parade', pace: 'medium',
      blurb: 'Purple, gold and green 16-inch bands marching along at about ten inches a second.',
      fx: ['Chase 3'], pal: ['Default'], sx: 180, ix: 112, col: [PURPLE, GOLD, GREEN] },
    // Colorful at ix > 160 on Default: the three colours set, one pixel each, stepping every 170 ms
    { id: 'mardi-beads', occasion: 'Mardi Gras', name: 'Beads', pace: 'fast',
      blurb: 'Purple, gold and green one pixel each, like a string of beads, the colours racing along about six steps a second.',
      fx: ['Colorful'], pal: ['Default'], sx: 240, ix: 200, col: [PURPLE, GOLD, GREEN] },

    // --------------------------------------------------------------- birthday ----
    { id: 'bday-balloons', occasion: 'Birthday', name: 'Balloons', pace: 'still',
      blurb: 'Red, yellow and blue in 16-inch blocks, the primary colours of a bunch of balloons. Still.',
      fx: ['Solid Pattern Tri'], pal: ['Default'], sx: 0, ix: 255, col: [RED, YELLOW, BLUE] },
    // Twinklefox on its own Party palette over black
    { id: 'bday-confetti', occasion: 'Birthday', name: 'Confetti', pace: 'medium',
      blurb: 'Points of every colour twinkling in and out over a dark roofline. Party, not holiday.',
      fx: ['Twinklefox'], pal: ['Party'], sx: 90, ix: 150, col: [OFF, OFF, OFF], o1: true },
    // Rainbow: (16 << ix/29)/256 rainbows per zone — two at ix 160 — a full turn every
    // 65.5 s / ((sx>>2)+2) = 3.9 s
    { id: 'bday-rainbow', occasion: 'Birthday', name: 'Rainbow', pace: 'fast',
      blurb: 'Two full rainbows across each zone, rolling along — the colours come round every four seconds.',
      fx: ['Rainbow'], pal: ['Default'], sx: 60, ix: 160, col: [OFF, OFF, OFF] },
  ];

  const occasions = [...new Set(list.map((x) => x.occasion))];

  const findByName = (names, have) => {
    const lower = (have || []).map((n) => String(n || '').toLowerCase());
    for (const want of names || []) {
      const i = lower.indexOf(String(want).toLowerCase());
      if (i >= 0) return i;
    }
    return -1;
  };

  // What the firmware puts in a segment's custom sliders and checkboxes when an effect declares
  // nothing (DEFAULT_C1/C2/C3 and false in FX_fcn.cpp's Segment::setMode).
  const WLED_DEFAULTS = { c1: 128, c2: 128, c3: 16, o1: false, o2: false, o3: false };
  const OPTS = Object.keys(WLED_DEFAULTS);

  // An effect's metadata is "sliders;colours;palette;flags;defaults" and the defaults field is
  // "sx=64,ix=160,c2=128,o1=1,pal=35". Only the custom sliders and checkboxes are taken from it
  // here — sx and ix every entry sets for itself, and the palette is chosen by name above.
  function metaDefaults(meta) {
    const out = {};
    const d = String(meta || '').split(';')[4] || '';
    for (const kv of d.split(',')) {
      const [k, v] = kv.split('=');
      if (!OPTS.includes(k) || v === undefined) continue;
      out[k] = k[0] === 'o' ? v !== '0' : Math.max(0, Number(v) | 0);
    }
    return out;
  }

  // Turns a catalogue entry into a segment payload for this controller, or null when the
  // controller has none of the effects it names — better nothing than the wrong effect.
  // `fxdata` is the controller's /json/fxdata list, so an effect's own declared defaults apply
  // before the entry's; without it the firmware's defaults apply instead. Every option is sent
  // explicitly because the firmware only loads an effect's defaults when the effect *changes*.
  function resolve(item, effects, palettes, fxdata) {
    const fx = findByName(item.fx, effects);
    if (fx < 0) return null;
    const pal = findByName(item.pal, palettes);
    const own = {};
    for (const k of OPTS) if (item[k] !== undefined) own[k] = item[k];
    return {
      fx,
      pal: pal < 0 ? 0 : pal,
      sx: item.sx ?? 128,
      ix: item.ix ?? 128,
      col: (item.col || []).map((c) => c.slice(0, 3)),
      ...WLED_DEFAULTS,
      ...metaDefaults(fxdata?.[fx]),
      ...own,
    };
  }

  // Two or three dots for the tile, so a look is recognisable before it is applied.
  const swatch = (item) => (item.col || []).filter((c) => c.some((v) => v))
    .map((c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`);

  window.HOLIDAYS = { list, occasions, resolve, swatch, metaDefaults };
})();
