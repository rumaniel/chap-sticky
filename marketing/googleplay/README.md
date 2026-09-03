# Google Play 등록 가이드 (com.mangru.chapsticky)

> 마켓용 리소스는 `marketing/<플랫폼>/`에 플랫폼별로 관리 (에셋 + 이 가이드 세트).
> 콘솔 작업은 사람이 직접 해야 하는 구간이 많다. 이 문서는 **입력할 값을 미리 다 적어두어**
> 콘솔에서 고민 없이 복사·붙여넣기만 하도록 만든 것이다.

퍼블리셔: **Studio Mangru** · 패키지: `com.mangru.chapsticky` · 무료 · 광고 없음

---

## 0. 자산 상태 보드

| # | 자산 | 스펙 | 상태 |
|---|---|---|---|
| S1 | 앱 아이콘 | 512×512 PNG, ≤1MB | ✅ `play_icon_512.png` (112KB) |
| S2 | 그래픽 이미지(피처) | 1024×500 PNG(24bit, 알파 없음), ≤15MB | ✅ `play_feature_1024x500.png` (203KB) |
| S3 | 휴대전화 스크린샷 | **최소 4장** (최대 8장), 1080×1920, ≤8MB | ✅ `play_s1`~`play_s5` 5장 (185~273KB) |
| S4 | 7"/10" 태블릿 스크린샷 | 각 최소 4장 (태블릿 지원 선언 시) | ⬜ 보류 — 지원 여부 미정 |
| S5 | 프로모 동영상 | YouTube URL만 허용 (파일 업로드 불가) | ⬜ 보류 — 업로드 계정 필요 |
| S6 | 스토어 텍스트 | 앱 이름 30자 / 간단한 설명 80자 / 자세한 설명 4000자 | ✅ 초안 §2 |
| S7 | 앱 콘텐츠 선언 | 개인정보처리방침·데이터 보안·등급 등 | ✅ 답안 §4 |
| S8 | 출시 노트 | 500자/언어 | ✅ 초안 §6 |

**S3 비율 주의.** `marketing/itchio/` 의 스크린샷은 **960×1600 (3:5, 0.600)** 인데
Play 는 **9:16 (0.5625)** 을 요구한다. 그래서 1080×1800 으로 올린 뒤 1080×1920 프레임
가운데에 앉히고, 남는 위아래 60px 은 `#1a1530` (실제 기기에서 캔버스 밖으로 보이는
body 배경색) 으로 채웠다. 1.125배 업스케일이라 손실은 육안으로 확인되지 않는다.

### 파일 목록 (이 폴더)

| 파일 | 슬롯 | 비고 |
|---|---|---|
| `play_icon_512.png` | 앱 아이콘 | `assets/icon.png` 축소 |
| `play_feature_1024x500.png` | 그래픽 이미지 | 브라우저 렌더 (§3) |
| `play_s1_aim.png` | 스크린샷 1 — 조준 | |
| `play_s2_curve.png` | 스크린샷 2 — 커브볼 | |
| `play_s3_crawl.png` | 스크린샷 3 — 크롤 버티기 | |
| `play_s4_party.png` | 스크린샷 4 — 파티 동시 크롤 | |
| `play_s5_glass.png` | 스크린샷 5 — 유리창 맵 | |

재생성:

```bash
python tools/gen_play_assets.py
```

---

## 1. 앱 만들기 (Play Console → 앱 만들기)

| 항목 | 값 |
|---|---|
| 앱 이름 | `찹! 찐득이 - Splat! Sticky` |
| 기본 언어 | 한국어 – ko-KR |
| 앱 또는 게임 | **게임** |
| 무료 또는 유료 | **무료** (유료→무료 전환은 가능하나 반대는 불가) |
| 선언 | 개발자 프로그램 정책 ✅ / 미국 수출법 ✅ |

---

## 2. 스토어 등록정보 텍스트

### 앱 이름 (30자 제한)

```
찹! 찐득이 - Splat! Sticky
```

### 간단한 설명 (80자 제한)

**ko-KR**
```
벽에 던져 찐득 붙이고, 흘러내리기 전까지 버텨라! 커브볼로 스윗 스팟을 노리는 물리 게임
```

**en-US**
```
Flick the sticky toy at the wall and hang on. A physics game of curveballs.
```

### 자세한 설명 (4000자 제한)

**ko-KR**
```
던져라! 붙어라! 버텨라!

벽에 던지면 찐-득 붙었다가, 손과 발을 번갈아 짚으며 데굴데굴 기어 내려오는 추억의 장난감. 오래 버틸수록 점수가 쌓입니다.

▪ 조작은 하나, 깊이는 끝까지
잡고 위로 튕기면 던져집니다. 세게 던질수록 멀리 가지만, 너무 세면 벽에 튕겨 나갑니다. 잡은 채로 빙글빙글 돌리면 커브볼 — 휘어 날아가 정면으로는 닿지 않는 자리를 노립니다.

▪ 매판 다르게 흘러내린다
부착 품질, 충격 각도, 스핀이 전부 크롤다운에 남습니다. 같은 자리에 붙여도 내려오는 길이 달라집니다. 과녁 중심에 오래 머물수록 초당 점수 배율이 올라갑니다.

▪ 벽마다 성격이 다르다
칠판은 관대하고, 유리창은 미끄럽고, 냉장고에는 자석 존이 있습니다. 왼쪽 게이지의 초록 존이 그 벽에서 잘 붙는 세기 구간입니다.

▪ 모형 3종
찐득맨(양손·양발), 문어찐득(다리 끝 8곳), 별찐득(꼭짓점 5곳). 끈적이는 부위가 달라 붙는 느낌과 기어 내려오는 리듬이 바뀝니다. 점수를 모아 해금합니다.

▪ 한 기기로 즐기는 파티 모드
2~8명이 순서대로 던지고, 라운드가 끝나면 전원이 같은 벽에서 동시에 기어 내려옵니다. 마지막까지 버틴 사람이 승자.

▪ 가볍게, 어디서나
설치 용량이 작고 인터넷이 필요 없습니다. 계정도, 로그인도, 광고도 없습니다. 점수와 해금 정보는 기기에만 저장됩니다.

한국어 / English 지원
```

**en-US**
```
Flick it! Stick it! Hang on!

Throw the sticky toy at the wall — it splats, clings, then tumbles down hand over foot. The longer it hangs, the higher you score.

▪ One gesture, endless depth
Grab and flick upward to throw. Harder means farther, but too hard and it bounces off. Circle your finger while holding to load a curveball that bends around to spots you cannot reach head-on.

▪ Every throw falls differently
Stick quality, impact angle and spin all carry into the crawl. Two throws that land in the same place come down by different routes. The closer to the bullseye you linger, the higher your score multiplier per second.

▪ Every wall has a personality
The chalkboard forgives, the window is slippery, the fridge has magnet zones. The green band on the left gauge is the throw strength that sticks best on that wall.

▪ Three toys
Sticky Man (hands and feet), Octo (eight leg tips), Star (five points). Different sticky parts change how it grabs and how it tumbles. Unlock them with score.

▪ Hot-seat party mode
2 to 8 players take turns, then everyone crawls down the same wall at once for the finale. Last one hanging wins.

▪ Light, and offline
Small download, no internet required. No account, no sign-in, no ads. Scores and unlocks stay on your device.

Korean / English supported
```

> ⚠️ 설명에 "광고 없음"을 적어 뒀다. 기획안 로드맵의 리워드 광고 언락을 도입하면
> 이 문장과 §4 의 광고 선언·데이터 보안 양식을 **함께** 고쳐야 한다.

---

## 3. 그래픽 자산

### S1 앱 아이콘 — 512×512

`assets/icon.png`(1024, 불투명) 을 512 로 축소. 투명 배경은 흰색으로 채워져 나오므로
반드시 배경이 채워진 `icon.png` 를 쓴다 (`icon-foreground.png` 아님).

### S2 그래픽 이미지(피처) — 1024×500

가로 배너. 스토어 상단·추천 배치에 쓰인다. 구성:

- 배경: `#2f2550` → `#171226` 대각 그라디언트 + 우측 보라 글로우
- 좌측: 워드마크 "찹! 찐득이" (로고 초록 그라디언트) · `SPLAT! STICKY` · `던져라! 붙어라! 버텨라!`
- 우측: 벽에 눌린 찐득이(`squash 0.84`) + 접착 자국 — 아이콘과 같은 `shapes.js` 드로잉
- 텍스트는 중앙 866×250(x 79~945, y 125~375) 안쪽 — 배치 면에 따라 가장자리가 잘린다

아이콘 소스와 마찬가지로 브라우저에서 게임 코드로 렌더한 뒤 PNG 를 떨궜다.
`man.draw()` 를 쓰기 때문에 Python 만으로는 만들 수 없다. 다시 만들려면 게임을 띄운
상태에서 캔버스에 그리고 저장한다 (`docs/RESOURCES.md` 의 캡처 절차와 동일).
저장 후 **알파 채널을 제거**해야 한다 — Play 는 피처 그래픽에 알파를 허용하지 않는다.

### S3 휴대전화 스크린샷 — 1080×1920, 4~8장

itch 가이드와 같은 순서 추천 (조작 → 모드):

| # | 장면 | 참고 |
|---|---|---|
| 1 | 조준 (궤적 + 파워 게이지) | `itch_s1_aim.png` 와 같은 구도 |
| 2 | 커브볼 모드 (셰브런 게이지) | `itch_s3_curve.png` |
| 3 | 부착 후 크롤 버티기 (그립 바 + 배율 배지) | `itch_s2_crawl.png` |
| 4 | 파티 동시 크롤 | `itch_s4_party.png` |
| 5 | 유리창 맵 (재질 차이) | `itch_s5_glass.png` |

재촬영 절차 (2026-09-02 부터 스크립트화):

```bash
python tools/capture/save_server.py          # PNG 수신 (8124)
# 게임을 localhost:8123 으로 띄운 뒤, 페이지 콘솔에서 tools/capture/scenes.js 내용을 실행
python tools/gen_play_assets.py              # itch 960x1600 → Play 1080x1920 프레이밍
```

`scenes.js` 는 게임 렌더러로 5장을 960×1600(가상 480×800 의 2배)에 찍는다 — 벽 캐시가
캔버스 해상도로 만들어지므로 `setup()` 전에 크기를 잡아야 선명하다. 씬 구성(조준은
`I.holding`+`I.liveFlick`, 커브는 `I.spinCharge`, 파티는 던지기 사이에 `update()` 를
직접 돌려 타이머를 진행)은 파일 주석 참고. 브라우저 탭이 백그라운드면 rAF 가 멈추므로
게임 상태 전이를 기다릴 때는 `update()` 를 직접 호출해야 한다.

---

## 4. 앱 콘텐츠 선언 (정책 및 프로그램 → 앱 콘텐츠)

| 항목 | 답 | 근거 |
|---|---|---|
| 개인정보처리방침 | `https://studio-mangru.github.io/privacy/` | **선행 작업**: 해당 문서 §1 앱 목록에 이 앱을 추가하고, SDK 없음/전송 없음을 명시해야 한다 |
| 앱 액세스 권한 | 제한 없이 모든 기능 사용 가능 | 로그인·계정 없음 |
| 광고 | **포함하지 않음** | 현재 광고 SDK 0 |
| 콘텐츠 등급 | 설문 → 게임 / 폭력·성적 내용·비속어·약물·도박 전부 없음 | 전체이용가 예상 |
| 타겟층 | **13세 이상 권장** (⚠️ 유저 판단) | 어린이 포함 시 Families 정책 적용 → 향후 광고 SDK 선택지가 좁아진다 |
| 데이터 보안 | 수집 없음 / 공유 없음 / 삭제 요청 대상 없음 | 점수·해금은 `localStorage` = 기기 내부 |
| 뉴스 앱 | 아니오 | |
| 코로나19 접촉자 추적 | 아니오 | |
| 정부 앱 | 아니오 | |
| 금융 기능 | 없음 | |
| 헬스 앱 | 아니오 | |

> 앱이 `INTERNET` 권한을 갖고 있어도 데이터 수집 선언과는 무관하다. 실제 전송이 없으므로
> 데이터 보안은 "수집 없음"이 맞다. (권한 제거 가능 여부는 실기 테스트 후 판단 — `feat/android` PR 참고)

---

## 5. 스토어 설정

| 항목 | 값 |
|---|---|
| 앱 카테고리 | 게임 → **아케이드** |
| 태그 (최대 5) | 아케이드 / 캐주얼 / 물리 / 파티 게임 / 싱글 플레이어 |
| 이메일 (필수) | `studio@mangru.dev` |
| 웹사이트 | `https://www.mangru.dev` |
| 전화번호 | (비움 — 선택) |
| 외부 마케팅 | 허용 |

---

## 6. 출시

### ⚠️ 프로덕션 액세스 관문 — 비공개 테스트 12명 × 14일

**프로덕션에 바로 못 간다.** 2023-11-13 이후 만들어진 개인 개발자 계정은 계정에
프로덕션 액세스가 부여될 때까지 **앱마다** 아래를 통과해야 한다.

| 요건 | 내용 |
|---|---|
| 트랙 | **비공개 테스트(closed / `alpha`)** — 내부 테스트(`internal`)는 **카운트되지 않는다** |
| 인원 | 옵트인한 테스터 **12명 이상** (고유 Google 계정) |
| 기간 | **14일 연속** |
| 활동 | 설치만으로는 안 된다. 실제로 앱을 열고 써야 한다. 다운로드만 있으면 "inactive testing" 으로 반려된다 |

> 같은 사람이 여러 앱의 테스터가 되는 건 허용된다. 단 각 앱을 실제로 써야 한다.
> 조직(사업자) 계정과 2023-11-13 이전 개인 계정은 이 요건에서 면제된다.

테스터 모으는 방법:

1. **지인 12명** — 가장 확실하다. 실제로 플레이할 사람이어야 한다
2. **Google 그룹으로 관리** — 콘솔에 이메일을 하나씩 넣는 대신 그룹 주소 하나만 등록하면
   가입·탈퇴 관리가 쉽다
3. itch.io 페이지(`rumaniel.itch.io/splat-sticky`)에 이미 플레이어가 있으면 그쪽에 요청
4. 테스터 교환 서비스는 권하지 않는다 — 실사용이 없으면 반려되고 정책 위반 소지도 있다

### 트랙 진행

| 단계 | 트랙 | 워크플로 |
|---|---|---|
| 1. 동작 확인 | `internal` | `-f publish=true -f track=internal` |
| 2. **액세스 심사용** | `alpha` (비공개) | `-f publish=true -f track=alpha` |
| 3. 14일 경과 후 | — | 콘솔에서 **프로덕션 액세스 신청** |
| 4. 승인 후 | `production` | `-f publish=true -f track=production` + 단계적 출시 20% |

```bash
gh workflow run android-release.yml -R rumaniel/chap-sticky -f publish=true -f track=alpha
```

### 기타

| 항목 | 값 |
|---|---|
| 앱 서명 | **Play 앱 서명** 사용 (업로드 키 분실 시 재설정 가능) |
| 국가/지역 | 전체 |
| 기기 카테고리 | 휴대전화 (태블릿은 S4 결정 후) |

### 출시 노트 (500자 제한)

**ko-KR**
```
첫 출시입니다.

벽에 찐득이를 던져 붙이고, 흘러내리기 전까지 버티세요.
- 모형 3종 (찐득맨 / 문어찐득 / 별찐득)
- 맵 4종 (칠판 / 거실 / 유리창 / 냉장고)
- 파티 모드 2~8인 (한 기기 돌려던지기)
- 로컬 리더보드
- 오프라인 플레이, 광고 없음
```

**en-US**
```
Initial release.

Flick the sticky toy at the wall and hang on before it slides off.
- 3 toys (Sticky Man / Octo / Star)
- 4 walls (Chalkboard / Living room / Window / Fridge)
- Hot-seat party for 2-8 players
- Local leaderboard
- Plays offline, no ads
```

---

## 7. 진행 체크리스트

**콘솔 (사람이 직접)**
- [x] Play Console 에서 앱 생성 (§1)
- [x] `studio-mangru.github.io/privacy/` 에 이 앱 추가 (2026-08-25, 앱별 데이터 처리 차이도 명시)
- [x] 앱 콘텐츠 선언 전부 작성 (§4)
- [x] 스토어 등록정보 텍스트·이미지 업로드 (§2, §3)
- [x] 스토어 설정 (§5)
- [x] 내부 테스트 트랙에 테스터 추가 (동작 확인용 — 액세스 심사에는 인정 안 됨)
- [ ] **비공개 테스트(alpha) 트랙 생성 + 옵트인 링크 발급**
- [ ] **테스터 12명 확보 → 14일 연속 실사용**
- [ ] 프로덕션 액세스 신청

**저장소 (자동화 가능)**
- [x] S1 앱 아이콘 512 생성
- [x] S2 피처 그래픽 1024×500 생성
- [x] S3 스크린샷 1080×1920 5장
- [ ] 업로드 키스토어 생성 + `ANDROID_KEYSTORE_BASE64` 시크릿 등록
- [ ] AAB 빌드·업로드 워크플로 (`solitaire-portfolio` 의 versionCode 자동 증분 패턴 이식)
