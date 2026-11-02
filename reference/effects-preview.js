// Browser-side approximation of WLED's effects, so a look can be judged — on a photo of the
// house, on a preview strip, on a tile in the picker — without touching the real lights.
//
// It is classified by effect NAME, not by id. Ids shift between firmware versions, and there are
// close to two hundred of them; the names, however, describe what the effect does, and effects
// fall into a few dozen families that look alike. So every effect the controller reports gets a
// preview, drawn in that zone's own colours and palette. It is a likeness, not a port of FX.cpp:
// timing and randomness differ, and some families stand in for several effects at once.
(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
  const scale = (c, s) => [c[0] * s, c[1] * s, c[2] * s];
  const fill = (n, f) => Array.from({ length: n }, f);
  // deterministic noise, so a tile looks the same each time it is drawn
  const hash = (i) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };

  function hsv(h, s = 1, v = 1) {
    h = ((h % 1) + 1) % 1; const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const c = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6]; return c.map((x) => x * 255);
  }
  function gradient(stops) {
    return (pos) => {
      pos = ((pos % 1) + 1) % 1 * 255;
      for (let i = 1; i < stops.length; i++) if (pos <= stops[i][0]) {
        const a = stops[i - 1], b = stops[i], t = b[0] === a[0] ? 0 : (pos - a[0]) / (b[0] - a[0]);
        return mix([a[1], a[2], a[3]], [b[1], b[2], b[3]], t);
      }
      const l = stops[stops.length - 1]; return [l[1], l[2], l[3]];
    };
  }
  const BUILTIN = {
    6: [[0, 85, 0, 255], [42, 170, 0, 255], [84, 255, 0, 170], [127, 255, 0, 0], [170, 255, 85, 0], [212, 255, 170, 0], [255, 85, 0, 255]],
    7: [[0, 0, 0, 255], [85, 0, 85, 255], [170, 170, 170, 255], [255, 255, 255, 255]],
    8: [[0, 0, 0, 0], [64, 128, 0, 0], [128, 255, 60, 0], [192, 255, 160, 0], [255, 255, 255, 255]],
    9: [[0, 0, 0, 80], [85, 0, 60, 160], [170, 0, 160, 200], [255, 0, 255, 200]],
    10: [[0, 0, 60, 0], [85, 0, 120, 30], [170, 40, 180, 60], [255, 120, 220, 60]],
    11: [[0, 255, 0, 0], [42, 255, 170, 0], [85, 0, 255, 0], [127, 0, 255, 255], [170, 0, 0, 255], [212, 170, 0, 255], [255, 255, 0, 0]],
    12: [[0, 255, 0, 0], [31, 255, 0, 0], [32, 0, 0, 0], [63, 0, 0, 0], [64, 0, 255, 0], [95, 0, 255, 0], [96, 0, 0, 0], [127, 0, 0, 0], [128, 0, 0, 255], [159, 0, 0, 255], [160, 0, 0, 0], [191, 0, 0, 0], [192, 255, 170, 0], [223, 255, 170, 0], [224, 0, 0, 0], [255, 0, 0, 0]],
    13: [[0, 120, 0, 0], [22, 179, 22, 0], [51, 255, 104, 0], [85, 167, 22, 18], [135, 100, 0, 103], [198, 16, 0, 130], [255, 0, 0, 160]],
    35: [[0, 0, 0, 0], [46, 18, 0, 0], [96, 113, 0, 0], [108, 142, 3, 1], [119, 175, 17, 1], [146, 213, 44, 2], [174, 255, 82, 4], [188, 255, 115, 4], [202, 255, 156, 4], [218, 255, 203, 4], [234, 255, 255, 4], [244, 255, 255, 71], [255, 255, 255, 255]],
    36: [[0, 0, 0, 0], [59, 0, 9, 45], [119, 0, 38, 255], [149, 3, 100, 255], [180, 23, 199, 255], [217, 100, 235, 255], [255, 255, 255, 255]],
    48: [[0, 184, 4, 0], [60, 184, 4, 0], [65, 144, 44, 2], [125, 144, 44, 2], [130, 4, 96, 2], [190, 4, 96, 2], [195, 7, 7, 88], [255, 7, 7, 88]],
    50: [[0, 1, 5, 45], [64, 0, 200, 23], [128, 0, 255, 0], [170, 0, 243, 45], [200, 0, 135, 7], [255, 1, 5, 45]],
  };
  function paletteFn(id, cols, palData) {
    const c1 = cols[0] || [255, 160, 0], c2 = cols[1] || [0, 0, 0], c3 = cols[2] || [0, 0, 0];
    if (palData) {
      if (Array.isArray(palData) && Array.isArray(palData[0])) return gradient(palData);
      if (Array.isArray(palData) && typeof palData[0] === 'string') {
        const stops = palData.map((k, i) => { const c = k === 'c1' ? c1 : k === 'c2' ? c2 : k === 'c3' ? c3 : hsv((i * 0.37) % 1); return [Math.round(255 * i / Math.max(1, palData.length - 1)), ...c]; });
        return gradient(stops.length > 1 ? stops : [[0, ...c1], [255, ...c1]]);
      }
    }
    switch (id) {
      case 0: return gradient(BUILTIN[6]);
      case 1: return (p) => hsv(p);
      case 2: return () => c1;
      // Segment::loadPalette: 3 is CRGBPalette16(prim,prim,sec,sec) — solid thirds with a blend
      // between — and 4 is CRGBPalette16(ter,sec,prim), which starts at colour THREE, not one.
      case 3: return gradient([[0, ...c1], [85, ...c1], [170, ...c2], [255, ...c2]]);
      case 4: return gradient([[0, ...c3], [128, ...c2], [255, ...c1]]);
      case 5: return gradient([[0, ...c1], [85, ...c1], [86, ...c2], [170, ...c2], [171, ...c3], [255, ...c3]]);
      default: return BUILTIN[id] ? gradient(BUILTIN[id]) : gradient(BUILTIN[11]);
    }
  }

  // ---------------------------------------------------------------- families ----
  // ctx: { n, t (ms), sx, ix, col:[[r,g,b]x3], pal:(0..1)->rgb, palId, st:{} }
  const speed = (c, slow, fast) => lerp(slow, fast, c.sx / 255);
  // Segment::color_from_palette(i, …, mcol): with the Default palette (id 0) it returns the segment
  // colour in slot `mcol`, and only otherwise reads the palette. Most effects draw their "colour 1"
  // through this, so on Default they show the colour you picked and on any palette they show the
  // palette — an effect preview has to make the same choice or it lies about one of the two.
  const palOrCol = (c, mcol, pos) => (c.palId === 0 && mcol < 3 ? c.col[mcol] : c.pal(pos));
  const isOff = (col) => !col || !col.some((v) => v);
  const opt = (c, k, d) => (c[k] === undefined || c[k] === null ? d : c[k]);
  // smooth per-pixel noise in 0..1 that drifts with time; deterministic so a tile is stable
  const wobble = (i, t, rate) => (Math.sin(t / rate + hash(i) * 6.283) * 0.5 + 0.5);
  const phase = (c, slow, fast) => (c.t % speed(c, slow, fast)) / speed(c, slow, fast);
  const bg = (c) => c.col[1];
  const F = {
    solid:   (c) => fill(c.n, () => c.col[0]),
    paletteFill: (c) => fill(c.n, (_, i) => c.pal(i / c.n)),

    blink:   (c) => { const on = phase(c, 2000, 100) < clamp(c.ix / 255, .1, .9); return fill(c.n, () => on ? c.col[0] : bg(c)); },
    // mode_lightning(): colour 2 everywhere, and now and then a strike — a few one-frame flashes of
    // colour 1 (through the palette) over a random stretch of the run, then a random pause of up to
    // (255-sx)·100 ms. The preview strikes on a fixed rhythm so a tile is not always caught dark.
    lightning: (c) => { const per = 800 + (255 - c.sx) * 20; const gen = Math.floor(c.t / per); const tt = c.t % per;
      const on = (tt < 60) || (tt > 160 && tt < 200) || (tt > 320 && tt < 360);
      if (!on) return fill(c.n, () => bg(c));
      const a = Math.floor(hash(gen) * c.n * 0.7); const len = Math.max(1, Math.floor((0.2 + hash(gen + 5) * 0.6) * c.n));
      return fill(c.n, (_, i) => (i >= a && i < a + len ? palOrCol(c, 0, i / c.n) : bg(c))); },
    strobe:  (c) => { const p = phase(c, 900, 120); return fill(c.n, () => p < .12 ? [255, 255, 255] : bg(c)); },
    // mode_breath(): counter = now·((sx>>3)+10), folded into a 0-20480 ramp of which the first
    // 16384 is a sine swell; lum = 30 + up to 225, blending colour 2 → colour 1 (or the palette).
    breathe: (c) => { let k = (c.t * ((c.sx >> 3) + 10)) & 0xFFFF; k = (k >> 2) + (k >> 4); let v = 0;
      if (k < 16384) { if (k > 8192) k = 16384 - k; v = Math.sin((k / 65536) * Math.PI * 2) * 32767 / 103; }
      const lum = (30 + v) / 255; return fill(c.n, (_, i) => mix(bg(c), palOrCol(c, 0, i / c.n), lum)); },
    // mode_fade(): triwave16(now·((sx>>3)+10)) blends colour 2 → colour 1 and back across the whole
    // run — a full cycle every 65.5 s / ((sx>>3)+10), so 6.5 s at speed 0 and 1.6 s at 255.
    fade:    (c) => { const u = (c.t * ((c.sx >> 3) + 10)) & 0xFFFF; const lum = (u < 0x8000 ? u * 2 : 0xFFFF - (u - 0x8000) * 2) / 0xFFFF;
      return fill(c.n, (_, i) => mix(bg(c), palOrCol(c, 0, i / c.n), lum)); },
    // mode_tricolor_fade(): the whole run fades colour 1 → 2 → 3 → 1; one full round takes
    // 65.5 s / ((sx>>3)+1). Colour 3 is read through the palette (mcol 2), so only Default shows it.
    triFade: (c) => { const counter = (c.t * ((c.sx >> 3) + 1)) & 0xFFFF; const prog = (counter * 768) >> 16; const stp = (prog & 0xFF) / 255;
      return fill(c.n, (_, i) => { const c3 = palOrCol(c, 2, i / c.n);
        return prog < 256 ? mix(c.col[0], c.col[1], stp) : prog < 512 ? mix(c.col[1], c3, stp) : mix(c3, c.col[0], stp); }); },
    // mode_railway(): pixels in pairs, the even one palette(255-pos) and the odd one palette(pos)
    // (always the palette, never the slots — its default is "* Colors 1&2"); pos ramps 0→255 over
    // ix/256 of each (256-sx)·40 ms half-cycle, then back, so neighbours swap colours smoothly.
    railway: (c) => { const dur = (256 - c.sx) * 40; const ramp = dur * c.ix / 256; const k = Math.floor(c.t / dur); const tt = c.t % dur;
      let pos = ramp ? Math.min(1, tt / ramp) : 1; if (k % 2) pos = 1 - pos;
      return fill(c.n, (_, i) => c.pal(i % 2 ? pos : 1 - pos)); },
    // mode_multi_comet(): up to 8 comets per zone, each launched at random from pixel 0 and
    // stepping one pixel every 10 + (255-sx) ms to the far end; everything fades towards colour 2
    // by fade_out(ix/2+128) per step, which is the tail. With colour 3 set, every other comet is
    // colour 3. The preview gives each comet a fixed launch rhythm instead of the random one.
    multiComet: (c) => { const step = 10 + (255 - c.sx); const r = (256 - (c.ix / 2 + 128)) >> 1; const k = (256 / (r + 1)) / 256;
      const tail = Math.max(2, Math.min(c.n, Math.round(3 / Math.max(k, 0.004)))); const out = fill(c.n, () => bg(c));
      for (let j = 0; j < 8; j++) { const per = c.n * (1.6 + hash(j) * 1.8); const pos = ((c.t / step) + hash(j + 40) * per) % per;
        if (pos - tail >= c.n) continue; const col = j % 2 && !isOff(c.col[2]) ? c.col[2] : null;
        for (let d = 0; d < tail; d++) { const i = Math.floor(pos) - d; if (i < 0 || i >= c.n) continue;
          out[i] = mix(out[i], col || palOrCol(c, 0, i / c.n), Math.pow(1 - k, d)); } }
      return out; },
    // mode_meteor(): a head of 1 + n/20 pixels; without Smooth it crosses in 65.5 s / ((sx>>2)+8),
    // with Smooth (o3) in about 256·64/(sx+1) frames. Without Gradient (o1) the smooth trail looks its
    // brightness up as a palette INDEX, so on a solid palette the whole run turns colour 1 — the
    // preview shows exactly that rather than hiding it.
    meteor: (c) => { const smooth = !!opt(c, 'o3', false), grad = !!opt(c, 'o1', false);
      if (smooth && !grad && c.palId !== 0) return fill(c.n, (_, i) => c.pal(i / c.n));
      const pass = smooth ? (256 * 64 / (c.sx + 1)) * 24 : 65536 / ((c.sx >> 2) + 8);
      const head = 1 + Math.floor(c.n / 20); const pos = ((c.t % pass) / pass) * c.n;
      const tail = Math.max(3, (smooth ? 4 : 1.2) * c.n * (1 - c.ix / 255) * 0.25 + head);
      return fill(c.n, (_, i) => { let d = pos - i; if (d < 0) d += c.n;
        const a = d < head ? 1 : d < head + tail ? Math.pow(1 - (d - head) / tail, 2) * (0.6 + 0.4 * hash(i + Math.floor(c.t / 120))) : 0;
        return a ? scale(palOrCol(c, 0, i / c.n), a) : [0, 0, 0]; }); },
    // mode_rainbow_cycle(): (16 << ix/29)/256 rainbows per zone (ix 128 = one, 160 = two), shifting
    // one full turn every 65.5 s / ((sx>>2)+2); color_wheel is the palette when one is set.
    rainbowCycle: (c) => { const counter = ((c.t * ((c.sx >> 2) + 2)) & 0xFFFF) >> 8; const span = 16 << Math.floor(c.ix / 29);
      return fill(c.n, (_, i) => { const idx = (Math.floor(i * span / c.n) + counter) & 255; return c.palId ? c.pal(idx / 255) : hsv(idx / 255); }); },
    // mode_rainbow() ("Colorloop"): the whole run one colour, walking round the wheel at the same rate
    colorloop: (c) => { const counter = ((c.t * ((c.sx >> 2) + 2)) & 0xFFFF) >> 8; let col = c.palId ? c.pal(counter / 255) : hsv(counter / 255);
      if (c.ix < 128) col = mix(col, [255, 255, 255], (128 - c.ix) / 255); return fill(c.n, () => col); },
    // mode_pacifica(): four layers of blue-green waves at different scales and speeds, white where
    // they line up; its own ocean colours unless a palette is chosen. A likeness, not a port.
    pacifica: (c) => { const g = c.palId ? c.pal : gradient([[0, 0, 20, 45], [100, 0, 45, 110], [170, 0, 110, 140], [230, 70, 200, 190], [255, 120, 230, 220]]);
      const ts = c.t * (0.25 + c.sx / 128) / 1000;
      return fill(c.n, (_, i) => { const v = (Math.sin(i / 9 + ts * 1.3) + Math.sin(i / 5.3 - ts * 1.9) + Math.sin(i / 14 + ts * 0.7) + 3) / 6;
        const col = g(v); const over = Math.max(0, v - 0.78) * 3; return mix(col, [200, 240, 255], over); }); },
    // spots_base(): still, evenly spaced soft pools of colour 1 over colour 2. The run is cut into
    // 1 + ix·(n/4)/256 zones (so about 1024/ix pixels each, whatever the length) and each zone lights
    // the part of a triangle wave above (255-sx)<<8, brightest in the middle.
    spots:   (c) => { const zones = 1 + ((c.ix * (c.n >> 2)) >> 8); const len = Math.max(1, Math.floor(c.n / zones));
      const off = (c.n - zones * len) >> 1; const thr = (255 - c.sx) << 8; const out = fill(c.n, () => bg(c));
      for (let z = 0; z < zones; z++) for (let i = 0; i < len; i++) {
        const u = Math.floor((i * 0xFFFF) / len); const w = u < 0x8000 ? u * 2 : 0xFFFF - (u - 0x8000) * 2;
        if (w > thr) { const idx = off + z * len + i; const s = (w - thr) / (0xFFFF - thr); out[idx] = mix(bg(c), palOrCol(c, 0, idx / c.n), s); } }
      return out; },
    candle:  (c) => { const k = .55 + .45 * Math.sin(c.t / 210) * Math.sin(c.t / 90 + 1.3); return fill(c.n, (_, i) => scale(c.col[0], clamp(k + .12 * Math.sin(c.t / 70 + i), .2, 1))); },

    // candle(multi): every pixel wanders on its own between colour 2 and colour 1, staying within
    // the top ix/255 of the range — so a deep-red colour 2 under an orange colour 1 reads as fire.
    candleMulti: (c) => { const rate = c.sx > 99 ? 140 : c.sx > 49 ? 260 : 420; const range = c.ix / 255;
      return fill(c.n, (_, i) => { const w = wobble(i, c.t, rate) * 0.6 + wobble(i + 97, c.t, rate * 2.3) * 0.4;
        return mix(bg(c), palOrCol(c, 0, i / c.n), 1 - range * (1 - w)); }); },
    // mode_fire_flicker(): colour 1 (or the palette) with a random dip per pixel, deeper at high ix
    fireFlicker: (c) => { const depth = 1 / (((256 - c.ix) >> 4) + 1);
      return fill(c.n, (_, i) => scale(palOrCol(c, 0, i / c.n), 1 - depth * wobble(i, c.t, 90))); },
    // mode_heartbeat(): the whole run pulses colour 1 over colour 2 — a full beat, a softer second
    // beat a third of the way in, and a decay set by ix. Only time varies, so the tile shows time.
    heartbeat: (c) => { const bpm = 40 + (c.sx >> 3); const per = 60000 / bpm; const tt = c.t % per;
      const tau = lerp(900, 250, c.ix / 255);
      const lvl = Math.max(Math.exp(-tt / tau), tt > per / 3 ? 0.75 * Math.exp(-(tt - per / 3) / tau) : 0);
      return fill(c.n, (_, i) => mix(bg(c), palOrCol(c, 0, i / c.n), lvl)); },
    // mode_static_pattern(): 1+sx pixels of colour 1, then 1+ix of colour 2, repeating. Scaled down
    // to fit when the preview has fewer pixels than one period, so the tile still shows both.
    staticPattern: (c) => { let lit = 1 + c.sx, unlit = 1 + c.ix; const per = lit + unlit;
      if (per > c.n) { lit = Math.max(1, Math.round(lit * c.n / per)); unlit = Math.max(1, Math.round(unlit * c.n / per)); }
      return fill(c.n, (_, i) => (i % (lit + unlit) < lit ? palOrCol(c, 0, i / c.n) : c.col[1])); },
    // mode_tri_static_pattern(): blocks of (ix>>5)+1 pixels in colours 1, 2, 3
    triPattern: (c) => { const size = Math.max(1, Math.min((c.ix >> 5) + 1, Math.floor(c.n / 3)));
      return fill(c.n, (_, i) => c.col[Math.floor(i / size) % 3]); },
    // mode_colorful(): a repeating run of single-pixel colours, stepping one pixel per cycle (and
    // still at speed 0). On the Default palette ix > 160 uses the three segment colours, 80-160 the
    // firmware's own red / gold / green / blue, and below 80 its pastels; any other palette gives
    // four samples of it (five for "C9 2", id 52).
    colorful: (c) => { const hex = (v) => [(v >> 16) & 255, (v >> 8) & 255, v & 255]; let cols;
      if (c.palId) cols = c.palId === 52 ? [0, 61, 122, 183, 244].map((p) => c.pal(p / 255)) : [0, 80, 160, 240].map((p) => c.pal(p / 255));
      else if (c.ix > 160) cols = [c.col[0], c.col[1], c.col[2]];
      else if (c.ix < 80) cols = [0xFF8040, 0xE5D241, 0x77FF77, 0x77F0F0].map(hex);
      else cols = [0xFF0000, 0xEEBB00, 0x00EE00, 0x0077CC].map(hex);
      const cyc = 50 + 8 * (255 - c.sx); const shift = c.sx > 0 ? Math.floor(c.t / cyc) : 0;
      return fill(c.n, (_, i) => cols[(i + shift) % cols.length]); },
    // mode_halloween_eyes(): colour 2 everywhere, one pair of eyes in a palette colour that fades
    // in, watches, blinks and goes out; the pair is a 32nd of the run apart
    eyes: (c) => { const on = lerp(1800, 7000, c.ix / 255), off = Math.max(600, c.sx * 128); const per = on + off;
      const gen = Math.floor(c.t / per); const tt = c.t % per; const out = fill(c.n, () => bg(c));
      if (tt > on) return out;
      const space = Math.max(2, c.n >> 5), w = Math.max(1, space >> 1), len = 2 * w + space;
      const start = Math.floor(hash(gen + 3) * Math.max(1, c.n - len));
      const k = Math.min(1, tt / 400) * (tt > on - 300 ? Math.max(0, (on - tt) / 300) : 1);
      const col = mix(bg(c), palOrCol(c, 0, hash(gen)), k);
      for (let j = 0; j < w; j++) { if (start + j < c.n) out[start + j] = col; if (start + w + space + j < c.n) out[start + w + space + j] = col; }
      return out; },
    // mode_perlinmove(): ix/16+1 dots wandering on noise, colour by position, trail from c1
    perlinMove: (c) => { const k = (c.ix >> 4) + 1; const out = fill(c.n, () => [0, 0, 0]);
      const trail = Math.max(1, (opt(c, 'c1', 128) / 255) * 6);
      for (let j = 0; j < k; j++) { const pos = wobble(j * 15, c.t, lerp(2600, 400, c.sx / 255)) * (c.n - 1);
        for (let d = 0; d < trail; d++) { const i = Math.round(pos - d); if (i >= 0 && i < c.n) out[i] = mix(out[i], palOrCol(c, 0, (i % 255) / 255), 1 - d / trail); } }
      return out; },
    // mode_palette(): the palette laid across the run — ix ≤ 128 shows that fraction of it, above
    // 128 it repeats (ix-112)/16 times — and only moves when "Animate Shift" (o1) is on
    paletteFx: (c) => { const span = c.ix <= 128 ? c.ix / 128 : (c.ix - 112) / 16;
      const cyc = 65536 / ((c.sx >> 3) + 1);
      const off = opt(c, 'o1', true) ? (c.t % cyc) / cyc : c.sx / 255;
      return fill(c.n, (_, i) => c.pal(((i / c.n) * span - off) % 1)); },
    wipe:    (c) => { const ph = phase(c, 6000, 500) * 2; const f = ph < 1 ? ph : 2 - ph; const e = f * c.n; return fill(c.n, (_, i) => ((ph < 1 ? i < e : i >= e) ? c.col[0] : bg(c))); },
    sweep:   (c) => { const ph = phase(c, 5000, 400) * 2; const pos = (ph < 1 ? ph : 2 - ph) * c.n; return fill(c.n, (_, i) => (i < pos ? c.pal(i / c.n) : bg(c))); },
    scan:    (c, dual) => { const ph = phase(c, 5000, 400) * 2; const pos = (ph < 1 ? ph : 2 - ph) * (c.n - 1); const w = Math.max(1, c.ix / 255 * c.n / 4);
      return fill(c.n, (_, i) => (Math.abs(i - pos) <= w / 2 || (dual && Math.abs((c.n - 1 - i) - pos) <= w / 2)) ? c.col[0] : bg(c)); },
    chase:   (c) => { const pos = phase(c, 4000, 300) * c.n; const w = Math.max(1, c.ix / 255 * c.n / 3);
      return fill(c.n, (_, i) => { const d = ((i - pos) % c.n + c.n) % c.n; return d < w ? (d < w / 2 ? c.col[1] : c.col[2]) : c.col[0]; }); },
    // "Chase 2" (running()) and "Chase 3" (tricolor_chase()) are not a window over a background —
    // they alternate solid bands across the *whole* run and march the bands sideways, which is
    // what makes candy-cane stripes read as candy-cane stripes rather than one dot on a red field.
    // Widths and cycle times mirror FX.cpp's own `1 + (intensity>>4)` and `50 + (255-speed)`, so on
    // the live-size preview (n close to the real LED count) the band count matches the real strip.
    // Capped to a fraction of n as well, or a tiny 9-cell catalogue swatch at a real band width of
    // 9+ would render as one flat colour and say nothing about what the look actually is.
    runningColor: (c) => { const w = Math.max(1, Math.min(1 + Math.floor(c.ix / 16), Math.round(c.n / 4)));
      const cyc = 50 + (255 - c.sx); const shift = Math.floor(c.t / cyc);
      return fill(c.n, (_, i) => (((i + shift) % (w * 2)) < w ? palOrCol(c, 0, i / c.n) : c.col[1])); },
    tricolorChase: (c) => { const w = Math.max(1, Math.min(1 + Math.floor(c.ix / 16), Math.round(c.n / 6)));
      const cyc = 50 + (255 - c.sx) * 2; const shift = Math.floor(c.t / cyc);
      // tricolor_chase(SEGCOLOR(2), SEGCOLOR(0)) and the third band through color_from_palette(…, 1):
      // on the Default palette that is colour 2, on "* Color 1" it is colour 1 again and colour 2
      // never shows — which is why the catalogue's three-colour looks use Default.
      return fill(c.n, (_, i) => { const pos = (i + shift) % (w * 3); return pos < w ? c.col[2] : pos < w * 2 ? c.col[0] : palOrCol(c, 1, i / c.n); }); },
    // running_base(): a = i*(ix>>2) - (t*sx>>9); brightness sin8(a) blends colour 1 over colour 2.
    // Wavelength is therefore 256/(ix>>2) pixels and the wave rolls at sx/512 units per ms.
    running: (c, dual) => { const xs = Math.max(1, c.ix >> 2); const counter = (c.t * c.sx) / 512;
      const wave = (a) => (Math.sin(((a % 256) / 256) * Math.PI * 2) + 1) / 2;
      return fill(c.n, (_, i) => {
        const ca = mix(c.col[1], palOrCol(c, 0, i / c.n), wave(i * xs - counter));
        if (!dual) return ca;
        // Running Dual: a second wave of colour 3 from the other end, and the two are averaged
        const cb = mix(c.col[1], palOrCol(c, 2, i / c.n), wave((c.n - 1 - i) * xs - counter));
        return mix(ca, cb, 0.5);
      }); },
    // running(…, theatre): one pixel of colour 1 (or the palette) in every 3 + (ix>>4), the rest
    // colour 2, the lit pixel stepping along once every 50 + (255-sx) ms — a marquee.
    theater: (c) => { const w = 3 + (c.ix >> 4); const step = Math.floor(c.t / (50 + (255 - c.sx))) % w;
      return fill(c.n, (_, i) => (i % w === step ? palOrCol(c, 0, i / c.n) : bg(c))); },
    theaterRainbow: (c) => { const step = Math.floor(c.t / speed(c, 800, 60)) % 3; return fill(c.n, (_, i) => (i + step) % 3 === 0 ? c.pal((i / c.n + c.t / 9000) % 1) : bg(c)); },
    comet:   (c) => { const pos = phase(c, 4000, 350) * c.n; const tail = Math.max(2, lerp(3, c.n / 2, c.ix / 255));
      return fill(c.n, (_, i) => { let d = pos - i; if (d < 0) d += c.n; return d < tail ? scale(c.col[0], 1 - d / tail) : bg(c); }); },
    // sinelon_base(): beatsin16(speed/10 bpm) positions one dot coloured through mcol 0; "Dual" adds
    // its mirror in colour 3 (or the same colour when 3 is off); fade_out(ix) leaves a trail.
    sinelon: (c, dual) => { const period = 600000 / Math.max(8, c.sx); const ph = (c.t % period) / period * Math.PI * 2;
      const pos = (Math.sin(ph) * .5 + .5) * (c.n - 1); const dir = Math.cos(ph) >= 0 ? 1 : -1;
      const trail = Math.max(1.5, (c.ix / 255) * c.n * 0.35);
      const c1 = palOrCol(c, 0, pos / c.n); const c2 = isOff(c.col[2]) ? c1 : c.col[2];
      return fill(c.n, (_, i) => {
        const d1 = (pos - i) * dir, d2 = ((c.n - 1 - pos) - i) * -dir;
        const a1 = d1 >= -0.5 && d1 < trail ? 1 - Math.max(0, d1) / trail : 0;
        const a2 = dual && d2 >= -0.5 && d2 < trail ? 1 - Math.max(0, d2) / trail : 0;
        let out = bg(c); if (a1) out = mix(out, c1, a1); if (a2) out = mix(out, c2, a2); return out;
      }); },
    // mode_larson_scanner(): one dot end to end and back (pass time from sx), fade_out(255-ix) for
    // the trail, colour through mcol 0; "Dual" mirrors it in colour 3, or the same colour when off.
    larson: (c, dual) => { const pass = lerp(2600, 90, c.sx / 255); const k = (c.t % (pass * 2)) / pass;
      const fwd = k < 1; const pos = (fwd ? k : 2 - k) * (c.n - 1); const dir = fwd ? 1 : -1;
      const trail = Math.max(1.5, (c.ix / 255) * c.n * 0.45);
      const c1 = palOrCol(c, 0, pos / c.n); const c2 = isOff(c.col[2]) ? c1 : c.col[2];
      return fill(c.n, (_, i) => {
        const d1 = (pos - i) * dir, d2 = ((c.n - 1 - pos) - i) * -dir;
        const a1 = d1 >= -0.5 && d1 < trail ? 1 - Math.max(0, d1) / trail : 0;
        const a2 = dual && d2 >= -0.5 && d2 < trail ? 1 - Math.max(0, d2) / trail : 0;
        let out = bg(c); if (a1) out = mix(out, c1, a1); if (a2) out = mix(out, c2, a2); return out;
      }); },
    juggle:  (c) => { const out = fill(c.n, () => scale(bg(c), .5));
      for (let k = 0; k < 4; k++) { const p = Math.round((Math.sin(c.t / (900 + k * 260)) * .5 + .5) * (c.n - 1)); out[p] = hsv((k / 4 + c.t / 12000) % 1); }
      return out; },
    bounce:  (c) => { const out = fill(c.n, () => bg(c));
      for (let k = 0; k < 3; k++) { const tt = (c.t / speed(c, 2600, 700) + k * .33) % 1; const y = 1 - Math.abs(Math.cos(tt * Math.PI * 2));
        const p = Math.round(y * (c.n - 1)); out[p] = c.palId > 1 ? c.pal(k / 3) : [c.col[0], c.col[1], c.col[2]][k]; }
      return out; },

    twinkle: (c) => { const st = c.st; const gen = Math.floor(c.t / speed(c, 2500, 150));
      if (st.gen !== gen) { st.gen = gen; st.on = new Set(); const k = Math.max(1, Math.round(c.n * lerp(.03, .4, c.ix / 255))); for (let j = 0; j < k; j++) st.on.add(Math.floor(Math.random() * c.n)); }
      return fill(c.n, (_, i) => st.on.has(i) ? c.pal(i / c.n) : bg(c)); },
    // twinklefox_base(): the background is colour 2 dimmed hard (1/16 if bright, 1/4, else 1/3),
    // each pixel twinkles on its own clock in a palette colour, and (ix>>5)+1 eighths of them are
    // active at a time. Twinklecat is the same with an instant-on, fade-off pulse.
    twinkleFox: (c, cat) => { const b = bg(c); const avg = (b[0] + b[1] + b[2]) / 3;
      const back = scale(b, avg > 64 ? 1 / 16 : avg > 16 ? 1 / 4 : 1 / 3);
      const density = ((c.ix >> 5) + 1) / 8; const cyc = c.sx > 100 ? 900 + (255 - c.sx) * 12 : 2200 + (100 - c.sx) * 40;
      return fill(c.n, (_, i) => {
        if (hash(i + 31) > density) return back;
        const ph = ((c.t / cyc) + hash(i)) % 1;
        const bright = cat ? 1 - ph : (ph < 0.34 ? ph / 0.34 : 1 - (ph - 0.34) / 0.66);
        return mix(back, c.pal(hash(i + 7)), Math.max(0, bright));
      }); },
    // mode_twinkleup(): colour 2 is the base at full brightness; (ix+1)/256 of the pixels sine-pulse
    // colour 1 (through the palette, mcol 0 — so colour 1 itself on Default) over it, each on its
    // own phase, one full swell every 16·(256-sx) ms. This is the one that keeps a lit base.
    twinkleUp: (c) => fill(c.n, (_, i) => {
      if (hash(i + 13) > (c.ix + 1) / 256) return bg(c);
      const k = (Math.sin(c.t / (16 * (256 - c.sx)) * Math.PI * 2 + hash(i) * 6.283) + 1) / 2;
      return mix(bg(c), palOrCol(c, 0, hash(i + 7)), k);
    }),
    // mode_fairytwinkle(): every pixel is a flasher in a random palette colour over colour 2,
    // switching on and off on its own timer with a soft rise and fall.
    fairyTwinkle: (c) => fill(c.n, (_, i) => {
      const cyc = lerp(5200, 900, c.sx / 255); const ph = ((c.t / cyc) + hash(i)) % 1;
      const duty = 0.35 + 0.4 * (c.ix / 255);
      const k = ph < duty ? Math.min(1, ph / 0.08, (duty - ph) / 0.08) : 0;
      return mix(bg(c), palOrCol(c, 0, hash(i + 7)), Math.max(0, k));
    }),
    colortwinkle: (c) => { const st = c.st; if (!st.lv || st.lv.length !== c.n) { st.lv = fill(c.n, () => 0); st.hue = fill(c.n, (_, i) => hash(i)); }
      // mode_colortwinkle(): over black, up to n/50+1 pixels a frame light in a random palette colour
      // (pure entries, no blending; Default is the Party palette) with chance ix/256, swell to full
      // at 8+sx/4 and fade at 8+sx/8 per frame. The palette entries are picked by index, as in WLED.
      const fall = (8 + (c.sx >> 3)) / 255 * 2.5; const spawn = ((c.n / 50 + 1) * (c.ix / 256)) / c.n * 3;
      for (let i = 0; i < c.n; i++) { if (st.lv[i] <= 0 && Math.random() < spawn) { st.lv[i] = 1; st.hue[i] = Math.floor(Math.random() * 16) / 16; } else st.lv[i] = Math.max(0, st.lv[i] - fall); }
      return fill(c.n, (_, i) => scale(c.pal(st.hue[i]), st.lv[i])); },
    sparkle: (c) => { const st = c.st; const gen = Math.floor(c.t / speed(c, 600, 30));
      if (st.gen !== gen) { st.gen = gen; st.i = Math.floor(Math.random() * c.n); }
      return fill(c.n, (_, i) => i === st.i ? (bg(c).some((v) => v) ? bg(c) : [255, 255, 255]) : c.col[0]); },
    glitter: (c) => { const st = c.st; const gen = Math.floor(c.t / 60);
      if (st.gen !== gen) { st.gen = gen; st.on = new Set(); const k = Math.max(1, Math.round(c.n * lerp(.02, .25, c.ix / 255))); for (let j = 0; j < k; j++) st.on.add(Math.floor(Math.random() * c.n)); }
      return fill(c.n, (_, i) => st.on.has(i) ? [255, 255, 255] : c.pal((i / c.n + c.t / 12000) % 1)); },
    fireworks: (c) => { const st = c.st; if (!st.p) st.p = [];
      if (Math.random() < lerp(.04, .3, c.sx / 255)) st.p.push({ x: Math.random() * c.n, a: 1, h: Math.random() });
      st.p = st.p.filter((p) => (p.a -= .045) > 0).slice(-8);
      const out = fill(c.n, () => bg(c));
      for (const p of st.p) { const w = (1 - p.a) * c.n * .18 + 1;
        for (let i = 0; i < c.n; i++) { const d = Math.abs(i - p.x); if (d < w) out[i] = mix(out[i], c.palId > 1 ? c.pal(p.h) : hsv(p.h), p.a * (1 - d / w)); } }
      return out; },
    rain:    (c) => { const st = c.st; if (!st.d) st.d = [];
      if (Math.random() < lerp(.05, .35, c.sx / 255)) st.d.push({ x: 0, h: Math.random() });
      for (const d of st.d) d.x += lerp(.15, .9, c.sx / 255);
      st.d = st.d.filter((d) => d.x < c.n).slice(-10);
      const out = fill(c.n, () => scale(bg(c), .8));
      for (const d of st.d) { const i = Math.round(d.x); if (i >= 0 && i < c.n) { out[i] = c.palId > 1 ? c.pal(d.h) : c.col[0]; if (i > 0) out[i - 1] = scale(out[i], .4); } }
      return out; },
    popcorn: (c) => { const st = c.st; if (!st.k) st.k = fill(6, (_, i) => ({ t: hash(i), h: hash(i + 9) }));
      const out = fill(c.n, () => bg(c));
      for (const k of st.k) { const tt = (c.t / speed(c, 2400, 800) + k.t) % 1; const y = Math.sin(tt * Math.PI);
        const p = Math.round(y * (c.n - 1)); if (p >= 0 && p < c.n) out[p] = c.palId > 1 ? c.pal(k.h) : hsv(k.h); }
      return out; },

    fire:    (c) => { const st = c.st; if (!st.heat || st.heat.length !== c.n) st.heat = new Array(c.n).fill(0);
      const cooling = lerp(80, 20, c.ix / 255), spark = lerp(.3, .9, c.sx / 255); const h = st.heat;
      for (let i = 0; i < c.n; i++) h[i] = Math.max(0, h[i] - Math.random() * cooling * 10 / c.n);
      for (let k = c.n - 1; k >= 2; k--) h[k] = (h[k - 1] + h[k - 2] + h[k - 2]) / 3;
      if (Math.random() < spark) { const y = Math.floor(Math.random() * Math.max(1, c.n / 7)); h[y] = Math.min(255, h[y] + 160 + Math.random() * 95); }
      const g = gradient(BUILTIN[35]); return h.map((v) => g(v / 255 * .98)); },
    lava:    (c) => { const g = gradient(BUILTIN[8]); const t = c.t / speed(c, 26000, 3000);
      return fill(c.n, (_, i) => g((Math.sin(i / 5 + t * 4) + Math.sin(i / 11 - t * 3) + 2) / 4)); },
    noise:   (c) => { const t = c.t / speed(c, 30000, 3000);
      return fill(c.n, (_, i) => c.pal((Math.sin(i / 7 + t * 5) + Math.sin(i / 13 - t * 3.7) + Math.sin(i / 3 + t * 1.7) + 3) / 6)); },
    plasma:  (c) => { const t = c.t / speed(c, 20000, 2500);
      return fill(c.n, (_, i) => { const v = (Math.sin(i / 4 + t * 6) + Math.sin((i + t * 40) / 9)) / 2;
        return scale(c.pal((v + 1) / 2), .45 + .55 * Math.abs(v)); }); },
    aurora:  (c) => { const g = c.palId > 1 ? c.pal : gradient(BUILTIN[50]); const t = c.t / speed(c, 26000, 4000);
      return fill(c.n, (_, i) => { const b = .35 + .65 * (Math.sin(i / 6 + t * 3) * .5 + .5);
        return scale(g((Math.sin(i / 9 - t * 2) * .5 + .5)), b); }); },

    rainbow: (c) => { const off = phase(c, 20000, 1500); const span = lerp(.25, 3, c.ix / 255); return fill(c.n, (_, i) => c.pal(off + (i / c.n) * span)); },
    rainbowSolid: (c) => { const h = phase(c, 20000, 1500); const col = c.palId > 1 ? c.pal(h) : hsv(h); return fill(c.n, () => col); },
    // mode_colorwaves(): the palette (or colour 1 on Default — it reads mcol 0) swept along the run
    // with a fold, ~(ix/128)·700 hue steps a pixel, under a brightness wave 6-10 pixels long that rolls
    // at (10+sx)·~40/65536 cycles a frame, so the run reads as soft travelling swells of colour.
    colorwaves: (c) => { const f = c.t / 25; const hueStep = 180 * c.ix * 10 / 255 / 65536 * 2;
      const drift = (f * (10 + c.sx) * 7 / 65536) * 2; const th = f * (10 + c.sx) * 40 / 65536;
      return fill(c.n, (_, i) => { let h = (drift + i * hueStep) % 2; if (h > 1) h = 2 - h;
        const b = Math.sin((th + i * 8000 / 65536) * Math.PI * 2) * 0.5 + 0.5; const bri = (255 - 160 + 160 * b * b) / 255;
        return scale(palOrCol(c, 0, h), bri); }); },
    pride:   (c) => { const t = c.t / speed(c, 30000, 3000);
      return fill(c.n, (_, i) => { const h = t + i / c.n + .1 * Math.sin(t * 5 + i / 9); const b = .5 + .5 * Math.sin(i / 2.5 + t * 14); return scale(hsv(h), .3 + .7 * b); }); },
    gradientPulse: (c) => { const pos = phase(c, 6000, 400) * c.n; const w = Math.max(2, c.n * lerp(.1, .6, c.ix / 255));
      return fill(c.n, (_, i) => { let d = Math.abs(i - pos); d = Math.min(d, c.n - d); return mix(c.col[0], c.col[1], clamp(d / w, 0, 1)); }); },
    randomColors: (c) => { const st = c.st; const gen = Math.floor(c.t / speed(c, 5000, 500));
      if (st.gen !== gen) { st.gen = gen; st.h = Math.random(); }
      const col = c.palId > 1 ? c.pal(st.h) : hsv(st.h); return fill(c.n, () => col); },
    dissolve: (c) => { const st = c.st; if (!st.o || st.o.length !== c.n) st.o = fill(c.n, (_, i) => hash(i));
      const k = phase(c, 6000, 800) * 2; const f = k < 1 ? k : 2 - k;
      return fill(c.n, (_, i) => (st.o[i] < f ? palOrCol(c, 0, i / c.n) : bg(c))); },
    police:  (c) => { const half = phase(c, 1400, 200) < .5;
      return fill(c.n, (_, i) => (i < c.n / 2) === half ? c.col[0] : (c.col[1].some((v) => v) ? c.col[1] : [0, 0, 255])); },
    twoDot:  (c) => { const pos = phase(c, 3000, 300) * c.n;
      return fill(c.n, (_, i) => { const d1 = ((i - pos) % c.n + c.n) % c.n, d2 = ((i - pos - c.n / 2) % c.n + c.n) % c.n;
        return d1 < 3 ? c.col[0] : d2 < 3 ? (c.col[1].some((v) => v) ? c.col[1] : [0, 120, 255]) : bg(c); }); },
    sunrise: (c) => { const k = phase(c, 40000, 6000); const g = gradient(BUILTIN[13]);
      return fill(c.n, (_, i) => scale(g(clamp(k * 1.2 - Math.abs(i / c.n - .5) * .3, 0, 1)), clamp(k * 1.4, .05, 1))); },
    fillUp:  (c) => { const k = phase(c, 7000, 900); const e = k * c.n;
      return fill(c.n, (_, i) => (i < e ? c.pal(i / c.n) : bg(c))); },
    ripple:  (c) => { const st = c.st; if (!st.r) st.r = [];
      // ripple_base(): rings grow to about (255/((sx>>4)+1))·(sx+1)/256 pixels, in a random palette
      // colour (always the palette), spawned more often at higher ix, over colour 2
      const max = Math.max(3, (255 / ((c.sx >> 4) + 1)) * (c.sx + 1) / 256);
      if (Math.random() < lerp(.02, .5, c.ix / 255) * Math.max(1, c.n / 60)) st.r.push({ x: Math.random() * c.n, a: 0, h: Math.random(), max });
      for (const r of st.r) r.a += r.max / 18;
      st.r = st.r.filter((r) => r.a < r.max).slice(-Math.max(5, c.n >> 4));
      const out = fill(c.n, () => bg(c));
      // each side of a ring is drawn four pixels wide in the firmware; three here
      for (const r of st.r) for (const s of [-1, 1]) for (let w = 0; w < 3; w++) { const i = Math.round(r.x + s * (r.a + w));
        if (i >= 0 && i < c.n) out[i] = mix(out[i], c.pal(r.h), clamp(1 - r.a / r.max, 0, 1) * (w === 1 ? 1 : 0.5)); }
      return out; },
    chunchun: (c) => { const t = c.t / speed(c, 4000, 700);
      return fill(c.n, (_, i) => { const d = Math.abs(((i / c.n * 6 + t) % 1) - .5);
        return d < .12 ? c.pal((i / c.n + t / 6) % 1) : bg(c); }); },
    washingMachine: (c) => { const t = Math.sin(c.t / speed(c, 4000, 900)) * c.n * .4;
      return fill(c.n, (_, i) => c.pal(((i + t) / c.n) % 1)); },
    tetrix:  (c) => { const st = c.st; const cyc = speed(c, 9000, 2000); const k = (c.t % cyc) / cyc;
      const settled = Math.floor(k * c.n); const drop = Math.round(lerp(0, c.n - settled - 1, ((c.t % (cyc / 6)) / (cyc / 6))));
      return fill(c.n, (_, i) => (i >= c.n - settled ? c.pal((c.n - i) / c.n) : i === drop ? c.pal(k) : bg(c))); },
  };

  // --------------------------------------------------------------- the map ----
  // Ordered: the first pattern that matches a name wins, so put the specific ones first.
  // Anything unmatched lands on the palette wave, which is a fair likeness of the many
  // palette-scrolling effects and is never a flat block of colour.
  const RULES = [
    [/^solid$/i, 'solid'],
    // Exact names first. Each of these is an effect the ready-made looks lean on, previewed from a
    // reading of its FX.cpp function rather than from what its name suggests.
    [/^solid pattern tri$/i, 'triPattern'],
    [/^solid pattern$/i, 'staticPattern'],
    [/^colorful$/i, 'colorful'],
    [/^heartbeat$/i, 'heartbeat'],
    [/^tri fade$/i, 'triFade'],
    [/^fade$/i, 'fade'],
    [/^breathe$/i, 'breathe'],
    [/^spots$/i, 'spots'],
    [/^theater$/i, 'theater'],
    [/^lightning$/i, 'lightning'],
    [/^railway$/i, 'railway'],
    [/^multi comet$/i, 'multiComet'],
    [/^meteor$/i, 'meteor'],
    [/^rainbow$/i, 'rainbowCycle'],
    [/^colorloop$/i, 'colorloop'],
    [/^pacifica$/i, 'pacifica'],
    [/^colorwaves$/i, 'colorwaves'],
    [/^colortwinkles$/i, 'colortwinkle'],
    [/^ripple$/i, 'ripple'],
    [/^halloween ?eyes$/i, 'eyes'],
    [/^perlin ?move$/i, 'perlinMove'],
    [/^palette$/i, 'paletteFx'],
    [/^twinklefox$/i, (c) => F.twinkleFox(c, false)],
    [/^twinklecat$/i, (c) => F.twinkleFox(c, true)],
    [/^twinkleup$/i, 'twinkleUp'],
    [/^fairytwinkle$/i, 'fairyTwinkle'],
    [/^candle multi$/i, 'candleMulti'],
    [/^fire flicker$/i, 'fireFlicker'],
    [/^running dual$/i, (c) => F.running(c, true)],
    [/^running$/i, (c) => F.running(c, false)],
    [/^sinelon dual$/i, (c) => F.sinelon(c, true)],
    [/^sinelon( rainbow)?$/i, (c) => F.sinelon(c, false)],
    [/^scanner dual$/i, (c) => F.larson(c, true)],
    [/^scanner$/i, (c) => F.larson(c, false)],
    [/police|two dots|twodots/i, 'police'],
    [/^two dots|dots$/i, 'twoDot'],
    [/theater.*(rainbow|palette)/i, 'theaterRainbow'],
    [/theater|marquee/i, 'theater'],
    [/strobe|lightning/i, 'strobe'],
    [/blink|flash/i, 'blink'],
    [/breath/i, 'breathe'],
    [/candle|flicker/i, 'candle'],
    [/fade|pulse$/i, 'fade'],
    [/colou?rtwinkle|twinkle ?(fox|cat|up|down)/i, 'colortwinkle'],
    [/fairy ?twinkle|twinkle/i, 'twinkle'],
    [/glitter|sparkle ?(dark)?|solid ?glitter/i, 'glitter'],
    [/^sparkle/i, 'sparkle'],
    [/firework|starburst|exploding/i, 'fireworks'],
    [/rain|drip|tears/i, 'rain'],
    [/popcorn|jump/i, 'popcorn'],
    [/bouncing|balls|ball ?trail/i, 'bounce'],
    [/juggle/i, 'juggle'],
    [/sinelon|dot ?beat|flow ?stripe/i, 'sinelon'],
    [/comet|meteor|chase ?flash|shooting/i, 'comet'],
    [/ripple|circus|wavesins?/i, 'ripple'],
    [/fire ?2012|^fire$|flame|bonfire/i, 'fire'],
    [/lava|magma/i, 'lava'],
    [/aurora|northern/i, 'aurora'],
    [/plasma|phased|sine|osci/i, 'plasma'],
    [/noise|perlin|fractal|drift|midnoise|freq|gravi|matripix|pixelwave|puddle|waterfall|blurz|^dj|binmap|^gev/i, 'noise'],
    [/pride/i, 'pride'],
    [/colou?rwaves|colou?rloop|lake|sunset|candy ?cane|rainbow ?cycle/i, 'colorwaves'],
    [/rainbow ?runner|running ?(dual|random|colou?rs)?/i, 'running'],
    [/rainbow/i, 'rainbow'],
    [/scan ?dual|dual ?scan/i, (c) => F.scan(c, true)],
    [/scan|larson|cylon|kitt/i, (c) => F.scan(c, false)],
    [/sweep|percent|fill ?up|loading|heartbeat/i, 'sweep'],
    [/wipe|scroll/i, 'wipe'],
    // Named matches, ahead of the generic "chase" catch-all below: these two are a full-strip
    // banded marching pattern (candy-cane stripes), not a single window over a background.
    [/^chase 2$/i, 'runningColor'],
    [/^chase 3$/i, 'tricolorChase'],
    [/chase|circus/i, 'chase'],
    [/dissolve/i, 'dissolve'],
    [/sunrise|sunset ?fade|day ?night/i, 'sunrise'],
    [/tetri|stack|game ?of ?life/i, 'tetrix'],
    [/washing|spin/i, 'washingMachine'],
    [/chunchun|flock|birds/i, 'chunchun'],
    [/random ?colou?rs?|colou?r ?wipe ?random|lissajous/i, 'randomColors'],
    [/gradient|^dual|android|multi ?comet/i, 'gradientPulse'],
    [/static ?pattern|pattern|tri ?wave|saw|stripe|barber/i, 'wipe'],
    [/^(pal|palette)/i, 'rainbow'],

    // The rest, named individually rather than left to the default. Grouped by what they look
    // like on a line of lights, which is all this has to get right.
    [/copy ?segment|image|slow ?transition|blends/i, 'gradientPulse'],
    [/dynamic|colou?rful|shimmer|tartan|blobs|waving ?cell/i, 'colortwinkle'],
    [/traffic ?light|railway|pac ?man|akemi|box$/i, 'twoDot'],
    [/stream|flow|soap|distortion|swirl|rotozoom|frizzles|hiphotic|squared/i, 'washingMachine'],
    [/lighthouse|pulser|ghost ?rider|spaceship|crazy ?bees|pinball|vortex|galaxy|attractor|springy/i, 'comet'],
    [/fairy|spots|pixels|ball ?pit|dancing ?shadows/i, 'twinkle'],
    [/icu|black ?hole|julia|octopus|sun ?radiation|polar/i, 'plasma'],
    [/bpm|rocktaves|sonic|geq|funky|bursts|impact|boom/i, 'colorwaves'],
    [/volcano|fire ?1d|^ps fire/i, 'fire'],
    [/spray|hourglass|balance|nova/i, 'rain'],
    [/pacifica/i, 'aurora'],
    [/dna|plasmoid|waverly/i, 'plasma'],
    [/matrix/i, 'rain'],
    [/tv ?simulator|color ?clouds|shimmer|blobs|tartan|waving ?cell|colou?rful|dynamic/i, 'colortwinkle'],
    [/gravcenter|gravcentric/i, 'sinelon'],
    [/lissajous|rainbow ?runner|chase ?rainbow/i, 'washingMachine'],
  ];

  const cache = new Map();
  function familyFor(name) {
    const key = String(name || '');
    if (cache.has(key)) return cache.get(key);
    let fn = F.noise;   // the default: moving, palette-coloured, never a flat block
    for (const [re, fam] of RULES) if (re.test(key)) { fn = typeof fam === 'function' ? fam : F[fam]; break; }
    cache.set(key, fn);
    return fn;
  }

  // Effect names as the controller reports them, so an id can be resolved to a family.
  let NAMES = [];
  const useNames = (arr) => { if (Array.isArray(arr) && arr.length) { NAMES = arr; cache.clear(); } };

  function render(fx, ctx) {
    ctx.col = ctx.col || [[255, 160, 0], [0, 0, 0], [0, 0, 0]];
    while (ctx.col.length < 3) ctx.col.push([0, 0, 0]);
    ctx.palId = ctx.palId ?? 0;
    ctx.pal = ctx.pal || paletteFn(ctx.palId, ctx.col, ctx.palData);
    ctx.st = ctx.st || {};
    ctx.n = Math.max(1, ctx.n | 0);
    // o1-o3 / c1-c3 are optional; a family that reads one uses the firmware's default when absent
    const name = typeof fx === 'string' ? fx : (NAMES[fx] || '');
    const bri = clamp((ctx.bri ?? 255) / 255, 0, 1);
    let out;
    try { out = familyFor(name)(ctx); } catch { out = F.solid(ctx); }
    return out.map((c) => (c || [0, 0, 0]).map((v) => Math.round(clamp(v, 0, 255) * bri)));
  }

  // A tile is one frame, and some effects are momentarily blank — a blink between flashes, a
  // firework before it launches. Sample several moments and keep the one with the most going on,
  // so the picture is of the effect rather than of an unlucky instant.
  function still(fx, ctx) {
    let best = null, bestScore = -1;
    // Effects built out of particles — fireworks, rain, twinkles — have nothing on screen for
    // their first few frames. Run the state forward before judging what the tile should show.
    const warm = () => { const st = {}; for (let k = 0; k < 24; k++) render(fx, { ...ctx, t: k * 90, st }); return st; };
    for (const t of [400, 900, 1500, 2300, 3400, 5000]) {
      const out = render(fx, { ...ctx, t, st: warm() });
      const uniq = new Set(out.map((c) => c.join(','))).size;
      const lit = out.reduce((a, c) => a + c[0] + c[1] + c[2], 0) / out.length;
      const score = uniq * 100 + Math.min(lit, 300);
      if (score > bestScore) { bestScore = score; best = out; }
    }
    // Some effects — blink, breathe, fade, a single colour cycling — are the same all the way
    // along the run and only change over time. A still frame of one of those is a flat block and
    // says nothing, so show the time axis instead: each cell is a later moment.
    if (new Set(best.map((c) => c.join(','))).size <= 1) {
      const n = ctx.n | 0;
      // Several step sizes, because a fixed one can beat against the effect's own period and
      // sample the same moment every time — a strobe caught dark on every cell.
      for (const step of [271, 617, 113, 1013, 47]) {
        const st = {};
        const strip = [];
        for (let i = 0; i < n; i++) strip.push(render(fx, { ...ctx, n: 1, t: 150 + i * step, st })[0]);
        if (new Set(strip.map((c) => c.join(','))).size > 1) return strip;
      }
    }
    return best;
  }

  // Everything can be previewed now, so this is a formality kept for older call sites.
  const supported = { includes: () => true, length: Infinity };

  window.FX = { render, still, useNames, supported, familyFor, paletteFn, hsv, families: Object.keys(F) };
})();
