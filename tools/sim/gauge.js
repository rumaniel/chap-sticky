/* 게이지·퍼펙트 정합성 검사 (R11 / R14 / R15)
 *
 * 게이지는 두 가지를 약속한다:
 *   limit — "여기까지는 붙는다".  어기면 초록 존을 믿고 던졌는데 튕긴다.
 *   sweet — "여기가 최적이다".    어기면 마커대로 던져도 퍼펙트가 안 나온다.
 * 퍼펙트 밴드는 세 번째 약속이다:
 *   세기 기준 폭이 맵마다 같고, 구간이 하나여야 한다. 세게 던질수록 퍼펙트→아님→퍼펙트
 *   로 되돌아오면 안 된다.
 *
 * 수식은 전부 game/js/sticky.js 의 것을 쓴다 (복사본 없음).
 * 사용: node tools/sim/gauge.js
 */
const S = require('./sim.js');
const { ST, T, gaugeBand, MIN_FLICK } = S;
const SWEET = ST.Sticky.SWEET;

/* 던지기 1회 → 충격비 r 과 결과. dts 를 주면 프레임 길이 배열을 순환한다 (히치 재현). */
function shoot(shape, map, relX, relY, flick, dts, spin) {
  const hold = ST.Physics.unproject(relX, relY, T.HOLD_Z);
  const f = ST.Physics.makeThrow(flick, spin || 0, hold);
  for (let i = 0; i < 900; i++) {
    const hit = ST.Physics.stepFlight(f, dts ? dts[i % dts.length] : 1 / 60);
    if (!hit) continue;
    // 벽 외(past/floor)도 같은 모양의 객체로 — 호출부가 .full/.outcome 을 바로 읽는다 (Copilot 지적)
    if (hit.type !== 'wall') return { outcome: hit.type, contacts: 0, full: false, perfect: false, r: null, x: NaN, y: NaN };
    const res = ST.Sticky.resolveImpact(hit, shape, map);
    return {
      r: res.adhesion ? ST.Sticky.impulseOf(hit, shape) / (res.adhesion * ST.Sticky.K_MAX) : null,
      perfect: !!res.perfect,
      bounce: res.reason === 'bounce',
      outcome: res.stuck ? 'stuck' : res.reason,
      contacts: res.adhesion ? res.contacts.size : 0,
      // 접착이 실제로 계산된 경우만 "전패드 접촉" — nogrip 경로는 contacts 에 기하 후보만
      // 담겨 돌아와서 size 만 보면 통과해 버린다 (Copilot 지적)
      full: !!res.adhesion && res.contacts.size === shape.stickyPoints.length,
      x: hit.x, y: hit.y,
    };
  }
  return { outcome: 'none', contacts: 0, full: false, perfect: false, r: null, x: NaN, y: NaN };
}
/* 전패드 접촉이 되는 릴리즈 위치를 x·y 격자에서 찾는다 (유리창은 정중앙이 창틀이다). */
function fullContactRelease(shape, map, speed) {
  for (const ry of [560, 500, 620, 440, 680, 380])
    for (const rx of [240, 270, 210, 300, 180, 330, 150])
      if (shoot(shape, map, rx, ry, straight(speed)).full) return [rx, ry];
  return null;
}
const straight = (sp) => ({ vx: 0, vy: -sp });
const RELX = [180, 210, 240, 270, 300];
let fails = 0;
function verdict(ok, msg) { if (!ok) fails++; console.log((ok ? '  OK   ' : '  FAIL ') + msg); }

console.log('TANGENT_K=' + ST.Sticky.TANGENT_K + '  TANGENT_DIV=' + ST.Sticky.TANGENT_DIV
  + '  SWEET=' + SWEET + '  PERFECT_BASE=' + ST.Sticky.PERFECT_BASE + '  MIN_FLICK=' + MIN_FLICK);
console.log('');

// ── 검사 1: 표시 limit 이하 던지기가 정말 붙는가 ─────────────────────────────
// 릴리즈 위치·각도 전수 스윕, 속도는 정확히 표시 limit. 게이지는 전패드 접촉을 가정하므로
// 부분 접촉 케이스는 제외한다.
console.log('=== 검사 1: 표시 limit 이하 던지기가 정말 붙는가 (전패드 접촉만) ===');
let worstAll = 0, bAll = 0, tAll = 0;
for (const shape of ST.Shapes.list) {
  for (const map of ST.Materials.list) {
    const B = gaugeBand(shape, map);
    for (let rx = 60; rx <= 420; rx += 30) {
      for (let ry = 300; ry <= 700; ry += 50) {
        for (let ang = -80; ang <= 80; ang += 5) {
          const a = (ang * Math.PI) / 180;
          const r = shoot(shape, map, rx, ry, { vx: B.limit * Math.sin(a), vy: -B.limit * Math.cos(a) });
          if (!r || !r.full) continue;
          tAll++; if (r.bounce) bAll++;
          if (r.r > worstAll) worstAll = r.r;
        }
      }
    }
  }
}
verdict(bAll === 0, '최대 r ' + worstAll.toFixed(4) + ' · 튕김 ' + bAll + '/' + tAll + ' → ' + (worstAll <= 1 ? '표시 <= 실제' : '과다 표시'));

// ── 검사 2: sweet 마커대로 던지면 퍼펙트인가 ───────────────────────────────
console.log('');
console.log('=== 검사 2: 표시 sweet 로 똑바로 던지면 퍼펙트인가 (릴리즈 x 5 × y 3, 전패드만) ===');
console.log('모형   맵       구간        sweet    limit    r@sweet  퍼펙트');
let ok2 = 0, all2 = 0;
const empty2 = []; // 전패드 샘플이 0인 조합 — 건너뛰면 검증 안 한 채 통과한다 (Copilot 지적)
for (const shape of ST.Shapes.list) {
  for (const map of ST.Materials.list) {
    const B = gaugeBand(shape, map);
    let h = 0, t = 0, rs = [];
    for (const rx of RELX) for (const ry of [500, 560, 620]) {
      const r = shoot(shape, map, rx, ry, straight(B.sweet));
      if (!r || !r.full) continue;
      t++; if (r.perfect) h++; rs.push(r.r);
    }
    ok2 += h; all2 += t;
    if (t === 0) empty2.push(shape.id + '/' + map.id);
    const rMean = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : NaN;
    console.log(
      shape.id.padEnd(6), map.id.padEnd(8), B.branch.padEnd(11),
      B.sweet.toFixed(4).padStart(7), B.limit.toFixed(4).padStart(8),
      (isNaN(rMean) ? '-' : rMean.toFixed(4)).padStart(8),
      ((t ? Math.round((h / t) * 100) : '-') + '%').padStart(7), B.exact ? '' : '  (근 없음)',
    );
  }
}
verdict(ok2 === all2 && empty2.length === 0, '마커 적중 시 퍼펙트 ' + ok2 + '/' + all2
  + (empty2.length ? ' · 전패드 샘플 없는 조합: ' + empty2.join(', ') : ' · 12/12 조합 검증'));

// ── 검사 3: 퍼펙트 구간 — 세기 기준 폭이 같고, 구간이 하나인가 ─────────────
// 조합마다 전패드 접촉이 되는 릴리즈 x 를 고른다 (유리창은 정중앙이 창틀이다).
// 세기를 0.002 간격으로 훑어 연속 구간을 전부 열거한다.
console.log('');
console.log('=== 검사 3: 퍼펙트 세기 구간 (전패드 접촉만) — 구간 수는 1 이어야 한다 ===');
console.log('모형   맵       릴리즈x  구간수  폭(sweet대비)  구간');
const widths = [], g3 = {};
for (const shape of ST.Shapes.list) {
  for (const map of ST.Materials.list) {
    const B = gaugeBand(shape, map);
    const rel = fullContactRelease(shape, map, B.sweet);
    // 건너뛰지 않는다 — 조합 하나라도 못 재면 "전부 통과" 는 거짓 초록이다 (리뷰 지적)
    if (!rel) { verdict(false, shape.id + '/' + map.id + ' 전패드 접촉 릴리즈를 못 찾음'); continue; }
    const relX = rel[0], relY = rel[1];
    const iv = [];
    let cur = null;
    for (let s = MIN_FLICK; s <= B.max; s += 0.002) {
      const r = shoot(shape, map, relX, relY, straight(s));
      const p = !!(r && r.full && r.perfect);
      if (p && !cur) cur = [s, s];
      else if (p && cur) cur[1] = s;
      else if (!p && cur) { iv.push(cur); cur = null; }
    }
    if (cur) iv.push(cur);
    const total = iv.reduce((a, v) => a + (v[1] - v[0]), 0) / B.sweet * 100;
    widths.push(total);
    g3[shape.id + '/' + map.id] = { sweet: +B.sweet.toFixed(4), limit: +B.limit.toFixed(4), width: +total.toFixed(1), intervals: iv.length, rel: [relX, relY] };
    console.log(
      shape.id.padEnd(6), map.id.padEnd(8), String(relX).padStart(6), String(iv.length).padStart(6),
      (total.toFixed(1) + '%').padStart(13), '  ' + iv.map((v) => v[0].toFixed(3) + '~' + v[1].toFixed(3)).join('  '),
      iv.length === 1 ? '' : '  <-- 쪼개짐',
    );
    verdict(iv.length === 1, shape.id + '/' + map.id + ' 구간 ' + iv.length + '개');
  }
}
const wMin = Math.min(...widths), wMax = Math.max(...widths);
verdict(wMax / wMin < 2.0, '세기 기준 폭 ' + wMin.toFixed(1) + '% ~ ' + wMax.toFixed(1) + '% (비율 ' + (wMax / wMin).toFixed(2) + ', 2.0 미만이어야 한다)');

// ── 검사 4: 프레임 히치 — 50ms/100ms 프레임이 끼어도 같은 던지기가 퍼펙트인가 ──
console.log('');
console.log('=== 검사 4: 프레임 스케줄 — 같은 던지기는 주사율·히치·지터와 무관하게 같은 결과여야 한다 ===');
// 60fps 기준선과 다른 스케줄을 비교한다. 위치·접촉 수·결과(stuck/bounce/nogrip)·퍼펙트가
// 하나라도 다르면 실패. 부분 접촉 던지기도 버리지 않는다 — 리뷰가 잡은 재현 둘 다
// (유리창 (180,390) 100ms 히치 → 발 두 개 창틀에 빠짐 / 유리창 (60,410) 0.9×sweet 에서
// 60Hz 부착 vs 120Hz 튕김) 정확히 "접촉 수가 달라지는" 케이스였다.
// 스케줄: 벽 직전 50/100ms 히치 9곳 + 90/120/144Hz 고정 + 30~72fps 지터.
const RELS4 = [[240, 560], [180, 390], [300, 500], [210, 620], [60, 410]];
const RATES = [90, 120, 144];
const JITTER = [1 / 60, 1 / 45, 1 / 72, 1 / 60, 1 / 30, 1 / 55, 1 / 66, 1 / 60];
function schedules() {
  const out = [];
  for (const hitch of [0.05, 0.1]) for (let n = 8; n <= 24; n += 2) {
    const dts = []; for (let i = 0; i < n; i++) dts.push(1 / 60); dts.push(hitch);
    out.push({ name: 'hitch' + hitch + '@' + n, dts });
  }
  for (const hz of RATES) out.push({ name: hz + 'Hz', dts: [1 / hz] });
  out.push({ name: 'jitter', dts: JITTER });
  return out;
}
const SCHED = schedules();
let dMax = 0, dyMax = 0, bad4 = 0, n4 = 0;
const combos4 = new Set();
for (const shape of ST.Shapes.list) {
  for (const map of ST.Materials.list) {
    const B = gaugeBand(shape, map);
    for (const spin of [0, 20]) {
      for (const rel of RELS4) {
        for (const k of [0.9, 1.0]) {
          const base = shoot(shape, map, rel[0], rel[1], straight(B.sweet * k), null, spin);
          if (base.outcome === 'none') continue; // 벽에 안 닿는 릴리즈는 비교 대상이 아니다
          for (const sc of SCHED) {
            const r = shoot(shape, map, rel[0], rel[1], straight(B.sweet * k), sc.dts, spin);
            n4++; combos4.add(shape.id + '/' + map.id);
            const dy = Math.hypot(r.x - base.x, r.y - base.y);
            dyMax = Math.max(dyMax, dy);
            if (r.r != null && base.r != null) dMax = Math.max(dMax, Math.abs(r.r - base.r));
            const same = r.outcome === base.outcome && r.contacts === base.contacts
              && r.perfect === base.perfect && dy < 1e-6;
            if (!same) {
              bad4++;
              if (bad4 <= 6) console.log('  차이: ' + shape.id + '/' + map.id + ' rel(' + rel + ') ×' + k + ' spin' + spin
                + ' ' + sc.name + ' → ' + base.outcome + '/' + base.contacts + '/' + base.perfect
                + ' vs ' + r.outcome + '/' + r.contacts + '/' + r.perfect + ' Δpos ' + dy.toFixed(5));
            }
          }
        }
      }
    }
  }
}
verdict(bad4 === 0 && combos4.size === ST.Shapes.list.length * ST.Materials.list.length,
  '스케줄로 결과가 바뀐 케이스 ' + bad4 + '/' + n4 + ' (조합 ' + combos4.size + '/12, 스케줄 ' + SCHED.length + '종) · 최대 Δpos ' + dyMax.toExponential(2) + ' · 최대 |Δr| ' + dMax.toExponential(2));

// ── 검사 5: 저그립 절벽 여유 — sweet 닫힌 해의 판별식이 0 이 되는 grip 과의 거리 ──
console.log('');
console.log('=== 검사 5: 판별식 절벽 여유 (grip 이 이 아래로 가면 sweet 에 근이 없다) ===');
{
  const G = T.GRAVITY * (T.WALL_Z - T.HOLD_Z) / T.KZ;
  const aLo = T.KZ - ST.Sticky.TANGENT_K * T.KY, c = ST.Sticky.TANGENT_K * G;
  const Ccliff = 2 * Math.sqrt(aLo * c);
  for (const shape of ST.Shapes.list) {
    const sumGrip = shape.stickyPoints.reduce((a, p) => a + p.grip, 0);
    const gripCliff = Ccliff * shape.mass / SWEET / (sumGrip * ST.Sticky.K_MAX);
    const row = [];
    for (const map of ST.Materials.list) {
      const B = gaugeBand(shape, map);
      const margin = (map.mat.grip - gripCliff) / map.mat.grip * 100;
      row.push(map.id + ' ' + (B.branch === 'ascending' ? '상승' : margin.toFixed(0) + '%'));
    }
    console.log('  ' + shape.id.padEnd(6) + '절벽 grip ' + gripCliff.toFixed(3) + '   ' + row.join('  '));
  }
}

// ── 게이지 스냅샷: --update 로 tools/sim/gauge-baseline.json 저장, --check 로 비교 ──
// 문서의 sweet/limit/퍼펙트 폭은 이 파일에서 나온다. 검사 3 의 폭이 바뀌면 여기서 걸린다.
{
  const fs = require('fs'), path = require('path');
  const file = path.join(__dirname, 'gauge-baseline.json');
  const mode = process.argv.includes('--update') ? 'update' : process.argv.includes('--check') ? 'check' : null;
  if (mode === 'update') {
    fs.writeFileSync(file, JSON.stringify(g3, null, 2) + '\n');
    console.log('');
    console.log('gauge-baseline.json 갱신.');
  } else if (mode === 'check') {
    const base = JSON.parse(fs.readFileSync(file, 'utf8'));
    const diffs = [];
    const keys = new Set([...Object.keys(base), ...Object.keys(g3)]);
    for (const k of keys) {
      if (!base[k]) { diffs.push(k + ': baseline 에 없음'); continue; }
      if (!g3[k]) { diffs.push(k + ': 현재 결과에 없음'); continue; }
      for (const f of ['sweet', 'limit', 'width', 'intervals']) if (base[k][f] !== g3[k][f]) diffs.push(k + '.' + f + ': baseline ' + base[k][f] + ' / now ' + g3[k][f]);
    }
    for (const s of ST.Shapes.list) for (const m of ST.Materials.list) if (!base[s.id + '/' + m.id]) diffs.push(s.id + '/' + m.id + ': baseline 에 없음');
    console.log('');
    if (diffs.length) { console.log('gauge-baseline.json 과 다르다:'); diffs.forEach((d) => console.log('  ' + d)); fails++; }
    else console.log('gauge-baseline.json 과 일치.');
  }
}

console.log('');
console.log(fails === 0 ? '전부 통과' : 'FAIL ' + fails + '건');
process.exitCode = fails ? 1 : 0;
