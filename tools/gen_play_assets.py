# -*- coding: utf-8 -*-
"""Google Play 스토어 등록정보용 이미지를 만든다.

결정적인(deterministic) 변환만 여기서 한다 — 리사이즈와 프레임 채우기.
소스 아트(assets/icon.png)와 피처 그래픽은 게임의 캔버스 드로잉 코드로
브라우저에서 렌더한다. 절차는 marketing/googleplay/README.md §3 참고.

사용법:  python tools/gen_play_assets.py
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'marketing', 'googleplay')
ITCH = os.path.join(ROOT, 'marketing', 'itchio')

# Play 는 9:16(0.5625)을 요구하는데 게임 캔버스는 3:5(0.600)다. 1080 폭에 맞추면
# 세로가 1800 이라 1920 프레임에서 위아래 60px 씩 남는다. 실제 기기에서 캔버스
# 밖으로 보이는 색(body 배경)과 같은 값으로 채워야 이질감이 없다.
FRAME = (1080, 1920)
CANVAS = (1080, 1800)
LETTERBOX = '#1a1530'

SHOTS = [
    ('itch_s1_aim.png', 'play_s1_aim.png'),
    ('itch_s3_curve.png', 'play_s2_curve.png'),
    ('itch_s2_crawl.png', 'play_s3_crawl.png'),
    ('itch_s4_party.png', 'play_s4_party.png'),
    ('itch_s5_glass.png', 'play_s5_glass.png'),
]


def report(path, note=''):
    im = Image.open(path)
    print('%-30s %-11s %-5s %6.0f KB  %s' % (
        os.path.basename(path), '%dx%d' % im.size, im.mode,
        os.path.getsize(path) / 1024, note))


def main():
    os.makedirs(OUT, exist_ok=True)

    # 앱 아이콘 512 — 투명 배경은 흰색으로 채워져 나오므로 불투명 소스를 쓴다.
    src = os.path.join(ROOT, 'assets', 'icon.png')
    if not os.path.exists(src):
        sys.exit('소스 없음: ' + src)
    dst = os.path.join(OUT, 'play_icon_512.png')
    Image.open(src).convert('RGB').resize((512, 512), Image.LANCZOS).save(dst, optimize=True)
    report(dst, '<= 1MB')

    # 휴대전화 스크린샷 — itch 용 960x1600 을 1080 폭으로 올리고 9:16 프레임에 앉힌다.
    for s, d in SHOTS:
        p = os.path.join(ITCH, s)
        if not os.path.exists(p):
            sys.exit('소스 없음: ' + p)
        im = Image.open(p).convert('RGB')
        if im.size != (960, 1600):
            sys.exit('%s 크기가 960x1600 이 아니다: %s' % (s, im.size))
        im = im.resize(CANVAS, Image.LANCZOS)
        frame = Image.new('RGB', FRAME, LETTERBOX)
        frame.paste(im, (0, (FRAME[1] - CANVAS[1]) // 2))
        out = os.path.join(OUT, d)
        frame.save(out, optimize=True)
        report(out)

    feat = os.path.join(OUT, 'play_feature_1024x500.png')
    if os.path.exists(feat):
        report(feat, '브라우저 렌더 (README §3)')
    else:
        print('play_feature_1024x500.png 없음 — README §3 절차로 렌더해야 한다')


if __name__ == '__main__':
    main()
