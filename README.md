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

## 배포 · 버저닝

**버전의 유일한 소스는 `package.json` 의 `version` 이다.** 사람이 손으로 올리고,
태그는 그걸 가리키기만 한다. 태그와 다르면 워크플로가 멈춘다.

| 자리 | 값 | 누가 |
|---|---|---|
| `package.json` version | `1.0.1` | **사람** (유일한 수동 숫자) |
| itch userversion | `1.0.1+a1b2c3d` | 자동 (버전 + 커밋 sha7) |
| Play versionName | `1.0.1` | 자동 (버전 그대로) |
| Play versionCode | Play 최대값 + 1 | 자동 (Play API 조회) |

올리는 기준 — **PATCH**: 버그·밸런스 / **MINOR**: 새 콘텐츠·기능(맵·모형·업적) / MAJOR: 안 씀.

### 내보내는 법

```bash
# 1) 버전 올리고 커밋
npm version patch --no-git-tag-version     # 또는 minor
git commit -am "chore: 1.0.1"
git push origin main

# 2) 태그를 밀면 itch + Play internal 이 같이 나간다
git tag v1.0.1 && git push origin v1.0.1
```

`main` 푸시는 **배포하지 않는다.** 문서 커밋에 `[skip ci]` 를 붙이던 규율이 필요 없고,
itch 와 Play 가 같은 태그에서 나가므로 "이 버전에 뭐가 올라갔나" 가 한 줄로 답이 된다.
상위 트랙 승격(internal → alpha → production)은 언제나 Play Console 에서 사람이 한다.

태그 없이 올려야 하면 두 워크플로 다 `workflow_dispatch` 로 수동 실행할 수 있다
(itch 는 `+dev.<run>.<sha>` 로 표시되고, Play 는 트랙을 고를 수 있다).

필요 설정: secret `BUTLER_API_KEY` · `ANDROID_KEYSTORE_BASE64` · `ANDROID_KEYSTORE_PASSWORD` ·
`ANDROID_KEYALIAS_PASSWORD` · `PLAY_CONSOLE_SERVICE_ACCOUNT`,
vars `ITCH_USER` · `ITCH_GAME` · (선택) `ITCH_CHANNEL` · `ANDROID_KEYALIAS_NAME` ·
`PLAY_CONSOLE_PACKAGE_NAME`.
