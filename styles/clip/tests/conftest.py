import json, os, subprocess, sys
import numpy as np, soundfile as sf, pytest

HERE = os.path.dirname(os.path.abspath(__file__))
RENDER = os.path.join(os.path.dirname(HERE), 'render.py')
sys.path.insert(0, os.path.dirname(HERE))


def _clip(path, src, size, secs=8):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'{src}=size={size}:rate=30', '-t', str(secs),
                    '-pix_fmt', 'yuv420p', path], check=True)


@pytest.fixture(scope='session')
def media(tmp_path_factory):
    d = tmp_path_factory.mktemp('media')
    sr = 44100
    y = np.random.default_rng(0).normal(0, .003, 12 * sr).astype(np.float32)
    burst = int(.03 * sr)
    y[4 * sr:] += np.random.default_rng(1).normal(0, .05, 8 * sr).astype(np.float32)
    for t in np.arange(4.0, 12.0, .6):
        i = int(t * sr); y[i:i + burst] = .8 * np.sign(np.sin(np.arange(burst) * .3))
    sf.write(d / 'song.wav', y, sr)
    _clip(str(d / 'a.mp4'), 'testsrc2', '1280x720')
    _clip(str(d / 'día 1.mp4'), 'smptebars', '1280x720')
    _clip(str(d / 'tall.mp4'), 'testsrc2', '720x1280')
    return d


@pytest.fixture
def edit_dir(media, tmp_path):
    d = tmp_path / 'my edit'
    (d / 'clips').mkdir(parents=True)
    (d / 'renders').mkdir()
    for f in ['a.mp4', 'día 1.mp4', 'tall.mp4']:
        (d / 'clips' / f).write_bytes((media / f).read_bytes())
    (d / 'song.wav').write_bytes((media / 'song.wav').read_bytes())
    return d


def edit(layers, **kw):
    return {'style': 'clip', 'song': 'song.wav', 'drop_s': None, 'tail_s': 1.55, 'layers': layers, **kw}


def L(id, src, src_in_s, beats, **kw):
    return {'id': id, 'src': f'clips/{src}', 'src_in_s': src_in_s, 'beats': beats, **kw}


def write_edit(d, e):
    p = d / 'edit.json'
    p.write_text(json.dumps(e), encoding='utf-8')
    return p


def run(*args):
    return subprocess.run([sys.executable, RENDER, *map(str, args)], capture_output=True, text=True, encoding='utf-8')
