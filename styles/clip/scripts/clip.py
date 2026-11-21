import sys, os, json, subprocess
from fractions import Fraction
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hits import _load, _flux, _peaks
from caption import captions_track, YELLOW, BLUE

FPS, W, H = 60, 1920, 1080


def beat(song, drop=None):
    y, sr = _load(song)
    f = _flux(y, sr); f = f / np.percentile(f, 99)
    if drop is None:
        h = sr // 100
        db = 20 * np.log10(np.array([np.sqrt(np.mean(y[i * h:(i + 1) * h] ** 2)) for i in range(len(y) // h)]) + 1e-9)
        sm = np.convolve(np.pad(db, 12, mode='edge'), np.ones(25) / 25, 'valid')
        i = int(np.argmax(sm > np.median(sm[:100]) + 8))
        lo, hi = max(0, i - 15), i + 15
        drop = (lo + int(np.argmax(f[lo:hi]))) / 100
    end = len(f) / 100 - .5

    def comb(P, ph):
        ts = ph + P * np.arange(int((end - ph) / P))
        return np.mean([f[int(round(t * 100)) - 2:int(round(t * 100)) + 3].max() for t in ts])
    sc = [(max(comb(P, ph) for ph in np.arange(drop - .03, drop + .031, .005)), P) for P in np.arange(.48, .95, .0005)]
    return drop, float(max(sc)[1])


def times(song, drop, P, shots, snap=.06, fps=FPS):
    y, sr = _load(song)
    on = np.array([t for t, _ in _peaks(_flux(y, sr), .3)])
    b, ts = 0.0, [drop]
    for s in shots[1:]:
        b += s[2]; g = drop + b * P
        k = np.argmin(abs(on - g)); ts.append(on[k] if abs(on[k] - g) <= snap else g)
    return [0] + [round(t * fps) for t in ts]


def _dur(src):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src],
                                capture_output=True, text=True, check=True).stdout.strip())


def _rate(src):
    return Fraction(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                                    'stream=r_frame_rate', '-of', 'csv=p=0', src],
                                   capture_output=True, text=True, check=True).stdout.strip())


def rate(srcs):
    rs = {_rate(s) for s in srcs}
    if len(rs) > 1:
        return Fraction(FPS)
    r = rs.pop()
    return r * max(1, int(Fraction(121, 2) // r))


def cut(song, shots, out, drop, P, song_in=0.0, tail=1.55, fade=1.0, crf=10, preset='veryslow', fps=None,
        audio=None, captions=None, colors={}):
    fps = Fraction(fps or rate([s[0] for s in shots]))
    fr = times(song, drop, P, shots, fps=fps)
    args, fil = ['ffmpeg', '-v', 'error', '-y'], []
    for k, (src, t_in, _, *z) in enumerate(shots):
        z = z[0] if z else 1
        n = fr[k + 1] - fr[k]
        if n <= 0:
            raise ValueError(f'shot {k} ({src}) has {n} frames: check the drop and its beats')
        if _dur(src) < t_in + n / fps:
            raise ValueError(f'{src}: needs {t_in + n / fps:.2f} s, has {_dur(src):.2f}')
        args += ['-ss', f'{t_in:.3f}', '-t', f'{float(n / fps) + .5:.3f}', '-i', src]
        fil.append(f'[{k}:v]fps={fps},scale={round(W * z)}:{round(H * z)}:force_original_aspect_ratio=increase:'
                   f'flags=lanczos+accurate_rnd+full_chroma_int,crop={W}:{H},'
                   f'setsar=1,trim=end_frame={n},setpts=PTS-STARTPTS[v{k}]')
    total = float(fr[len(shots)] / fps) + tail
    k = len(shots)
    args += ['-f', 'lavfi', '-t', f'{tail:.3f}', '-i', f'color=black:s={W}x{H}:r={fps}']
    args += ['-i', audio] if audio else ['-ss', f'{song_in:.3f}', '-i', song]
    fil.append(f'[{k}:v]setsar=1[v{k}]')
    fil.append(''.join(f'[v{i}]' for i in range(k + 1)) + f'concat=n={k + 1}:v=1:a=0,format=yuv420p[v]')
    if not audio:
        fil.append(f'[{k + 1}:a]atrim=0:{total:.3f},afade=t=out:st={total - fade:.3f}:d={fade},asetpts=PTS-STARTPTS[a]')
    if captions:
        d = captions_track(captions, colors, os.path.splitext(out)[0] + '_captions', W, H, float(fps))
        args += ['-framerate', str(fps), '-i', f'{d}/%05d.png']
        fil = [f.replace(',format=yuv420p[v]', '[c]') for f in fil]
        fil.append(f'[{k + 2}:v]scale=out_color_matrix=bt709,format=yuva420p[t];'
                   f'[c][t]overlay=eof_action=pass,format=yuv420p[v]')
    args += ['-filter_complex', ';'.join(fil), '-map', '[v]', '-map', f'{k + 1}:a' if audio else '[a]', '-r', str(fps),
             '-c:v', 'libx264', '-preset', preset, '-crf', str(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p',
             '-x264-params', 'aq-mode=3',
             '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']
    args += ['-c:a', 'copy'] if audio else ['-c:a', 'aac', '-b:a', '320k']
    subprocess.run(args + ['-movflags', '+faststart', out], check=True)
    return fr[1:]


def verify(out, frames):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', out, '-vf', 'scale=96:54,format=gray', '-f', 'rawvideo', '-'],
                         capture_output=True, check=True).stdout
    g = np.frombuffer(raw, np.uint8).reshape(-1, 54, 96).astype(np.float32)
    d = np.r_[0, np.abs(np.diff(g, axis=0)).mean((1, 2))]
    fps = float(_rate(out))
    print(f'{len(g)} frames ({len(g) / fps:.2f} s at {fps:g} fps)')
    bad = 0
    for c in frames:
        nb = np.median(np.r_[d[max(1, c - 6):c], d[c + 1:c + 7]])
        ok = d[c] >= 3 * max(nb, 1); bad += not ok
        print(f'cut {c:4d} ({c / fps:6.3f} s)  diff {d[c]:5.1f}  neighbours {nb:4.1f}  {"ok" if ok else "NO CUT"}')
    return bad == 0


if __name__ == '__main__':
    d, P = beat(sys.argv[1])
    print(json.dumps(dict(drop=d, beat=round(P, 4), bpm=round(60 / P, 1))))
