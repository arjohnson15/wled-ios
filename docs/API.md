# JTS cloud API, the parts the iPhone app needs

Base URL: **`https://wled.cloudjohnson.com`**. JSON in and out. The server source is not in
this repo (it lives in Andrew's private workspace); this document is the contract. Anything
marked **NOT BUILT** is a proposal: mock it, and the server will be built to match.

---

## 1. Auth

```
POST /api/auth/login   {"email": "...", "password": "..."}
→ 200 {"ok": true, "token": "<opaque>", "user": {"id", "email", "name", ...}}
→ 401 {"error": "invalid email or password"}     429 when throttled
```

Send `Authorization: Bearer <token>` on every request afterwards (the cookie the server also
sets is for browsers; ignore it). Keep the token in the **Keychain**.

- Sessions **never expire on the server**. A `401` means the user signed out elsewhere or reset
  their password: go back to sign-in.
- `POST /api/auth/logout` ends this session. `GET /api/auth/me` → `{user}`.
- `POST /api/auth/signup {"email","password","name"}` (password 10-128 chars) → `201`, same shape
  as login. `GET /api/auth/status` → `{signupEnabled, firstRun, publicUrl, canEmail}`.
- `POST /api/auth/forgot {"email"}` sends a reset link when the server has email set up
  (`canEmail`).

Never put credentials in code, plists, logs or the repo. Andrew types his own at runtime.

## 2. Errors

Every error is `{"error": "a sentence a person can read"}` with a real status:
`400` bad input · `401` not signed in · `403` not allowed (role) · `404` not found / not yours ·
`409` conflict · `429` slow down · `502` the controller answered with a problem · `503` the
controller is offline · `504` the controller didn't answer in time (8 s, 20 s for config).
Show the sentence; it is written for users.

## 3. Roles

Each device carries `role`: `owner` > `configure` > `control` > `view`.
- `view`: read only. Writes return 403.
- `control`: can change state (on/off, brightness, looks, colours).
- `configure`, `owner`: also setup. Only `owner` can remove, rename-follow, relink.

## 4. Controllers

```
GET /api/devices
→ {"devices": [{
     "id": "dev_ef5303825903", "name": "House Lights", "online": true, "stalled": false,
     "role": "owner", "lanIp": "10.0.1.196", "mac": "...", "ver": "16.0.1", "build": "...",
     "follows": null, "followers": [], "followOpts": null,
     "state": {"on": true, "bri": 128, "ps": -1},     // cached summary only
     "updateAvailable": false, "ui": "/d/dev_.../"
   }]}
GET /api/devices/:id            → {"device": {...same...}}
PATCH /api/devices/:id {"name"} → rename (configure)
```

`stalled: true` = connected but not answering requests; treat like offline.

### 4.1 Reading a controller (all relayed to the device, so they can 503/504)

| Request | Returns (WLED JSON) |
|---|---|
| `GET /api/devices/:id/state` | full state: `on`, `bri` (0-255), `transition`, `ps`, `ledmap`, `seg: [...]` |
| `GET /api/devices/:id/info` | `name`, `ver`, `leds: {count, ...}`, `time` ("2026-11-2, 21:58:07"), ... |
| `GET /api/devices/:id/relay/json/eff` | effect names, index = effect id |
| `GET /api/devices/:id/relay/json/pal` | palette names, index = palette id |
| `GET /api/devices/:id/relay/json/fxdata` | per-effect metadata string, same index (slider names, colour-slot roles, flags, defaults) |
| `GET /api/devices/:id/presets` | the controller's saved scenes |

A segment (= **zone**) in `state.seg[]`:

```json
{"id": 0, "n": "Front roof", "start": 0, "stop": 180, "len": 180, "on": true, "bri": 255,
 "col": [[255,0,0],[255,255,255],[0,0,0]], "fx": 28, "sx": 180, "ix": 64, "pal": 0,
 "c1": 128, "c2": 128, "c3": 16, "o1": false, "o2": false, "o3": false,
 "sel": true, "rev": false, "mi": false, "grp": 1, "spc": 0, "of": 0, "frz": false}
```

`n` may be missing on an unnamed zone: show "Zone {id+1}". `col` entries can have a 4th value
(white channel); use the first three. Effect and palette lists are **per controller** and the
ids differ between firmware builds: cache them per `(deviceId, ver/build)` and always map by
**name** when moving a look between controllers.

## 5. Real-time: `WS /api/ws?token=<token>`

On connect: `{"type":"hello","devices":[{"id","online","state"}]}`. Then:

| Message | Meaning |
|---|---|
| `{"type":"device","id","online":true/false}` | came online / went offline |
| `{"type":"state","id","state":{...full WLED state...}}` | something changed the lights (this app, the web panel, a schedule, a button on the box) |
| `{"type":"live","id","leds":["ff0000",...],"n":4}` | live colours, after subscribing |

### 5.2 Live colours

Send `{"live":"dev_x","on":true}` to start, `{"live":"dev_x","on":false}` to stop. `leds` are
hex colours sampled evenly across the whole controller (every `n`th LED), a few times a second.
Subscribe only for what's on screen. The controller answers these from the same loop that
drives the lights, so never poll `/live` over HTTP yourself.

Reconnect with backoff (1 → 16 s, jitter). After a reconnect, re-fetch state.

## 6. Writing

### 6.1 The one write

```
POST /api/devices/:id/state      (role ≥ control)
body: any WLED state JSON, e.g. {"on": true, "bri": 200}
```

Add `"v": true` to get the full new state back in the response. Otherwise rely on the WS
`state` push.

**Always address zones by explicit id** in `seg` (`{"seg":[{"id":1, ...}]}`). Never send a `seg`
object without `id`: the firmware then applies it to every zone whose `sel` flag is set, which
is how zones "cross-talked" on Andrew's house. Do not change `sel`.

### 6.2 Light one zone so the user can find it (matching step, §4.4 of DESIGN)

Uses WLED's per-pixel field `i`, which **freezes** the zone on that pattern; nothing about the
zone's look is changed, and `frz:false` resumes it exactly.

```json
POST /api/devices/:id/state
{"on": true, "bri": 160,
 "seg": [
   {"id": 0, "i": [0, 180, "FFB35C", 0, "00DC00"]},   // the zone to find: amber, pixel 1 green
   {"id": 1, "i": [0, 130, "000000"]}                  // every other zone on this controller: dark
 ]}
```

`i` takes `[start, stop, "RRGGBB"]` ranges and `[index, "RRGGBB"]` singles, indexes relative to
the zone (0 = its first pixel; `stop` = `len`). Restore:

```json
{"on": <was>, "bri": <was>, "seg": [{"id": 0, "frz": false}, {"id": 1, "frz": false}]}
```

Restore on finish, cancel, back, and when the app is backgrounded. A frozen zone left behind
stays frozen until someone unfreezes it.

### 6.3 Apply a look to the picked zones

Per controller (in parallel, independent, report each result):

1. Resolve the look against that controller's effect/palette names (`resolve()` in
   `reference/holidays.js`: first matching name wins; no effect match → skip this controller).
2. Send one write with every picked zone of that controller:

```json
{"seg": [
  {"id": 0, "fx": 28, "pal": 0, "sx": 180, "ix": 64,
   "c1": 128, "c2": 128, "c3": 16, "o1": false, "o2": false, "o3": false,
   "col": [[255,0,0],[255,255,255],[0,0,0]]},
  {"id": 1, "fx": 28, ...}
]}
```

Send every slider/checkbox explicitly: the firmware only resets them when the effect changes,
so leaving them out keeps the previous look's values.

### 6.4 Brightness and power

Brightness is per controller: `{"bri": 0-255}`. The UI shows percent (`round(bri/2.55)`).
Power: `{"on": true|false}` (`"on":"t"` toggles). Per-zone on/off is `{"seg":[{"id":1,"on":false}]}`.

### 6.5 Colour

`{"seg":[{"id":0,"col":[[r,g,b],[r,g,b],[r,g,b]]}]}`. To change one slot, send all three with
the other two as they currently are.

### 6.6 Rate

While a finger is dragging (wheel, brightness): **one write in flight per controller**, the next
no sooner than **120 ms** later, with the pending changes merged into it. The last value must
always be sent. This keeps the lights following the finger without flooding a small controller.

### 6.7 Copy to

Client-side, no special endpoint: read the source zone from the latest state, then for each
target controller send one write with the target zone ids and only the chosen parts:

| Chip | Fields |
|---|---|
| The look | `fx`, `pal` (mapped **by name** to the target's lists), `c1-c3`, `o1-o3`, `rev`, `mi` |
| Colours | `col` |
| Speed | `sx`, `ix` |
| Brightness | controller-level `bri` (and `on: true`) |

Always add `"on": true` for the target controller. Never copy `start`, `stop`, `len`, `grp`,
`spc`, `of` (zone geometry) or `n` (name).

### 6.8 Mirroring ("Keep in step"), for reference only

Permanent following already exists: `PATCH /api/devices/:id {"follows": "<masterId>" | null,
"followOpts": {"power","bri","fx","feel","col"}}` (owner only). Not part of the v1 app.

## 7. House photo

| Request | |
|---|---|
| `POST /api/photos` | raw JPEG/PNG/WebP body, `Content-Type: image/jpeg`, `X-Photo-Name: <url-encoded>`; max 12 MB → `201 {"id","name","mime","width","height"}` |
| `GET /api/photos` | `{"photos":[{"id","name","mime","width","height","device_id","created_at"}]}` |
| `GET /api/photos/:pid` | `{"photo":{...}, "runs":[{"id","device_id","seg_id","name","led_start","led_count","points":[[x,y],...]}]}` |
| `GET /api/photos/:pid/image` | the image bytes |
| `PATCH /api/photos/:pid {"name"}`, `DELETE /api/photos/:pid` | |
| `PUT /api/photos/:pid/runs {"runs":[...]}` | replaces all runs; see below |

A run in `PUT`: `{"id"?: "run_<12 hex>", "deviceId", "segId", "name", "ledStart", "ledCount",
"points": [[x,y], ...]}`. Points are **normalised 0..1** (x across the image width, y down the
height), 2-500 per run, **ordered from the zone's pixel 1**. Up to 200 runs. Note the response
of `GET` uses snake_case (`device_id`, `seg_id`, `led_start`, `led_count`).

Resize photos to ≤ 2048 px on the long side and JPEG ~0.8 before upload.

### 7.1 Auto-trace (NOT BUILT)

```
POST /api/photos/:pid/trace
→ 200 {"lines": [{"points": [[x,y], ...], "confidence": 0.0-1.0}], "model": "..."}
→ 409 {"error": "Add an AI key on the web panel to find lines automatically"}   // no key
```

Server side: a vision model (the account's own AI key, the same one AI scenes use) proposes the
lines, then the server snaps them to strong edges in the photo. Expect 3-10 s; show progress and
allow cancel. For the mock, return `autoTraceResult` from `reference/mock-data.json` after 2 s.
With no key or on failure, the app falls back to drawing lines by hand (the same editor, starting
empty).

## 8. Household (who can see what)

`GET /api/household` → `{"members":[...], "invites":[...], "partOf":[{"role","share_ai",
"owner_name","owner_email"}], "roles":[...]}`. `partOf` is the list of other people's
households this user belongs to; use `owner_name` for the "Shared with you" grouping and
"shared by …" labels. Devices from those households appear in `/api/devices` with a non-owner
`role`.

## 9. Things not to call from the app

`/api/firmware*`, `/api/backups*`, `/api/admin*`, `/d/*` (the stock web UI), anything writing
`/json/cfg`. Those belong to the web panel.
