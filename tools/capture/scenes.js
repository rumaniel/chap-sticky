/* 스토어 스크린샷 5장을 게임 자신의 렌더러로 찍는다.
 *
 * 게임은 에셋 파일이 0개라 스크린샷도 "찍는" 게 아니라 "렌더"한다. 이 파일은 게임
 * 페이지(localhost:8123)의 콘솔/디버거에 통째로 붙여 넣어 실행한다. 저장은
 * tools/capture/save_server.py(8124) 가 받는다.
 *
 *   python -m http.server 8123 --directory game      (또는 .claude/launch.json 의 sticky-toss)
 *   python tools/capture/save_server.py
 *   브라우저에서 이 파일 내용을 실행 → marketing/itchio/itch_s*.png 갱신
 *   python tools/gen_play_assets.py                   (→ marketing/googleplay/play_s*.png)
 *
 * 캔버스를 960×1600(가상 480×800 의 2배)으로 잡고 ST.view.scale=2 로 렌더한다.
 * 벽 캐시가 캔버스 해상도로 만들어지므로 setup() 전에 크기를 바꿔야 선명하다.
 */
(async function captureAll() {
  const G = ST.Game, I = ST.Input, T = ST.Physics.TUNE;
  const cv = document.querySelector('canvas');
  const SAVE = 'http://localhost:8124/save?name=';
  const log = [];

  function bigCanvas() {
    cv.width = 960; cv.height = 1600;
    ST.view.scale = 2;
  }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function step(n) { for (let i = 0; i < n; i++) G.update(1 / 60); }
  async function save(name) {
    ST.FX.shakeX = ST.FX.shakeY = 0;
    G.render();
    const r = await fetch(SAVE + name, { method: 'POST', body: cv.toDataURL('image/png') });
    log.push(name + ': ' + (await r.text()));
  }
  function clean() {
    G.banner = null;
    G.hintT = 0;
    G._ghostOn = false;
  }
  function throwAt(speed, angDeg, relX, relY) {
    G.toyScreen = { x: relX || 240, y: relY || 560 };
    I.enable();
    const a = ((angDeg || 0) * Math.PI) / 180;
    I.onThrow({ vx: speed * Math.sin(a), vy: -speed * Math.cos(a) }, { vel: 0 });
    let f = 0;
    while (G.state === 'fly' && f < 400) { G.update(1 / 60); f++; }
    return G.state;
  }

  bigCanvas();

  // ── s1 조준: 잡고 있는 상태 — 궤적 점선 + 파워 게이지 니들 ──
  ST.Modes.startPractice('man', 'room', 5);
  clean();
  G.toyScreen = { x: 252, y: 548 };
  I.holding = true; I.liveSpeed = 1.32; I.spinCharge = 0; I.spinVel = 0;
  step(6);
  await save('itch_s1_aim.png');

  // ── s3 커브볼 모드: 스핀 장전 — 셰브런 게이지 + 휜 화살표 ──
  I.spinCharge = 9; I.spinVel = 19; I._lastSpinAt = performance.now();
  for (let i = 0; i < 45; i++) { I.spinVel = 19; I._lastSpinAt = performance.now(); G.update(1 / 60); }
  await save('itch_s3_curve.png');
  I.holding = false; I.spinCharge = 0; I.spinVel = 0;

  // ── s2 크롤 버티기: 칠판, sweet 로 던져 붙인 뒤 3.5초 ──
  ST.Modes.startPractice('man', 'chalk', 5);
  clean();
  if (throwAt(G.gaugeBand.sweet, 0, 240, 560) === 'stuck') step(210);
  clean();
  await save('itch_s2_crawl.png');

  // ── s5 유리창: 우상 판유리 쪽으로 살살 — 붙을 때까지 후보 몇 개 ──
  ST.Modes.startPractice('man', 'glass', 5);
  clean();
  const B5 = G.gaugeBand;
  const tries = [[B5.sweet * 1.02, 10, 250, 520], [B5.sweet * 1.05, 14, 260, 510], [B5.sweet, 6, 245, 530], [B5.sweet * 1.08, 12, 255, 500]];
  for (const t of tries) {
    if (throwAt(t[0], t[1], t[2], t[3]) === 'stuck') break;
    ST.Modes.startPractice('man', 'glass', 5); clean();
  }
  if (G.state === 'stuck') step(80);
  clean();
  await save('itch_s5_glass.png');

  // ── s4 파티 동시 크롤: 4인, 착지까지만 던지고 라운드 끝에 전원 동시 크롤 ──
  ST.Modes.startParty(4, 'man', 'room', 1, true);
  for (let p = 0; p < 4; p++) {
    for (let w = 0; w < 40 && G.state !== 'aim'; w++) await sleep(50);
    clean();
    const B = G.gaugeBand;
    throwAt(B.sweet * (0.97 + p * 0.03), -8 + p * 5, 230 + p * 8, 550);
    await sleep(600);
  }
  for (let w = 0; w < 60 && G.state !== 'simul'; w++) await sleep(50);
  step(150);
  clean();
  await save('itch_s4_party.png');

  // 원래 크기로
  window.dispatchEvent(new Event('resize'));
  ST.Modes.toTitle && ST.Modes.toTitle();
  return log;
})();
