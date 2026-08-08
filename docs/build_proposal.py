# -*- coding: utf-8 -*-
"""찹! 찐득이 — 게임기획안 PDF 5매 생성 (2026 미니게임 메이커스 챌린지 제출용)"""
import os

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

pdfmetrics.registerFont(TTFont('Malgun', 'C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('MalgunB', 'C:/Windows/Fonts/malgunbd.ttf'))

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(
    os.environ.get('LOCALAPPDATA', ''),
    'Temp', 'claude', 'D--Repo-minigamemakers2026',
    '604c22f5-6654-48b3-b9f1-4a795cac69ec', 'scratchpad', 'shots')
OUT = os.path.join(HERE, '게임기획안_찹찐득이.pdf')

W, H = A4
M = 16 * mm  # 좌우 여백

INK = colors.HexColor('#241d3f')
ACCENT = colors.HexColor('#4fa832')
SOFT = colors.HexColor('#6b6390')
PANEL = colors.HexColor('#f2eff9')
YELL = colors.HexColor('#b98a00')

c = canvas.Canvas(OUT, pagesize=A4)
c.setTitle('찹! 찐득이 (Splat! Sticky) — 게임기획안')
c.setAuthor('2026 미니게임 메이커스 챌린지 출품작')


def header(page_no, section):
    c.setFillColor(ACCENT)
    c.rect(0, H - 8 * mm, W, 8 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont('MalgunB', 9)
    c.drawString(M, H - 5.7 * mm, '찹! 찐득이 (Splat! Sticky) — 게임기획안')
    c.drawRightString(W - M, H - 5.7 * mm, f'{section}   |   {page_no} / 5')


def h2(y, text):
    c.setFillColor(ACCENT)
    c.rect(M, y - 1.2 * mm, 3 * mm, 6 * mm, stroke=0, fill=1)
    c.setFillColor(INK)
    c.setFont('MalgunB', 14)
    c.drawString(M + 5 * mm, y, text)
    return y - 9 * mm


def body(y, lines, size=10, leading=5.6, bold_prefix=True, x=None, maxw=None):
    x = x if x is not None else M
    c.setFillColor(INK)
    for ln in lines:
        if ln.startswith('**'):
            c.setFont('MalgunB', size)
            ln = ln[2:]
        elif ln.startswith('- '):
            c.setFont('Malgun', size)
            c.setFillColor(ACCENT)
            c.drawString(x, y, '•')
            c.setFillColor(INK)
            ln = '   ' + ln[2:]
        else:
            c.setFont('Malgun', size)
        c.drawString(x, y, ln)
        y -= leading * mm
    return y


def img(path, x, y_top, w):
    """세로 960x1600 스샷 배치. y_top = 이미지 상단. 반환: 하단 y"""
    h = w * (1600.0 / 960.0)
    c.setFillColor(colors.white)
    c.roundRect(x - 1.2 * mm, y_top - h - 1.2 * mm, w + 2.4 * mm, h + 2.4 * mm, 2 * mm, stroke=0, fill=1)
    c.setStrokeColor(colors.HexColor('#d8d2ea'))
    c.roundRect(x - 1.2 * mm, y_top - h - 1.2 * mm, w + 2.4 * mm, h + 2.4 * mm, 2 * mm, stroke=1, fill=0)
    c.drawImage(os.path.join(SHOTS, path), x, y_top - h, width=w, height=h)
    return y_top - h


def caption(x, y, w, text):
    c.setFont('Malgun', 8)
    c.setFillColor(SOFT)
    c.drawCentredString(x + w / 2, y - 4 * mm, text)


# ============================================================ P1 표지·개요
header(1, '개요')

c.setFillColor(INK)
c.setFont('MalgunB', 34)
c.drawString(M, H - 34 * mm, '찹! 찐득이')
c.setFont('MalgunB', 15)
c.setFillColor(ACCENT)
c.drawString(M, H - 43 * mm, 'Splat! Sticky')
c.setFont('Malgun', 11.5)
c.setFillColor(INK)
c.drawString(M, H - 52 * mm, '추억의 찐득이 장난감을 진짜 물리로 되살린 HTML5 던지기 미니게임')

# 실행 URL 박스
c.setFillColor(PANEL)
c.roundRect(M, H - 74 * mm, W - 2 * M, 16 * mm, 3 * mm, stroke=0, fill=1)
c.setFont('MalgunB', 11)
c.setFillColor(INK)
c.drawString(M + 5 * mm, H - 64 * mm, '게임 실행 URL(직접 실행):  https://rumaniel.itch.io/splat-sticky')
c.setFont('Malgun', 9.5)
c.setFillColor(SOFT)
c.drawString(M + 5 * mm, H - 70.5 * mm, '브라우저에서 즉시 플레이(PC 마우스·모바일 터치) / 제출 빌드 ZIP은 index.html 더블클릭만으로 오프라인 실행')

# 개요 표
rows = [
    ('공모 분야', '전체 연령 이용가 · HTML5 기반 창작 게임'),
    ('장르', '피지컬 토스 아케이드 (던지고 · 붙이고 · 버텨라)'),
    ('플랫폼', '웹 브라우저 (PC·모바일·태블릿) — 설치 불필요'),
    ('인원', '연습 1인 / 파티 2~8인 핫시트 (한 기기 순서 던지기)'),
    ('조작', '원버튼: 드래그-플릭 던지기 + 빙글빙글 돌려 커브볼 (포켓몬GO식)'),
    ('기술', '순수 JavaScript + Canvas · 외부 라이브러리/에셋 파일 0개 · 100KB 미만'),
    ('언어', '한국어 / English (게임 내 전환)'),
]
ty = H - 84 * mm
c.setFont('Malgun', 10)
for k, v in rows:
    c.setFillColor(PANEL)
    c.rect(M, ty - 4.4 * mm, 30 * mm, 7.4 * mm, stroke=0, fill=1)
    c.setFillColor(ACCENT)
    c.setFont('MalgunB', 9.5)
    c.drawString(M + 2.5 * mm, ty - 2 * mm, k)
    c.setFillColor(INK)
    c.setFont('Malgun', 9.5)
    c.drawString(M + 34 * mm, ty - 2 * mm, v)
    ty -= 7.4 * mm

# 대표 스샷 (우하단 크게 1장 + 소개)
iw = 62 * mm
ib = img('01-aim-spin-room.png', W - M - iw, ty - 6 * mm, iw)
caption(W - M - iw, ib, iw, '조준 화면 — 스핀을 걸면 커브볼')

intro_y = ty - 14 * mm
intro_y = body(intro_y, [
    '**한 번 던지면 끝이 아니다.',
    '벽에 착! 붙은 찐득이는 그립이 닳는 동안',
    '데굴데굴 굴러 내려오며 점수를 벌어준다.',
    '',
    '어디에 붙일지, 얼마나 세게 던질지,',
    '커브를 걸지 — 전부 손끝 하나로.',
    '',
    '**심사 포인트 요약',
    '- 유사 사례 없는 오리지널 소재·물리 루프',
    '- 의존성 0, 더블클릭 즉시 실행되는 초경량 빌드',
    '- 그립 주도 크롤 물리 (타이머 연출이 아님)',
    '- 파티 동시 크롤 등 현장 시연형 멀티 모드',
], size=10.5, leading=6.2, maxw=W - 2 * M - iw - 8 * mm)

c.showPage()

# ============================================================ P2 코어 게임플레이
header(2, '코어 게임플레이')
y = H - 20 * mm
y = h2(y, '던지고 · 붙이고 · 버텨라 — 3단 물리 루프')

y = body(y, [
    '**① 던지기 — 손맛 그대로',
    '- 찐득이를 잡고 벽으로 플릭: 드래그 속도·각도가 그대로 포사체 궤적이 된다',
    '- 잡은 채 빙글빙글 돌리면 스핀 장전 → 릴리즈 후 Magnus 효과로 휘어지는 커브볼',
    '- 너무 세면 튕겨 나가고, 너무 약하면 바닥에 철퍼덕 — 머테리얼마다 스윗스팟이 다르다',
    '',
    '**② 부착 — 끈적 패드 단위 판정',
    '- 충돌 순간 접촉한 끈적 패드(손·발·다리끝)마다 그 위치의 벽 머테리얼로 개별 연산',
    '- 창틀·테두리 같은 노그립 존에 닿은 패드는 잡지 못한다 (멀티 머테리얼 존)',
    '',
    '**③ 크롤다운 — 그립이 모든 것을 결정',
    '- 패드마다 그립 HP: 위쪽 패드(장력 집중)부터 뽁뽁 벗겨진다',
    '- 지지가 무너지면 남은 패드를 축으로 토크 회전 — 천천히 기울다 가속하며 끝-넘기',
    '- 반대편 패드가 "찐득 주스"로 재부착, 주스가 닳면 결국 낙하 — 전 과정이 물리로 창발',
    '- 버틴 시간 × 과녁 배율 + 스팟 + 커브/퍼펙트 보너스 = 점수 (버틴 시간 병기)',
], size=9.8, leading=5.4)

iw2 = 58 * mm
gap = (W - 2 * M - 2 * iw2)
ib1 = img('02-fly-curve-glass.png', M, y - 2 * mm, iw2)
caption(M, ib1, iw2, '커브 비행 — 스핀 트레일과 그림자')
ib2 = img('03-stuck-crawl-chalk.png', M + iw2 + gap, y - 2 * mm, iw2)
caption(M + iw2 + gap, ib2, iw2, '부착·크롤 — 그립 게이지와 실시간 가점')

c.showPage()

# ============================================================ P3 모드·콘텐츠
header(3, '모드 · 콘텐츠')
y = H - 20 * mm
y = h2(y, '혼자서는 기록을, 모여서는 대결을')

y = body(y, [
    '**연습 모드 — 1~10구 선택, 로컬 리더보드에 이름·점수·최고 버티기 기록',
    '**파티 모드 — 2~8인 핫시트 (기기 하나로 축제·모임 어디서든)',
    '- 동시 크롤 모드 ON: 전원 던진 뒤, 한 벽에서 모두의 찐득이가 동시에 크롤 대결',
    '- 개인 그립 게이지·색상 링·실시간 순위 HUD — 마지막까지 버티는 자가 승리',
    '',
    '**찐득이 3종 — 끈적 부위가 물리를 바꾼다',
    '- 찐득맨(기본): 양손·양발 4패드, 시원한 180° 끝-넘기',
    '- 문어찐득: 방사형 8다리, 짧은 플롭으로 끈질기게 버티는 탱커',
    '- 별찐득: 꼭짓점 5패드 72° 데굴데굴, 가볍고 화끈한 고득점형',
    '',
    '**맵 4종 — 같은 벽면에도 여러 머테리얼',
    '- 거실 벽(표준 그립) / 유리창(미끌 + 창틀 노그립 → 판유리 쿼드런트 조준이 스킬)',
    '- 교실 칠판(고그립 명당, 나무 테두리는 노그립) / 냉장고(자석 스팟 잭팟, 손잡이 노그립)',
    '- 누적 점수로 모형·맵 해금 → 반복 플레이 동기',
], size=9.8, leading=5.4)

ib3 = img('04-party-simul-room.png', M, y - 2 * mm, iw2)
caption(M, ib3, iw2, '파티 동시 크롤 — 3인 실시간 대결')
ib4 = img('05-aim-fridge-star.png', M + iw2 + gap, y - 2 * mm, iw2)
caption(M + iw2 + gap, ib4, iw2, '냉장고 맵 — 자석 스팟과 노그립 손잡이')

c.showPage()

# ============================================================ P4 심사기준 대응
header(4, '심사기준 대응')
y = H - 20 * mm
y = h2(y, '심사 기준별 구현 근거')

crit = [
    ('기획 완성도', [
        '한국인의 추억 완구 "찐득이"를 게임화한 오리지널 소재 — 유사 게임 없음',
        '던지기→부착→크롤다운 3단 물리 루프라는 독자적 코어 메커닉',
    ]),
    ('재미 · 몰입도', [
        '포켓몬GO식 직관 플릭 + 커브볼 — 5초 만에 배우고 계속 파게 되는 조작감',
        '그립 게이지·패드 깜빡임으로 "곧 넘어간다"를 읽는 예측 재미, 초당 가점의 실시간 긴장',
        '해금(모형·맵) · 로컬 리더보드 · 파티 동시 크롤 — 반복 플레이 3중 동기',
    ]),
    ('게임 완성도', [
        '물리·밸런스를 자동 시뮬레이션(모형×맵 9조합 프레임 추적)으로 회귀 검증',
        '프로시저럴 사운드(외부 파일 0) · 파티클/히트스탑/스크린셰이크 폴리싱 · 60fps',
        '한국어/영어 즉시 전환 (전체 스트링 테이블화)',
    ]),
    ('구현 적합성', [
        '외부 라이브러리·에셋·네트워크 요청 0 — index.html 더블클릭만으로 오프라인 완전 동작',
        '전체 빌드 100KB 미만 · 모바일 터치/반응형 · 크롬/엣지/사파리 호환',
        'GitHub Actions → itch.io 자동 배포 파이프라인 구축',
    ]),
    ('발전 가능성', [
        '데이터 주도 설계: 모형(끈적 패드)·맵(머테리얼 존) 레지스트리에 정의만 추가하면 확장',
        'P2P 온라인 멀티 설계 완료(5p) · 행사 키오스크 모드 등 사업화 경로 명확',
    ]),
]
for name, lines in crit:
    c.setFillColor(ACCENT)
    c.roundRect(M, y - 4.5 * mm, 26 * mm, 7 * mm, 2 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont('MalgunB', 9.5)
    c.drawCentredString(M + 13 * mm, y - 2.2 * mm, name)
    yy = y
    for ln in lines:
        c.setFillColor(INK)
        c.setFont('Malgun', 9.3)
        c.drawString(M + 30 * mm, yy - 2.2 * mm, '· ' + ln)
        yy -= 5.4 * mm
    y = yy - 4.5 * mm

# 기술 스펙 박스
c.setFillColor(PANEL)
c.roundRect(M, y - 34 * mm, W - 2 * M, 30 * mm, 3 * mm, stroke=0, fill=1)
c.setFillColor(YELL)
c.setFont('MalgunB', 10.5)
c.drawString(M + 5 * mm, y - 7 * mm, '기술 스펙')
sy = y - 13 * mm
for ln in [
    '렌더링: HTML5 Canvas 2D, 가상 480×800 레터박스, DPR 대응 | 사운드: WebAudio 신스(저작권 클린)',
    '물리: 자체 구현 — 포사체·Magnus 커브·패드 그립 HP·토크 롤·진자 필오프 | 저장: localStorage',
    '코드: 순수 JS 11모듈 약 2,700줄, 빌드 과정 없음 | 저장소: github.com/rumaniel/chap-sticky (공개)',
]:
    c.setFillColor(INK)
    c.setFont('Malgun', 9)
    c.drawString(M + 5 * mm, sy, ln)
    sy -= 5.6 * mm

c.showPage()

# ============================================================ P5 로드맵
header(5, '로드맵 · 발전 가능성')
y = H - 20 * mm
y = h2(y, '모드 3: 온라인 멀티플레이 (설계 완료 · 차기 버전)')

y = body(y, [
    '- 방식: WebRTC(PeerJS) P2P — 호스트 브라우저가 방장, 별도 게임 서버 없는 서버리스 구조',
    '- 흐름: 호스트가 초대 코드 생성 → 참가자 접속 → 각자 기기에서 던지기 → 착지 파라미터만 동기화',
    '- 동기화 데이터가 초소형(착지 좌표·속도·스핀)이라 저지연 — 크롤은 각 기기에서 동일 시드로 재생',
    '- 이미 구현된 "파티 동시 크롤" 연출을 온라인으로 그대로 확장하는 구조',
], size=9.8, leading=5.4)

y -= 2 * mm
y = h2(y, '콘텐츠 · 사업화 로드맵')
y = body(y, [
    '**단기 (공모전 이후 1~2개월)',
    '- 신규 모형(도마뱀·햄스터 등)·맵(욕실 타일, 편의점 냉장고) — 레지스트리에 정의 추가만으로 확장',
    '- 일일 도전(고정 시드 경쟁) · 묘기 배지(3커브 연속 등) · 효과음/BGM 확장',
    '',
    '**중기 — 온라인·커뮤니티',
    '- 모드 3 P2P 멀티 출시, 주간 리그 · 관전 모드',
    '- 글로벌 리더보드(서버리스 백엔드), SNS 리플레이 공유(GIF 내보내기)',
    '',
    '**사업화',
    '- 하이퍼캐주얼 광고 모델 + 스킨/맵 패스 — 초경량 웹 게임이라 메신저·포털 게임 채널 입점 용이',
    '- 찐득이 완구 콜라보: 실물 완구 패키지에 게임 코드 동봉 (추억 세대 + 키즈 동시 공략)',
    '- 행사 키오스크 모드: 설치 0 · 태블릿 1대로 8인 파티 — 축제/행사 현장 시연에 최적',
    '',
    '**지역 연계',
    '- 경북게임페스티벌 등 현장 부스 시연: 브라우저만 있으면 즉시 구동, 관객 참여형 파티 모드',
    '- 지역 소재 맵(경산 벽화거리 등) 업데이트로 로컬 콘텐츠 연계 가능',
], size=9.8, leading=5.4)

# 마무리 박스
c.setFillColor(ACCENT)
c.roundRect(M, 22 * mm, W - 2 * M, 20 * mm, 3 * mm, stroke=0, fill=1)
c.setFillColor(colors.white)
c.setFont('MalgunB', 12)
c.drawString(M + 6 * mm, 34 * mm, '찹! — 벽에 던져라, 붙어라, 버텨라!')
c.setFont('Malgun', 9.5)
c.drawString(M + 6 * mm, 27.5 * mm, '실행: https://rumaniel.itch.io/splat-sticky   ·   소스: github.com/rumaniel/chap-sticky')

c.save()
print('saved:', OUT)
