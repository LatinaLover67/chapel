# Chapel

Free desktop app that edits your videos with Claude. Drop in some clips and a song, pick a style, and it cuts them on the beat. Then you change whatever you want by typing.

It runs on your own Anthropic API key.

## Install

Paste this in PowerShell:

```
irm https://raw.githubusercontent.com/LatinaLover67/chapel/main/install.ps1 | iex
```

It installs Python 3.12, ffmpeg and Git with winget if you don't have them, then installs Chapel and opens it. Or grab `Chapel-Setup.exe` from the [releases](https://github.com/LatinaLover67/chapel/releases).

## Running from source

You need Windows 10 or 11, Node 20+, Python 3.12, ffmpeg and Git for Windows.

```
npm install
npm run dev
```

Paste your API key in Settings, then drop your clips and a song on the home screen.

## Building the installer

```
npm run build:win
```

That makes `dist/Chapel-Setup.exe`.

## Tests

```
npm test
py -3.12 -m venv .venv
.venv/Scripts/pip install -r styles/requirements.txt pytest
.venv/Scripts/python -m pytest styles/clip/tests
```

## What's where

- `src/` the app (electron + react)
- `styles/` the edit styles, each one a recipe plus a `render.py`
- `site/` the website

## License

MIT
