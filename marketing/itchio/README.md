# itch.io 페이지 세팅 가이드 (rumaniel.itch.io/splat-sticky)

> 마켓용 리소스는 `marketing/<플랫폼>/`에 플랫폼별로 관리 (에셋 + 이 가이드 세트).

## 1. 업로드 에셋 (이 폴더)

| 파일 | 용도 | 비고 |
|---|---|---|
| `itch_cover.png` | Cover image | 1260×1000 → itch가 630×500로 축소 표시 |
| `itch_play.gif` | 스크린샷 슬롯 1번 (움직이는 플레이) | 430KB, 4초 루프 |
| `itch_s1_aim.png` | 스크린샷: 조준 (궤적+게이지) | |
| `itch_s3_curve.png` | 스크린샷: 커브볼 모드 | |
| `itch_s2_crawl.png` | 스크린샷: 크롤 버티기 | |
| `itch_s4_party.png` | 스크린샷: 파티 동시 크롤 | |
| `itch_s5_glass.png` | 스크린샷: 유리창 맵 | |

순서 추천: GIF → s1 → s3 → s2 → s4 → s5 (움직임 먼저, 조작→모드 순).

## 2. 설명 텍스트 (Details → Description에 붙여넣기)

---

**던져라! 붙어라! 버텨라!** 벽에 던지면 찐-득 붙었다가 데굴데굴 기어 내려오는 장난감, 찐득이. 오래 버틸수록 점수가 쌓인다!

**Flick it! Stick it! Hang on!** Throw the sticky toy at the wall — it splats, clings, and slowly tumbles down. The longer it hangs, the higher you score!

### 🎮 조작법 / How to play
- **잡고 위로 플릭** — 세게 던질수록 멀리! 너무 세면 튕겨나간다 / **Grab & flick up** — harder = farther, too hard = bounce off!
- **잡은 채로 빙글빙글** — 커브볼! 휘어서 날아간다 / **Circle while holding** — curveball!
- 과녁 중심일수록 초당 점수 배율 UP / Closer to the bullseye = higher score per second
- 좌측 게이지의 **초록 존**이 붙는 세기 — 맵마다 다르다 / The green zone on the gauge = sticking power range, different per wall

### ✨ 특징 / Features
- **물리 기반 크롤다운** — 부착 품질·충격 각도·커브에 따라 매판 다르게 기어 내려온다 / Physics-driven crawl — every throw tumbles differently
- **모형 3종** 찐득맨·문어찐득·별찐득 (점수로 해금) / 3 toys with unique sticky points, unlockable
- **맵 4종** 칠판·거실·유리창·냉장고 — 그립·미끄럼·노그립 존이 전부 다르다 / 4 walls with distinct materials
- **파티 모드** — 한 기기 돌려던지기 2~8인, 전원 동시 크롤 연출 / Hot-seat party for 2–8 players with simultaneous crawl finale
- **로컬 리더보드** / Local leaderboard
- 한국어/English 지원, 모바일 터치 OK

*2026 미니게임 메이커스 챌린지 출품작 — 순수 JS+Canvas, 외부 라이브러리·에셋 0*

---

## 3. 메타데이터 (Edit game 화면)

| 항목 | 값 |
|---|---|
| Classification | Games |
| Kind of project | HTML |
| Pricing | No payments (Free) |
| Genre | Action |
| Tags | `arcade`, `physics`, `casual`, `local-multiplayer`, `party-game`, `singleplayer`, `2d`, `one-button`, `korean`, `mobile` |
| Made with | (비움 또는 custom) |
| Average session | A few minutes |
| Languages | English, Korean |
| Inputs | Mouse, Touchscreen |
| Multiplayer | Local multiplayer (2–8) |
| Accessibility | Color-blind friendly(과녁 링 형태 구분), One button |

임베드: 현재 유지 (Embed in page, 480×800). `Mobile friendly` 체크 ON, `Automatically start on page load` OFF 권장.

## 4. 테마 (Edit theme)

| 항목 | 값 | 근거 |
|---|---|---|
| Background color (BG) | `#1a1530` | 게임 배경 하단색 |
| Secondary background | `#241c48` | 로고 아웃라인 톤 |
| Text color | `#efe8ff` | 밝은 보라-흰색 |
| Link/Accent color | `#7ed957` | 찐득맨 그린 |
| Button color | `#ffb84f` | 로고 옐로 그라디언트 하단 |
| Screenshots sidebar | ON | 세로 스샷이라 사이드가 예쁨 |
