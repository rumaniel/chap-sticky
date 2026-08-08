# 찹! 찐득이 (Splat! Sticky)

2026 미니게임 메이커스 챌린지 출품작. 추억의 찐득이(sticky wall crawler) 장난감을 물리 기반 HTML5 미니게임으로.

**플레이**: `game/index.html`을 브라우저에서 열면 바로 실행 (서버 불필요, 의존성 0)

## 조작

- 찐득이를 **잡고 벽 쪽으로 플릭** → 던지기 (마우스/터치 동일)
- 잡은 채로 **빙글빙글 돌리면** 스핀 장전 → 커브볼 (Magnus 효과)
- 세게 던지면 튕겨 떨어지고, 약하면 벽에 못 미친다 — 스윗스팟을 찾아라
- 붙은 뒤엔 그립이 닳으며 데굴데굴 굴러 내려온다 → **버틴 시간 × 과녁 배율**로 점수

## 모드

1. **연습**: 5구 라운드, 로컬 리더보드 (localStorage)
2. **파티**: 2~8명 핫시트, 인당 3구, 한 벽에 전원 결과 표시
3. 온라인 멀티(P2P): 로드맵 — 기획안 참고

## 구조

- 순수 JavaScript + Canvas, 외부 라이브러리·에셋 파일 0개
- 그래픽 = 코드 드로잉, 사운드 = WebAudio 신스 (저작권 클린)
- `game/js/`: physics(투영·Magnus) / sticky(부착·크롤다운) / shapes(모형+끈적부위) / materials(맵) / modes / ui / score / audio / input / main

## 배포

`main` 푸시 시 GitHub Actions가 butler로 itch.io에 자동 배포 (`.github/workflows/deploy.yml`).
필요 설정: secret `BUTLER_API_KEY`, vars `ITCH_USER`, `ITCH_GAME`, (선택) `ITCH_CHANNEL`.
