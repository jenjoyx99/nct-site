#!/usr/bin/env python3
"""
Convert product photos for the website.

Usage:
    python tools/process_photos.py <folder with original photos>

Every .jpg/.jpeg/.png/.gif/.webp under the folder (subfolders included) is
resized to fit within 400x400 (never enlarged), placed on white, and saved as
WebP in img/p/ using the original file name in lower case, e.g.
    Z6vuorft04CxHs.jpg  ->  img/p/z6vuorft04cxhs.webp

The price list's default_photo column holds the original file name; the
catalog build links each item to img/p/<name>.webp when that file exists.

Requires: pip install pillow
"""
import os, sys
from PIL import Image, ImageOps

MAX = 400
QUALITY = 80
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "img", "p")
EXTS = (".jpg", ".jpeg", ".png", ".gif", ".webp")


def convert(src, dst):
    with Image.open(src) as im:
        im.seek(0)
        im = ImageOps.exif_transpose(im)
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGB", im.size, "white")
            bg.paste(im, mask=im.split()[-1])
            im = bg
        else:
            im = im.convert("RGB")
        im.thumbnail((MAX, MAX), Image.LANCZOS)
        im.save(dst, "WEBP", quality=QUALITY, method=6)


def main(folder):
    os.makedirs(OUT, exist_ok=True)
    done = failed = 0
    for root, _, files in os.walk(folder):
        for f in files:
            if not f.lower().endswith(EXTS):
                continue
            name = f.rsplit(".", 1)[0].lower() + ".webp"
            try:
                convert(os.path.join(root, f), os.path.join(OUT, name))
                done += 1
            except Exception as e:
                failed += 1
                print(f"  could not convert {f}: {e}")
    size = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f"{done:,} photos converted, {failed} failed. img/p is now {size / 1e6:.1f} MB")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
