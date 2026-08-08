# 찹! 찐득이 — 코드 구조 & 데이터 구조

리뷰 가이드. 전체 약 2,900줄, 순수 JS 11모듈, 빌드 과정 없음(클래식 `<script>`, `window.ST` 네임스페이스).

## 1. 모듈 지도 (로드 순서 = index.html 순서)

| 모듈 | 역할 | 핵심 export (ST.*) |
|---|---|---|
| `i18n.js` | ko/en 스트링 테이블, DOM 주입 | `I18N.t(key,...args)`, `setLang`, `applyDOM` |
| `shapes.js` | 모형 정의+드로잉 | `Shapes.list/get`, ShapeDef |
| `materials.js` | 맵/머테리얼 정의+벽 드로잉 | `Materials.list/get`, **`materialAt(map,x,y)`** |
| `audio.js` | WebAudio 신스 SFX+BGM | `Audio.play(name)`, `unlock()`, `toggleMute()` |
| `score.js` | 점수 규칙·플로터·리더보드·해금 | `Score.beginThrow/onStick/tickHold/finalize`, `addBoard`, `earned` |
| `physics.js` | 투영·비행 적분·이펙트 | `Physics.project/unproject/makeThrow/stepFlight`, `FX` |
| `input.js` | 포인터 통합, 플릭·스핀 제스처 | `Input.enable/disable/tick`, 콜백 `onThrow(flick,spin)` 등 |
| `sticky.js` | **부착 판정 + 크롤 물리 v2** | `Sticky.resolveImpact/createStuck/update`, `V2` 튜닝 |
| `ui.js` | DOM 화면(타이틀~결과), 카드 | `UI.init/show/showGame/showResult/showBoard` |
| `modes.js` | 세션 흐름(연습/파티/동시시뮬) | `Modes.startPractice/startParty/onThrowEnd/onSimulEnd` |
| `main.js` | 캔버스 루프·씬 렌더·**Game 상태머신** | `Game`, resize, boot |

의존 방향: 아래 모듈이 위를 호출(역방향 없음). 순환 없음 — 모두 런타임 참조라 로드 순서는 정의 시점만 맞으면 됨.

## 2. 데이터 흐름 (한 번의 던지기)

```
[input.js] pointerdown→move(샘플링)→up
   flick{vx,vy px/ms} + spin{charge,vel}
        ↓ Game.onThrow
[physics.js] makeThrow → flight{x,y,z,vx,vy,vz,spin,angle}
   stepFlight (60fps×2서브스텝): 중력, Magnus(vx += MAGNUS·spin·vz·dt)
        ↓ 결과 {type: wall|floor|past}
[sticky.js] resolveImpact(impact, shape, map)
   기하 접촉 → 패드별 materialAt → 접착력 Σ → 충격량 비교
   → {stuck, quality, gh, perfect} | {reason: bounce|nogrip}
        ↓ stuck이면
[sticky.js] createStuck → st{pads[], juice, ...} → 매 프레임 update(st,dt)
   phase: settle → hold(패드 감쇠) ⇄ roll(topple) → peel(순차분리→진자) → 'fall' 이벤트
        ↓ 동시에
[score.js] tickHold(ts, st, dt): 초당 15×링배율 누적, 스팟 진입 보너스
        ↓ 낙하 착지
[main.js] _endThrow → finalize → Modes.onThrowEnd(res)
[modes.js] 기록/로테이션 → 다음 턴 | 동시시뮬 | 결과 화면
```

## 3. 좌표계 (버그 다발 지점 — 리뷰 포인트)

| 계 | 축 | 용도 |
|---|---|---|
| **월드** | 미터, y **위+**, z 카메라→벽(0→3.0) | 비행·부착·크롤 물리 전부 |
| **벽 정규화** | 0~1, y **아래+** (좌상 원점) | zone/noGrip/rings/spots 정의 |
| **가상 화면** | 480×800px, y **아래+** | 렌더·입력. 실제 캔버스는 레터박스 스케일 |
| **모형 로컬** | -1~1 단위, y **아래+** | 패드 좌표, draw() |

- 투영: `p = FOCAL/(FOCAL+z)`, `sx = cx + x·PPM·p`, `sy = HORIZON + (CAM_H−y)·PPM·p`
- **주의**: 바디 각도(`st.angle`)는 화면 기준 시계+ / 월드 궤도 회전은 수학 방향 — 롤·진자에서 부호 반전 필수 (커밋 f38de91의 버그). `pointWorld()`가 유일한 변환 경로 — 패드 월드좌표는 반드시 이걸 쓸 것.

## 4. 상태 머신

**Game.state** (main.js): `idle → aim → fly → {stuck | bounceoff | fall | floorflop} → done → (Modes가 다음 턴)` + 파티 동시시뮬 전용 `simul`(multi[] 병렬 갱신).
`simDefer`=true(파티 동시결과 ON)면 fly→wall 부착 시 크롤 없이 `done(deferred)` — 착지 정보만 Modes.pending으로.

**sticky phase** (st.phase): `settle(0.35s) → hold ⇄ roll → peel(→fall 이벤트)`
- hold: 패드 하중감쇠(위 패드 가중 LOAD_TOP, 아래-만-지지면 TORQUE_STRESS). 사망 패드 pop.
  - 남은 지지 분류: 위+아래=안정 / 위만=매달림(죽으면 진자) / **아래만 & minHP<TOPPLE_RATIO → roll**
  - 1패드 남음: 아래 지지면 **1점 topple**, 위면 진자 peel
- roll: 역진자 가속(sin, π/2 클램프), **피벗(남은 부착 패드 중심) 기준 실제 회전**으로 하강.
  완료 = `phi ≥ rollStep && 중심이 피벗 아래(relY < −0.35L)` — 완전한 topple. 완료 시 피벗 해제→아래쪽 패드 재부착(주스 소모)
- peel: 위 패드부터 간격 분리(pop) → 마지막 1점 감쇠 진자(SWING_MAX 1.05s) → fall(스윙 속도 계승)

이벤트 프로토콜: update()가 `['flip'|'roll'|'land'|'slip'|'pop'{x,y}|'peelstart'|'swing'|'fall']` 반환 → main `_handleStickyEvents`가 사운드/FX/낙하 전환. 문자열 또는 `{type,...}` 혼용 (`e.type||e`).

## 5. 핵심 자료구조

```js
// ShapeDef (shapes.js)
{ id, unlock, mass, decayMod, rollStep,       // 물리 개성
  stickyPoints: [{id, x, y, grip}],           // 로컬 단위좌표(y아래+)
  color/dark/light, radius, draw(ctx,S,opt) } // opt:{wob,t,squash,mood,contacts:Set}

// MapDef (materials.js)
{ id, unlock,
  mat: {grip, decay, flipPeriod, slideStep, slideCont, bounce},
  zone?: {x0,y0,x1,y1},           // 벽 정규화. 밖 = 머테리얼 없음
  noGrip?: [{x0,y0,x1,y1}, ...],  // 존 내부 노그립(창틀 등) → materialAt=null
  rings: {cx, cy, radii[], mults[]}, ringStyle: {color, dash, magnets?},
  spots: [{x, y, r, bonus, icon}],
  skyColor, floorColor[2], drawWall(ctx,W,H) }

// 부착 상태 st (sticky.createStuck)
{ shape, map, mat, x, y, angle,               // 월드 위치·자세
  pads: [{id, def, stuck, hp, hp0, rj}],      // 패드별 그립 HP + 감쇠지터
  juice, juiceMax, gh,                        // 크롤 수명(게이지=juice/juiceMax)
  phase, phaseT, roll{pivot,pivotIds,phi,vel,dir,step}, peel{order,swing...},
  holdTime, driftX, wob, squash, mood, contacts:Set, fallKick }

// 던지기 점수 ts (score.beginThrow)
{ throwBonus, holdScore, holdTime, spotsHit:Set, bonuses:[{text,color}], curve? }

// 세션 (modes.js)
{ mode:'practice'|'party', shapeId, mapId, throwsPer, simMode,
  players: [{name, color, throws:[res], total, bestHold}],
  cur, round, markers:[{x,y,color,label}], pending:[deferred stick], done }

// localStorage 'stickytoss_v1'
{ board: [{name, score, holdTime, shape, map, date}]×10, earned }
```

## 6. 횡단 관심사

- **i18n**: 모든 유저 노출 문자열은 `I18N.t(key)`. HTML 정적 텍스트는 `data-i18n` 속성 → `applyDOM()`. 새 문자열 추가 시 ko/en 둘 다.
- **오디오**: 전부 신스(외부 파일 0) → file:// 안전 + 저작권 클린. 모바일 언락은 첫 pointerdown.
- **file:// 호환 제약**: ES 모듈·fetch 리소스 금지 유지할 것 (심사 더블클릭 시나리오).
- **뷰포트**: `visualViewport` 기반 레터박스 + rAF 폴링(iframe/pane 대응). FAB(사운드/언어)는 resize()에서 캔버스 기준 배치.
- **난수**: 부착 시 패드 HP ±18%·감쇠지터 ±14%·주스 ±10%·롤 방향(비커브 랜덤/커브 고정 |driftX|>0.006).

## 7. 시뮬 테스트 (수동 QA 대체 — 콘솔에 붙여넣기)

```js
// headless 스로우: 결과 {stuck, holdTime, total}
function simThrow(shape, map, vy, vx=0.02) {
  ST.Modes.startPractice(shape, map, 1);
  ST.Input.onThrow({vx, vy}, {charge:0, vel:0});
  let g=0; while (g++<14000 && !(ST.Game.state==='done' && !ST.Game._doneRes)) ST.Game.update(1/60);
  return ST.Modes.session.players[0].throws[0];
}
// 예: 10회 배치로 부착률/홀드 확인
Array.from({length:10}, () => simThrow('man','room',-1.4));
```
개발 중 밸런스 변경 시 GDD §3 매트릭스를 이 방식으로 재측정해 갱신한다.
주의: 브라우저가 js를 캐시하므로 측정 전 강력 새로고침(Ctrl+F5) 필수.

## 8. 배포 파이프라인

`main` push → GitHub Actions(`.github/workflows/deploy.yml`) → butler → itch.io `rumaniel/splat-sticky:html5` 자동 배포.
필요 설정: secret `BUTLER_API_KEY`, vars `ITCH_USER=rumaniel`, `ITCH_GAME=splat-sticky`.
제출 ZIP: `submission/` (game/* 루트 압축 — index.html 더블클릭 실행 검증 완료).
