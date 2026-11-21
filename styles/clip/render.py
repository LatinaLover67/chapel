# python render.py edit.json renders/final.mp4 [--fast]
# python render.py edit.json renders/stills --frames 0 300 390
# python render.py --beat song.wav

import json, os, re, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scripts'))
from clip import beat, cut, rate, times, verify, W, H  # noqa: E402


class EditError(Exception):
    pass


def _inside(root, rel):
    p = os.path.realpath(os.path.join(root, rel))
    return p if p.startswith(os.path.realpath(root) + os.sep) else None


def load_edit(path):
    path = os.path.abspath(path)
    root = os.path.dirname(path)
    try:
        e = json.load(open(path, encoding='utf-8'))
    except (OSError, ValueError) as x:
        raise EditError(f'edit.json can\'t be read: {x}')
    if e.get('style') != 'clip':
        raise EditError('edit.json is not a clip edit (style must be "clip").')
    song = _inside(root, e.get('song') or '')
    if not song or not os.path.isfile(song):
        raise EditError(f'The song {e.get("song")} is missing from this edit.')
    layers = e.get('layers') or []
    if len(layers) < 2:
        raise EditError('An edit needs at least 2 layers: the intro and one shot.')
    seen = set()
    for i, l in enumerate(layers):
        lid = str(l.get('id', ''))
        if not re.fullmatch(r'[a-z0-9_-]+', lid) or lid in seen:
            raise EditError(f'Layer {lid or i}: ids must be unique and use only a-z, 0-9, _ and -.')
        seen.add(lid)
        src = str(l.get('src', ''))
        p = _inside(os.path.join(root, 'clips'), os.path.relpath(os.path.join(root, src), os.path.join(root, 'clips')))
        if not p:
            raise EditError(f'Layer {lid}: its clip must be inside clips/.')
        if not os.path.isfile(p):
            raise EditError(f'Layer {lid}: {src} doesn\'t exist.')
        if not isinstance(l.get('src_in_s'), (int, float)) or l['src_in_s'] < 0:
            raise EditError(f'Layer {lid}: src_in_s must be 0 or more seconds.')
        b = l.get('beats')
        if i == 0:
            if b is not None:
                raise EditError('The first layer runs to the drop: set its beats to null.')
        elif not isinstance(b, (int, float)) or b <= 0 or abs(b * 4 - round(b * 4)) > 1e-9:
            raise EditError(f'Layer {lid}: beats must be a multiple of 0.25.')
        if l.get('crop') is not None and (not isinstance(l['crop'], (int, float)) or l['crop'] < 1):
            raise EditError(f'Layer {lid}: crop must be 1 or more.')
        l['_path'] = p
    e['_root'], e['_song'] = root, song
    return e


def _shots(e):
    return [(l['_path'], float(l['src_in_s']), l['beats'], *([float(l['crop'])] if l.get('crop') else []))
            for l in e['layers']]


def _partial(out):
    stem, ext = os.path.splitext(out)
    return f'{stem}.partial{ext}'


def watermark_png(chapel, text, path):
    from PIL import Image, ImageDraw, ImageFont
    lines = (['made with chapel'] if chapel else []) + ([text] if text else [])
    if not lines:
        return False
    font = ImageFont.load_default(size=28)
    probe = ImageDraw.Draw(Image.new('L', (1, 1)))
    w = max(probe.textbbox((0, 0), s, font=font)[2] for s in lines) + 4
    img = Image.new('RGBA', (w, 36 * len(lines) + 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, s in enumerate(lines):
        d.text((2, 2 + 36 * i), s, font=font, fill=(0, 0, 0, 160))
        d.text((0, 36 * i), s, font=font, fill=(255, 255, 255, 179))
    img.save(path)
    return True


def _watermark(edit_root):
    try:
        return json.load(open(os.path.join(edit_root, 'chapel.json'), encoding='utf-8'))['watermark']
    except (OSError, ValueError, KeyError):
        return {'chapel': True, 'text': None}


def _enc(fast):
    return ['-c:v', 'libx264', '-crf', '30' if fast else '10', '-preset', 'ultrafast' if fast else 'medium',
            '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709']


def stills(edit_path, out_dir, frames):
    e = load_edit(edit_path)
    shots = _shots(e)
    drop, P = beat(e['_song'], e.get('drop_s'))
    fps = rate([s[0] for s in shots])
    b = times(e['_song'], drop, P, shots, fps=fps)
    os.makedirs(out_dir, exist_ok=True)
    out = []
    for f in frames:
        if f < 0 or f >= b[-1]:
            raise EditError(f'frame {f} is past the end ({b[-1]}).')
        k = max(i for i in range(len(shots)) if b[i] <= f)
        src, t_in, _, *z = shots[k]
        z = z[0] if z else 1
        path = os.path.join(out_dir, f'f{f:04d}.jpg')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t_in + (f - b[k]) / float(fps):.3f}', '-i', src,
                        '-frames:v', '1', '-vf', f'scale={round(W * z)}:{round(H * z)}:force_original_aspect_ratio='
                        f'increase:flags=lanczos,crop={W}:{H}', '-q:v', '3', path], check=True)
        out.append(path)
    return out


def render(edit_path, out_path, fast=False):
    e = load_edit(edit_path)
    shots = _shots(e)
    drop, P = beat(e['_song'], e.get('drop_s'))
    fps = rate([s[0] for s in shots])
    tmp, tmp2, png = _partial(out_path), _partial(out_path) + '.mark.mp4', _partial(out_path) + '.mark.png'
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    try:
        cuts = cut(e['_song'], shots, tmp, drop, P, tail=float(e.get('tail_s', 1.55)), fps=fps,
                   crf=30 if fast else 10, preset='ultrafast' if fast else 'veryslow')
        wm = _watermark(e['_root'])
        if watermark_png(wm.get('chapel', True), wm.get('text'), png):
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-i', png, '-filter_complex',
                            '[0:v][1:v]overlay=W-w-32:H-h-28', *_enc(fast), '-c:a', 'copy', '-movflags', '+faststart',
                            tmp2], check=True)
            os.replace(tmp2, tmp)
        try:
            os.replace(tmp, out_path)
        except PermissionError:
            raise EditError('the video is open somewhere else (a player or another program). Close it and render again.')
    finally:
        for t in (tmp, tmp2, png):
            if os.path.exists(t):
                os.remove(t)
    b = [0] + list(cuts)
    timeline = {'fps': float(fps), 'drop_s': round(drop, 3), 'beat_s': round(P, 4), 'end_f': b[-1],
                'cuts_ok': bool(verify(out_path, cuts)),
                'layers': [{'id': l['id'], 'start_f': b[k], 'end_f': b[k + 1]} for k, l in enumerate(e['layers'])]}
    with open(os.path.join(os.path.dirname(os.path.abspath(out_path)), 'timeline.json'), 'w', encoding='utf-8') as f:
        json.dump(timeline, f, indent=1)
    return timeline


def main(argv):
    try:
        if argv[:1] == ['--beat'] and len(argv) == 2:
            drop, P = beat(argv[1])
            print(json.dumps({'drop_s': round(drop, 3), 'beat_s': round(P, 4)}))
            return 0
        if '--frames' in argv:
            i = argv.index('--frames')
            if i != 2 or len(argv) < 4:
                raise EditError('usage: render.py edit.json out_dir --frames F [F ...]')
            stills(argv[0], argv[1], [int(f) for f in argv[3:]])
            return 0
        args = [a for a in argv if not a.startswith('--')]
        if len(args) != 2:
            raise EditError('usage: render.py edit.json out.mp4 [--fast]')
        render(args[0], args[1], fast='--fast' in argv)
    except (EditError, ValueError) as x:
        print(f'error: {x}', file=sys.stderr)
        return 2
    except subprocess.CalledProcessError:
        print('error: ffmpeg failed while rendering (its message is above).', file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
