---
name: clip
description: Cut the person's clips on the song's beats: one long shot over the quiet intro, then a hard cut on every beat from the drop. Nothing added.
---

# CLIP: footage on the beat, nothing else

A long shot over the song's quiet intro, then one hard cut per beat from the drop, ending on a cut to black. About
14 s. The motion is all the footage's own: camera moves, things flying through frame, light. No text, zooms, flashes,
transitions or grade. Measured off a real edit (a company's product films on a hard-hitting song).

## The format

| | |
|---|---|
| frame | 1920x1080 at an even multiple of the clips' shared frame rate (all 25 → 50, 24 → 48, 30 → 60; mixed → 60), so every source frame is held equally long. No interpolation |
| sound | the song alone, faded over the black tail |
| picture | the footage as it comes: scaled and cropped to fill 16:9, no stretch, flash or transition added |

## The rules

- **One shot for the whole intro.** Nothing cuts before the drop. Pick a shot that moves on its own for 3-5 s (a slow
  dolly, a pull back); the first cut lands on the drop's hit.
- **From the drop, one hard cut per beat.** Most shots get 1 beat. One shot can get 2 (a slow reveal); one pair can
  split a 2-beat slot 1.5 + 0.5 with the same subject in another look, the swap on the off-beat.
  - **Only where the song has the hit.** Cut on every kick and follow the song's own accents: an 808 roll gets
    fractional beats (`.75, .75, .5`) landing on each hit. Check each cut against the drums before calling it done.
- **The cut sits on the hit**, not on a rigid grid: the renderer moves every grid cut to the nearest onset within
  60 ms.
- **The editor adds nothing.** Every move is the footage's. A shot that sits still dies on a 0.68 s cut, so skip
  static ones.
- **High quality is the footage.** Prefer the sharpest clips; never pick a moment with lower thirds, banners or
  subtitles over the picture.
- **One subject, a story in pictures:** the people and the place → the process up close → the main thing revealed
  (wide, then close) 2-3 beats before the end → one more detail → black.
- **The cuts keep the look turning:** bright → dark → warm → cold. Neighbouring shots differ in colour or scale so
  every cut reads.

## edit.json

```json
{ "style": "clip", "song": "song.wav", "drop_s": null, "tail_s": 1.55,
  "layers": [
    { "id": "intro", "src": "clips/cleanroom.mp4", "src_in_s": 12.0, "beats": null },
    { "id": "laser", "src": "clips/laser.mp4", "src_in_s": 3.1, "beats": 1 },
    { "id": "pattern", "src": "clips/pattern.mp4", "src_in_s": 1.0, "beats": 1.5, "crop": 1.3 } ] }
```

- The first layer's `beats` is `null`: it runs from 0 to the drop. Every other layer's `beats` is a multiple of 0.25.
- `src` is a file under `clips/`; `src_in_s` is where in that clip the shot starts. The clip must run long enough
  for the shot, or the render stops with an error that says how much it needs.
- `drop_s`: leave `null` to detect it. If the song-timing command gives a drop that's clearly wrong (by ear: where the
  song gets loud), set it here.
- `crop` (optional, at least 1) zooms in from the centre, to take a corner logo off. Only on clips at least
  1080 × crop pixels tall, so nothing is upscaled.
- `id`s are short, unique, lowercase (`a-z 0-9 _ -`).
- About 14 beats after the drop is a good length.

## Checking

After a render, `renders/timeline.json` lists each layer's `start_f` and `end_f`. Render stills at every cut
(`start_f` of each layer, plus a frame in the middle of the intro), look at each one, and re-cut any shot that is
static, has text over it, or crops a face out. `cuts_ok: false` means two neighbouring shots look too alike to read as
a cut: change one.
