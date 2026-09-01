# -*- coding: utf-8 -*-
"""assets/ 의 소스 이미지로 안드로이드 아이콘·스플래시 리소스를 생성한다.

@capacitor/assets 를 쓰지 않는 이유: 그 도구는 sharp(네이티브 바이너리 30MB)를
끌어오는데, 이 저장소는 게임 런타임 의존성이 0개인 걸 유지하고 npm 11 이
기본으로 설치 스크립트를 막는다. 필요한 변환은 리사이즈·크롭·원형 마스크뿐이라
Pillow 로 충분하다.

사용법:  python tools/gen_android_assets.py
소스  :  assets/icon.png (1024), assets/icon-foreground.png (1024), assets/splash.png (2732)
소스는 game/js/shapes.js 의 드로잉 코드로 렌더했다 (docs/RESOURCES.md 참고).
"""
import os
import sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets')
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')

# 런처 아이콘: mdpi 48dp 기준 배수
ICON_DPI = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
# 적응형 아이콘 전경: 108dp 캔버스 (안쪽 72dp 만 항상 보인다)
FG_DPI = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
# 스플래시: Capacitor 템플릿이 쓰는 밀도별 크기
SPLASH_PORT = {'mdpi': (320, 480), 'hdpi': (480, 800), 'xhdpi': (720, 1280),
               'xxhdpi': (960, 1600), 'xxxhdpi': (1280, 1920)}
# 가로 스플래시는 만들지 않는다 — 앱이 세로 고정(screenOrientation=portrait)이라
# drawable-land-* 는 절대 표시되지 않으면서 APK 만 2MB 넘게 불린다.

BACKGROUND = '#2A2145'  # 적응형 아이콘 배경 (단색이어야 마스크·패럴랙스가 자연스럽다)

written = []


def save(im, rel):
    path = os.path.join(RES, rel.replace('/', os.sep))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, optimize=True)
    written.append((rel, im.size, os.path.getsize(path)))


def load(name):
    path = os.path.join(SRC, name)
    if not os.path.exists(path):
        sys.exit('소스 없음: ' + path)
    return Image.open(path).convert('RGBA')


def round_mask(im):
    """원형 런처 아이콘용 마스크. 가장자리를 부드럽게 하려고 4배로 그린 뒤 줄인다."""
    n = im.size[0]
    m = Image.new('L', (n * 4, n * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, n * 4 - 1, n * 4 - 1), fill=255)
    m = m.resize((n, n), Image.LANCZOS)
    out = im.copy()
    out.putalpha(m)
    return out


def cover(im, w, h):
    """대상 비율로 가운데를 잘라낸 뒤 정확히 w x h 로 맞춘다 (CENTER_CROP)."""
    sw, sh = im.size
    scale = max(w / sw, h / sh)
    nw, nh = round(sw * scale), round(sh * scale)
    im = im.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - w) // 2, (nh - h) // 2
    return im.crop((left, top, left + w, top + h))


def main():
    icon = load('icon.png')
    fg = load('icon-foreground.png')
    splash = load('splash.png').convert('RGB')

    for dpi, n in ICON_DPI.items():
        sq = icon.resize((n, n), Image.LANCZOS)
        save(sq, 'mipmap-%s/ic_launcher.png' % dpi)
        save(round_mask(sq), 'mipmap-%s/ic_launcher_round.png' % dpi)

    for dpi, n in FG_DPI.items():
        save(fg.resize((n, n), Image.LANCZOS), 'mipmap-%s/ic_launcher_foreground.png' % dpi)

    for dpi, (w, h) in SPLASH_PORT.items():
        save(cover(splash, w, h), 'drawable-port-%s/splash.png' % dpi)
    # 밀도 정보가 없을 때 쓰이는 기본값 (세로 mdpi 와 동일)
    save(cover(splash, 320, 480), 'drawable/splash.png')

    color_xml = os.path.join(RES, 'values', 'ic_launcher_background.xml')
    with open(color_xml, 'w', encoding='utf-8', newline='\n') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                '    <color name="ic_launcher_background">%s</color>\n</resources>\n' % BACKGROUND)

    total = sum(s for _, _, s in written)
    for rel, size, nbytes in written:
        print('%-46s %-12s %7d B' % (rel, '%dx%d' % size, nbytes))
    print('%-46s %-12s %7d B' % ('values/ic_launcher_background.xml', BACKGROUND, os.path.getsize(color_xml)))
    print('\n%d files, %.1f KB' % (len(written) + 1, total / 1024))


if __name__ == '__main__':
    main()
