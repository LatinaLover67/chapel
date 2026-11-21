# source: https://commons.wikimedia.org/wiki/File:Michelangelo_-_Creation_of_Adam_(cropped).jpg
# usage: python hands_prep.py adam.jpg ../assets/hands.png

import sys
import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
k = im.size[0] / 1200
im = im.crop(tuple(round(v * k) for v in (150, 150, 730, 330)))
im = im.resize((900, round(900 * im.size[1] / im.size[0])), Image.LANCZOS)
a = np.asarray(im).astype(np.float32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]

mask = np.clip((r - b - 45) / 35, 0, 1)
m = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(7)).filter(ImageFilter.GaussianBlur(1.2))
mask = np.asarray(m).astype(np.float32) / 255
lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
skin = lum[mask > .5]
lum = (lum - skin.min()) / (np.percentile(skin, 99) - skin.min())
v = mask * (0.18 + 0.82 * np.clip(lum, 0, 1))

xs = np.arange(v.shape[1])
cy = np.interp(xs, [0, 120, 330, 460, 520, 650, 800, 900], [190, 175, 140, 140, 152, 128, 95, 80])
hw = np.interp(xs, [0, 200, 400, 470, 560, 700, 900], [52, 45, 38, 34, 34, 40, 44])
d = np.abs(np.arange(v.shape[0])[:, None] - cy[None, :]) / hw[None, :]
v = (v * np.clip((1.25 - d) / 0.35, 0, 1))[30:250]
Image.fromarray((v * 255).astype(np.uint8), 'L').save(out)
