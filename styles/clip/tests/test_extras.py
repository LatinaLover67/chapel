import json
import numpy as np
from PIL import Image
from conftest import edit, L, write_edit, run
from render import watermark_png
from test_render import GOOD


def test_stills(edit_dir):
    p = write_edit(edit_dir, edit(GOOD))
    out = edit_dir / 'renders' / 'stills'
    r = run(p, out, '--frames', 0, 300)
    assert r.returncode == 0, r.stderr
    for f in ['f0000.jpg', 'f0300.jpg']:
        assert Image.open(out / f).size == (1920, 1080)


def test_stills_past_end(edit_dir):
    p = write_edit(edit_dir, edit(GOOD))
    r = run(p, edit_dir / 'renders' / 'stills', '--frames', 99999)
    assert r.returncode == 2
    assert r.stderr.startswith('error: frame 99999 is past the end (')


def test_beat_json(media):
    r = run('--beat', media / 'song.wav')
    assert r.returncode == 0, r.stderr
    j = json.loads(r.stdout)
    assert abs(j['drop_s'] - 4.0) < 0.1 and abs(j['beat_s'] - 0.6) < 0.02


def test_watermark_png(tmp_path):
    assert watermark_png(True, '@me', str(tmp_path / 'w.png')) is True
    assert (tmp_path / 'w.png').stat().st_size > 0
    assert watermark_png(False, None, str(tmp_path / 'n.png')) is False
    assert not (tmp_path / 'n.png').exists()


def _corner(path, t):
    import subprocess
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', str(path), '-frames:v', '1', '-f', 'rawvideo',
                          '-pix_fmt', 'gray', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(1080, 1920)[1080 - 60:, 1920 - 200:].astype(int)


def test_render_overlays_mark(edit_dir):
    p = write_edit(edit_dir, edit(GOOD))
    (edit_dir / 'chapel.json').write_text(json.dumps({'watermark': {'chapel': False, 'text': None}}))
    assert run(p, edit_dir / 'renders' / 'plain.mp4', '--fast').returncode == 0
    (edit_dir / 'chapel.json').write_text(json.dumps({'watermark': {'chapel': True, 'text': None}}))
    assert run(p, edit_dir / 'renders' / 'marked.mp4', '--fast').returncode == 0
    diff = np.abs(_corner(edit_dir / 'renders' / 'plain.mp4', 5.5) - _corner(edit_dir / 'renders' / 'marked.mp4', 5.5))
    assert diff.mean() > 2
