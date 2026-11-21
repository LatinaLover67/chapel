import json, subprocess
import pytest
from conftest import edit, L, write_edit, run
from render import load_edit, EditError

GOOD = [L('intro', 'a.mp4', 0.0, None), L('bars', 'día 1.mp4', 0.5, 1), L('tall', 'tall.mp4', 1.0, 1),
        L('again', 'a.mp4', 5.0, 1), L('bars2', 'día 1.mp4', 3.0, 1)]


def test_first_layer_must_run_to_drop(edit_dir):
    p = write_edit(edit_dir, edit([L('x', 'a.mp4', 0, 1), L('y', 'a.mp4', 0, 1)]))
    with pytest.raises(EditError, match='The first layer runs to the drop: set its beats to null.'):
        load_edit(p)


def test_src_outside_folder(edit_dir):
    e = edit([L('intro', 'a.mp4', 0, None), {'id': 'x', 'src': '../x.mp4', 'src_in_s': 0, 'beats': 1}])
    with pytest.raises(EditError, match='Layer x: its clip must be inside clips/.'):
        load_edit(write_edit(edit_dir, e))


def test_missing_src(edit_dir):
    e = edit([L('intro', 'a.mp4', 0, None), L('x', 'nope.mp4', 0, 1)])
    with pytest.raises(EditError, match='clips/nope.mp4'):
        load_edit(write_edit(edit_dir, e))


def test_beats_quarter_steps(edit_dir):
    e = edit([L('intro', 'a.mp4', 0, None), L('y', 'a.mp4', 0, .3)])
    with pytest.raises(EditError, match='Layer y: beats must be a multiple of 0.25.'):
        load_edit(write_edit(edit_dir, e))


def _probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
                          '-show_entries', 'format=duration', '-of', 'json', str(path)], capture_output=True, text=True, check=True)
    j = json.loads(out.stdout)
    return j['streams'][0]['width'], j['streams'][0]['height'], float(j['format']['duration'])


def test_render_writes_video_and_timeline(edit_dir):
    p = write_edit(edit_dir, edit(GOOD))
    r = run(p, edit_dir / 'renders' / 'final.mp4', '--fast')
    assert r.returncode == 0, r.stderr
    w, h, dur = _probe(edit_dir / 'renders' / 'final.mp4')
    assert (w, h) == (1920, 1080)
    t = json.loads((edit_dir / 'renders' / 'timeline.json').read_text())
    lay = t['layers']
    assert [l['id'] for l in lay] == [l['id'] for l in GOOD]
    assert lay[0]['start_f'] == 0
    for a, b in zip(lay, lay[1:]):
        assert a['end_f'] == b['start_f'] and a['start_f'] < b['start_f']
    assert lay[-1]['end_f'] == t['end_f']
    assert abs(dur - (t['end_f'] / t['fps'] + 1.55)) < 0.2


def test_failed_render_keeps_previous_final(edit_dir):
    final = edit_dir / 'renders' / 'final.mp4'
    final.write_bytes(b'old')
    p = write_edit(edit_dir, edit([L('intro', 'a.mp4', 0, None), L('late', 'a.mp4', 7.9, 1)]))
    r = run(p, final, '--fast')
    assert r.returncode == 2
    assert r.stderr.startswith('error:') and 'needs' in r.stderr
    assert final.read_bytes() == b'old'
