# 찹! 찐득이 (Splat! Sticky) — 리뷰어 컨텍스트

벽에 찐득이를 던져 붙이고 버티는 물리 미니게임. 순수 JavaScript + Canvas 2D.

## 아키텍처

```
game/
  index.html      단일 진입점. classic <script> 태그로 11개 모듈을 순서대로 로드
  js/
    i18n.js       ko/en 문자열, data-i18n 속성 바인딩
    shapes.js     ShapeDef 레지스트리 — 모형별 stickyPoints(끈적임 부위)와 grip
    materials.js  MaterialDef 레지스트리 — 벽 재질별 grip, 맵 배경 드로잉
    audio.js      WebAudio 프로시저럴 SFX/BGM. 오디오 파일 0개
    score.js      버틴 시간 기반 점수, localStorage 리더보드
    physics.js    포사체 + Magnus 커브 + verlet 워블
    input.js      포인터 샘플링(플릭 속도), 원형 드래그로 스핀 장전
    sticky.js     부착 판정(충격량 vs 접착력), 그립 감쇠, 크롤다운
    ui.js         메뉴/HUD/리더보드 DOM
    modes.js      연습 / 파티(핫시트) 모드 흐름
    main.js       고정 스텝 루프, 씬 전환, 렌더링
```

전역 네임스페이스는 `window.ST` 하나뿐이다. 각 모듈은 `window.ST = window.ST || {}` 로 시작해 자기 슬롯만 채운다.

## 절대 깨면 안 되는 제약

1. **런타임 의존성 0.** npm 패키지를 게임 코드에 들이지 않는다. 번들러도 없다.
2. **ES module 금지.** `file://` 에서 CORS 로 차단된다. `import`/`export` 대신 `window.ST` 를 쓴다.
3. **`file://` 더블클릭 실행이 보장돼야 한다.** 심사·오프라인 배포 시나리오다. `fetch()` 로 로컬 파일을 읽는 코드는 넣지 않는다.
4. **에셋 파일 없음.** 그래픽은 Canvas 코드 드로잉, 사운드는 WebAudio 합성이다.
5. 좌표계는 **가상 해상도 480×800**(`ST.view`) 기준이고 `ST.view.scale` 로 실제 캔버스에 매핑된다. 렌더 코드의 좌표 상수는 전부 이 공간의 값이다.

## 리뷰에서 특히 봐줬으면 하는 것

- **매 프레임 할당**: `update()`/`render()` 경로에서 객체·배열·클로저를 새로 만들면 모바일에서 GC 스파이크가 난다.
- **물리 정합성**: 스쿼시/스트레치 방향이 실제 힘의 방향과 맞는지. 늘어남은 장력, 찌그러짐은 충격이어야 한다.
- **UI 요동**: 숫자가 바뀔 때 레이아웃이 흔들리는 코드.
- **`file://` 호환성 위반**: 위 제약 2·3을 건드리는 변경.
- **Android WebView(Capacitor) 대응**: 세이프에어리어, 백그라운드 진입 시 오디오/루프 정지, 뒤로가기 처리.

## 리뷰 언어

리뷰 코멘트는 **한국어**로 작성한다. 코드·식별자·에러 메시지는 원문 그대로 둔다.
