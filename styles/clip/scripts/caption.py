import sys, os, re, json, subprocess
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hits import _load, _flux, _peaks

TRANSCRIBE = None
FONT, SIZE, SHEAR = 'C:/Windows/Fonts/seguisb.ttf', 37, .2
BOX_Y, BOX_H, PAD, BASE = 988, 65, 11, 1000
WHITE, YELLOW, BLUE = (235, 235, 233), (209, 216, 40), (29, 136, 198)
SMEAR = (10, 60)


def _font(W):
    return ImageFont.truetype(FONT, round(SIZE * W / 1080))


def _caption(text, colors, blur, W, H):
    s = W / 1080
    ft = _font(W)
    w = ft.getlength(text)
    x0, base = W / 2 - w / 2, H - (1080 - BASE) * s
    ink, mask = Image.new('RGB', (W, H)), Image.new('L', (W, H))
    di, dm = ImageDraw.Draw(ink), ImageDraw.Draw(mask)
    words, x = text.split(' '), x0
    for i, wd in enumerate(words):
        c = colors.get(wd) or next((v for k, v in colors.items()
                                    if i == len(words) - 1 and len(wd) > 1 and k.startswith(wd)), WHITE)
        di.text((x, base), wd, font=ft, fill=c, anchor='ls'); dm.text((x, base), wd, font=ft, fill=255, anchor='ls')
        x += ft.getlength(wd + ' ')
    shear = (1, SHEAR, -SHEAR * base, 0, 1, 0)
    ink, mask = (im.transform((W, H), Image.AFFINE, shear, Image.BICUBIC) for im in (ink, mask))
    m = np.asarray(mask, np.float32)[..., None] / 255
    rgba = np.zeros((H, W, 4), np.float32)
    y0, y1 = round(H - (1080 - BOX_Y + BOX_H / 2) * s), round(H - (1080 - BOX_Y - BOX_H / 2) * s)
    rgba[y0:y1, max(0, int(x0 - PAD * s)):int(x0 + w + PAD * s), 3] = 1
    rgba[..., :3] = np.asarray(ink, np.float32) / 255 * m
    if blur:
        rgba = cv2.blur(rgba, (max(1, round(blur * s)), 1))
    return rgba


def captions_track(captions, colors, out_dir, W=1920, H=1080, fps=60):
    os.makedirs(out_dir, exist_ok=True)
    st = [(round(t * fps), s) for t, s in captions]
    show = {}
    for i, (f, s) in enumerate(st):
        end = st[i + 1][0] if i + 1 < len(st) else f + 1
        for k in range(f, end):
            show[k] = (s, 0)
        p = st[i - 1][1] if i else ''
        if p and s.startswith(p) and len(s.split()) == len(p.split()):
            continue
        if p:
            show[f - 2], show[f - 1] = (p, SMEAR[0]), (p, SMEAR[1])
        if s:
            show[f], show[f + 1] = (s, SMEAR[1]), (s, SMEAR[0])
    cache = {}
    for k in range(max(f for f, (s, _) in show.items() if s) + 2):
        s, b = show.get(k, ('', 0))
        if (s, b) not in cache:
            rgba = _caption(s, colors, b, W, H) if s else np.zeros((H, W, 4), np.float32)
            a = np.clip(rgba[..., 3:], 1e-6, 1)
            out = np.dstack([np.clip(rgba[..., :3] / a, 0, 1), rgba[..., 3:]])
            cache[(s, b)] = cv2.imencode('.png', cv2.cvtColor((out * 255).round().astype(np.uint8),
                                                               cv2.COLOR_RGBA2BGRA))[1].tobytes()
        open(f'{out_dir}/{k:05d}.png', 'wb').write(cache[(s, b)])
    return out_dir


def timings(src, work):
    os.makedirs(work, exist_ok=True)
    wav = f'{work}/audio.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vn', '-ac', '2', '-ar', '44100', wav], check=True)
    subprocess.run([sys.executable, TRANSCRIBE, work, '--src', wav], check=True)
    subprocess.run([sys.executable, '-m', 'demucs', '-n', 'htdemucs', '--two-stems', 'vocals', '-o', f'{work}/stems',
                    wav], check=True, capture_output=True)
    vo = f'{work}/stems/htdemucs/audio/vocals.wav'
    words = json.load(open(f'{work}/work/tx/words.json', encoding='utf-8'))
    err = subprocess.run(['ffmpeg', '-nostdin', '-i', vo, '-af', 'silencedetect=noise=-38dB:d=0.12', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    sil = list(zip(map(float, re.findall(r'silence_start: (-?[\d.]+)', err)),
                   map(float, re.findall(r'silence_end: ([\d.]+)', err))))
    y, sr = _load(vo)
    on = np.array([t for t, _ in _peaks(_flux(y, sr), .15, gap=5)])
    prev = -1.0
    for i, w in enumerate(words):
        w['e'] = min([w['e']] + [s for s, _ in sil if w['s'] < s < w['e']])
        back = [e for s, e in sil if s - .05 <= w['s'] < e and (i + 1 == len(words) or e < words[i + 1]['e'])]
        near = [t for t in on if t > prev + .08 and abs(t - w['s']) <= .12]
        if back:
            w['s'] = back[0]
        elif near:
            w['s'] = float(min(near, key=lambda t: abs(t - w['s'])))
        w['e'] = max(w['e'], w['s'] + .05)
        prev = w['s']
    return words


def states(words, W=1920, H=1080, gap=.4, clear=None):
    out, line, prev = [], [], None
    for w in words:
        t = w['w'].lower()
        if line and (w['s'] - prev['e'] >= gap or prev['w'][-1] in '.?!'
                     or _font(W).getlength(' '.join(line + [t])) > .6 * W):
            line = []
        line.append(t); out.append([round(w['s'], 3), ' '.join(line)]); prev = w
    out.append([round(clear if clear is not None else prev['e'] + .4, 3), ''])
    return out


def _probe(video):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate',
                        '-of', 'csv=p=0', video], capture_output=True, text=True, check=True).stdout.strip().split(',')
    n, d = r[2].split('/')
    return int(r[0]), int(r[1]), int(n) / int(d)


def add(video, captions, out, colors={}, crf=10, preset='veryslow'):
    W, H, fps = _probe(video)
    d = captions_track(captions, colors, os.path.splitext(out)[0] + '_frames', W, H, fps)
    m = 'bt709' if H >= 720 else 'bt601'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-framerate', f'{fps:g}', '-i', f'{d}/%05d.png',
                    '-filter_complex', f'[1:v]scale=out_color_matrix={m},format=yuva420p[t];'
                                       '[0:v][t]overlay=eof_action=pass,format=yuv420p[v]', '-map', '[v]',
                    '-map', '0:a?', '-c:v', 'libx264', '-preset', preset, '-crf', str(crf), '-profile:v', 'high',
                    '-x264-params', 'aq-mode=3', '-c:a', 'copy', '-movflags', '+faststart', out], check=True)
    return out


if __name__ == '__main__':
    video = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(video)[0] + '_caption.mp4'
    work = os.path.splitext(video)[0] + '_caption'
    js = f'{work}/captions.json'
    if not os.path.exists(js):
        W, H, _ = _probe(video)
        json.dump({'colors': {}, 'captions': states(timings(video, work), W, H)}, open(js, 'w', encoding='utf-8'),
                  indent=1, ensure_ascii=False)
        print('lines ->', js)
    cfg = json.load(open(js, encoding='utf-8'))
    print(add(video, cfg['captions'], out, cfg['colors']))
