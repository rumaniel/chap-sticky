/* 게이지 밴드 정합성 검사 (R11/R14)
 *
 * 게이지는 두 가지를 약속한다:
 *   limit — "여기까지는 붙는다".  어기면 초록 존을 믿고 던졌는데 튕긴다.
 *   sweet — "여기가 최적이다".    어기면 마커대로 던져도 퍼펙트가 안 나온다.
 *
 * 두 상수는 성격이 다르다. limit 은 최악(비스듬한 던지기) 기준 안전 하한이어야 하고,
 * sweet 은 전형(똑바로) 기준 목표점이어야 한다. 같은 상수를 쓰면 sweet 이 밴드 아래로
 * 밀려난다 — 실제로 그랬다 (R14).
 *
 * 사용: node tools/sim/gauge.js
 *       TANGENT_DIV=1.25 node tools/sim/gauge.js                  (후보 실험)
 */
const S = require('./sim.js');
const { ST, T, gaugeBand, MIN_FLICK, TANGENT_DIV } = S;

const PERFECT_BASE = (() => {
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '..', '..', 'game', 'js', 'sticky.js'), 'utf8');
  const m = src.match(/const\s+PERFECT_BASE\s*=\s*([0-9.]+)/);
  if (!m) throw new Error('sticky.js 에서 PERFECT_BASE 를 못 찾았다');
  return Number(m[1]);
})();
const SWEET = ST.Sticky.SWEET;

/* 던지기 1회 → 충격비 r 과 결과 */
function shoot(shape, map, relX, relY, flick) {
  const hold = ST.Physics.unproject(relX, relY, T.HOLD_Z);
  const f = ST.Physics.makeThrow(flick, 0, hold);
  for (let i = 0; i < 900; i++) {
    const hit = ST.Physics.stepFlight(f, 1 / 60);
    if (!hit) continue;
    if (hit.type !== 'wall') return null;
    const res = ST.Sticky.resolveImpact(hit, shape, map);
    const impulse = (hit.vz + 0.35 * Math.hypot(hit.vx, hit.vy)) * shape.mass;
    return {
      r: res.adhesion ? impulse / (res.adhesion * ST.Sticky.K_MAX) : null,
      perfect: !!res.perfect,
      bounce: res.reason === 'bounce',
      full: res.contacts ? res.contacts.size === shape.stickyPoints.length : false,
    };
  }
  return null;
}

console.log('TANGENT_DIV=' + TANGENT_DIV + ' · sweet 은 닫힌 해 (R15)');
console.log('SWEET=' + SWEET + '  PERFECT_BASE=' + PERFECT_BASE + ' (밴드는 던지기마다 민감도에 비례, R15)');
console.log('');

// ── 검사 1: 표시 limit 이하인데 튕기는가 ─────────────────────────────
// 릴리즈 위치와 던지기 각도를 전수 스윕. 속도는 정확히 표시 limit.
// 게이지는 전패드 접촉을 가정하므로 부분 접촉 케이스는 제외한다.
console.log('=== 검사 1: 표시 limit 이하 던지기가 정말 붙는가 (전패드 접촉만) ===');
console.log('모형   맵       limit    최대 r   튕김');
let worstAll = 0, bAll = 0, tAll = 0;
for (const shape of ST.Shapes.list) {
  for (const map of ST.Materials.list) {
    const B = gaugeBand(shape, map);
    let worst = 0, b = 0, t = 0;
    for (let rx = 60; rx <= 420; rx += 30) {
      for (let ry = 300; ry <= 700; ry += 50) {
        for (let ang = -80; ang <= 80; ang += 5) {
          const a = (ang * Math.PI) / 180;
          const r = shoot(shape, map, rx, ry, { vx: B.limit * Math.sin(a), vy: -B.limit * Math.cos(a) });
          if (!r || !r.full) continue;
          t++; if (r.bounce) b++;
          if (r.r > worst) worst = r.r;
        }
      }
    }
    worstAll = Math.max(worstAll, worst); bAll += b; tAll += t;
    console.log(
      shape.id.padEnd(6), map.id.padEnd(8), B.limit.toFixed(4).padStart(7),
      worst.toFixed(4).padStart(8), ((t ? ((b / t) * 100).toFixed(1) : '-') + '%').padStart(7),
    );
  }
}
console.log('전체 최대 r = ' + worstAll.toFixed(4) + ' · 튕김 ' + bAll + '/' + tAll
  + ' → ' + (worstAll <= 1 ? '표시 <= 실제 성립' : '실제보다 ' + ((worstAll - 1) * 100).toFixed(2) + '% 과다 표시'));

// ── 검사 2: sweet 마커대로 던지면 퍼펙트가 나오는가 ──────────────────
console.log('');
console.log('=== 검사 2: 표시 sweet 속도로 똑바로 던지면 퍼펙트인가 ===');
console.log('(릴리즈 x 5곳 × y 3곳. 유리창은 중앙에 창틀이 있어 정중앙만 재면 왜곡된다)');
console.log('모형   맵       sweet    limit    퍼펙트   순서');
let ok = 0, all = 0;
for (const shape of ST.Shapes.list) {
  for (const map of ST.Materials.list) {
    const B = gaugeBand(shape, map);
    let h = 0, t = 0;
    for (const rx of [180, 210, 240, 270, 300]) {
      for (const ry of [500, 560, 620]) {
        const r = shoot(shape, map, rx, ry, { vx: 0, vy: -B.sweet });
        if (!r || !r.full) continue;
        t++; if (r.perfect) h++;
      }
    }
    ok += h; all += t;
    const order = (B.min < B.sweet && B.sweet <= B.limit && B.limit <= B.max) ? 'OK' : '깨짐!';
    console.log(
      shape.id.padEnd(6), map.id.padEnd(8),
      B.sweet.toFixed(4).padStart(7), B.limit.toFixed(4).padStart(8),
      ((t ? Math.round((h / t) * 100) : '-') + '%').padStart(8), '  ' + order,
    );
  }
}
console.log('전체 ' + Math.round((ok / all) * 100) + '% — 마커를 정확히 따랐을 때 퍼펙트가 나오는 조합 비율');

// ── 검사 3: 퍼펙트 밴드가 "던지기 세기" 로는 얼마나 넓은가 ────────────
// PERFECT_BAND 는 충격비 r 공간에서 정의되는데, r 이 속도에 반응하는 기울기가
// 맵마다 다르다. 그래서 같은 밴드가 맵에 따라 넓거나 좁은 세기 구간이 되고,
// 실측 퍼펙트율이 맵마다 크게 갈린다.
console.log('');
console.log('=== 검사 3: 퍼펙트가 나오는 세기 구간 폭 (똑바로, 릴리즈 y=560) ===');
console.log('모형   맵       sweet    퍼펙트 구간       sweet 대비 폭');
for (const shape of ST.Shapes.list) {
  for (const map of ST.Materials.list) {
    const B = gaugeBand(shape, map);
    let lo = null, hi = null;
    for (let s = MIN_FLICK; s <= B.max; s += 0.002) {
      const r = shoot(shape, map, 240, 560, { vx: 0, vy: -s });
      if (r && r.perfect) { if (lo === null) lo = s; hi = s; }
    }
    console.log(
      shape.id.padEnd(6), map.id.padEnd(8), B.sweet.toFixed(4).padStart(7),
      '  ' + (lo === null ? '없음' : lo.toFixed(3) + ' ~ ' + hi.toFixed(3)).padEnd(16),
      lo === null ? '' : ((hi - lo) / B.sweet * 100).toFixed(1) + '%',
    );
  }
}
