import sys
import numpy as np, soundfile as sf


def _load(path):
    y, sr = sf.read(path, dtype='float32')
    return (y.mean(1) if y.ndim > 1 else y), sr


def _flux(y, sr, top_hz=None, N=1024):
    h, win = sr // 100, np.hanning(N)
    spec = np.log1p(10 * np.array([np.abs(np.fft.rfft(y[i:i + N] * win)) for i in range(0, len(y) - N, h)]))
    if top_hz:
        spec = spec[:, :int(top_hz / (sr / N)) + 1]
    return np.concatenate([[0], np.maximum(0, np.diff(spec, axis=0)).sum(1)])


def _peaks(x, th, gap=8):
    x = x / np.percentile(x, 99)
    return [(i / 100, float(x[i])) for i in range(2, len(x) - 2) if x[i] > th and x[i] == x[max(0, i - gap):i + gap].max()]


def hits(path, after=0.0, th=0.8):
    y, sr = _load(path)
    return [(t, s) for t, s in _peaks(_flux(y, sr, 260), th) if t >= after]


def grid(path, drop, beat, n=12):
    y, sr = _load(path)
    on = np.array([t for t, _ in _peaks(_flux(y, sr), .3)])
    ts = [drop + k * beat for k in range(n + 1)]
    off = [1000 * (on[np.argmin(abs(on - t))] - t) for t in ts]
    print('beat:', ' '.join(f'{t:.3f}({o:+.0f}ms)' for t, o in zip(ts, off)), f'| mean {np.mean(off):+.0f} ms')
    return ts


if __name__ == '__main__':
    y, sr = _load(sys.argv[1])
    h = sr // 100
    db = 20 * np.log10(np.array([np.sqrt(np.mean(y[i * h:(i + 1) * h] ** 2)) for i in range(len(y) // h)]) + 1e-9)
    full = _flux(y, sr)
    print('dB every 0.25 s:', ' '.join(f'{k / 4:.2f}:{db[k * 25:(k + 1) * 25].mean():.0f}' for k in range(len(db) // 25)))
    print('low hits (kick/808):', ' '.join(f'{t:.2f}:{s:.2f}' for t, s in _peaks(_flux(y, sr, 260), .4)))
    print('all onsets:', ' '.join(f'{t:.2f}:{s:.2f}' for t, s in _peaks(full, .35)))
    o = full - full.mean()
    ac = np.correlate(o, o, 'full')[len(o) - 1:]
    lag = 30 + int(np.argmax(ac[30:200]))
    print(f'beat period ~{lag / 100:.2f} s ({6000 / lag:.0f} bpm; half/double it if the hits say so)')
