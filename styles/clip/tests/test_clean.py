import os, re

STYLE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def test_no_local_paths_in_the_style():
    bad = re.compile(r'[A-Za-z]:[\\/]+Users[\\/]|\.claude[\\/]|EV1_PY|env\.sh')
    found = []
    for d, dirs, files in os.walk(STYLE):
        dirs[:] = [x for x in dirs if x not in ('tests', '__pycache__')]
        for f in files:
            for i, line in enumerate(open(os.path.join(d, f), encoding='utf-8', errors='ignore'), 1):
                if bad.search(line):
                    found.append(f'{os.path.relpath(os.path.join(d, f), STYLE)}:{i}: {line.strip()[:80]}')
    assert not found, '\n'.join(found)


def test_render_reports_a_locked_video(edit_dir):
    from conftest import edit, L, write_edit, run
    from test_render import GOOD
    final = edit_dir / 'renders' / 'final.mp4'
    final.write_bytes(b'old')
    p = write_edit(edit_dir, edit(GOOD))
    with open(final, 'rb'):
        r = run(p, final, '--fast')
    assert r.returncode == 2, r.stderr
    assert 'error: the video is open somewhere else' in r.stderr and 'Traceback' not in r.stderr
