/* 찐득이 토스 — 헤드리스 밸런스 시뮬레이터
 *
 * 실제 게임 파일(physics/materials/shapes/sticky/score)을 그대로 로드해 던지기 한 판을
 * 끝까지(던지기 → 비행 → 부착 → 크롤 → 낙하) 돌린다. 게임 코드를 복사하지 않는다 —
 * 복사본은 반드시 원본과 어긋난다.
 *
 * 브라우저에서는 window 가 전역 객체라 `window.ST = ...` 가 전역 `ST` 를 만든다.
 * vm 컨텍스트에서도 컨텍스트 객체 자신을 window 로 묶어 같은 관계를 재현한다.
 *
 * 게이지·퍼펙트 수식은 sticky.js 의 함수(ST.Sticky.gaugeBand 등)를 그대로 쓴다. 여기에
 * 복사본이나 숫자를 적어두면 코드를 고칠 때 조용히 어긋난다. MIN_FLICK 만 input.js 에서
 * 정규식으로 뽑는다 (input.js 는 DOM 의존이라 로드하지 않는다).
 *
 * 난수는 시드 고정이다. 같은 시드 = 같은 숫자. 문서에 수치를 쓸 때는 시드도 같이 적는다.
 *
 * 사용:
 *   node tools/sim/sim.js [횟수]      맵 4종 평균 플레이어 측정
 *   node tools/sim/gauge.js           게이지 밴드 정합성 검사
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.resolve(__dirname, '..', '..', 'game', 'js');
const read = (f) => fs.readFileSync(path.join(GAME, f), 'utf8');

// ---- 시드 난수 (mulberry32) ----
let _seed = 1;
function srand(s) { _seed = s >>> 0; }
function rnd() {
  _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function gauss(mu, sd) {
  const u = Math.max(1e-9, rnd()), v = rnd();
  return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// 게임 내부의 Math.random 도 같은 시드 스트림을 쓰게 한다 (미끄러짐 판정 등).
const SEEDED_MATH = Object.create(Math);
SEEDED_MATH.random = rnd;

const sandbox = {
  console, Math: SEEDED_MATH, JSON, Set, Map, Array, Object, Number, String, Date,
  localStorage: { getItem: () => null, setItem: () => {} },
  requestAnimationFrame: () => {}, setTimeout: () => {},
  performance: { now: () => 0 },
  document: { createElement: () => ({ getContext: () => ({}) }) },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['physics.js', 'materials.js', 'shapes.js', 'sticky.js', 'score.js']) {
  vm.runInContext(read(f), sandbox, { filename: f });
}
const ST = sandbox.ST;
ST.view = { cx: 240, cy: 400 };
// 렌더·사운드·문구는 시뮬에 필요 없다.
ST.Audio = { play: () => {}, sfx: {} };
ST.I18N = { t: (k) => k };
ST.FX = { addShake: () => {}, addHitstop: () => {}, burst: () => {} };
const T = ST.Physics.TUNE;

// MIN_FLICK 은 input.js 에서 정규식으로 뽑는다 (input.js 는 DOM 의존이라 로드하지 않는다).
const MIN_FLICK = (() => {
  const m = read('input.js').match(/const\s+MIN_FLICK\s*=\s*([0-9.]+)/);
  if (!m) throw new Error('input.js 에서 MIN_FLICK 을 못 찾았다');
  return Number(m[1]);
})();
// 게이지·퍼펙트 수식은 게임(sticky.js)의 함수를 그대로 쓴다 — 복사본 없음.
const gaugeBand = (shape, map) => ST.Sticky.gaugeBand(shape, map, MIN_FLICK);
const TANGENT_DIV = ST.Sticky.TANGENT_DIV;

/* ---- 플레이어 모델 ----
 *
 * 세기는 게이지 sweet 마커를 조준한다. 게임이 던지기 세기에 대해 주는 피드백은
 * 게이지뿐이라 "마커를 노리되 스킬만큼 빗나간다" 가 가장 방어 가능한 모델이다.
 * spread 는 sweet 대비 상대 오차 (1.0 = 마커 정확히).
 *
 * 주의: 2026-09-01 까지 쓰던 (미커밋) 하네스는 세기를 절대값 1.05 px/ms 로 고정했다.
 * 당시 게이지 상수(1.20) 기준 맵별 sweet 은 칠판 1.50 / 거실 1.15 / 유리창 0.98 /
 * 냉장고 1.04 라 냉장고만 우연히 일치했고, 그래서 "냉장고만 퍼펙트율 37%" 라는 잘못된
 * 결론이 나왔다. 게임 밸런스가 아니라 모델 아티팩트였다. 그 하네스로 낸 수치는 전부 폐기했다.
 */
const SKILLS = {
  novice: { relY: [610, 55], spread: 0.24, aim: 13, spin: 0.10 },
  avg: { relY: [560, 50], spread: 0.14, aim: 8, spin: 0.28 },
  pro: { relY: [520, 35], spread: 0.07, aim: 4, spin: 0.55 },
};

/* 던지기 한 판. 부착하면 낙하할 때까지 크롤을 끝까지 돌린다. */
function playThrow(shape, map, skill, band) {
  const S = SKILLS[skill];
  const B = band || gaugeBand(shape, map);
  const relY = gauss(S.relY[0], S.relY[1]);
  const relX = gauss(240, 26);
  const speed = Math.max(MIN_FLICK, Math.min(B.max, B.sweet * gauss(1, S.spread)));
  const ang = (gauss(0, S.aim) * Math.PI) / 180;
  const spinVel = rnd() < S.spin ? gauss(0, 14) : 0;

  const hold = ST.Physics.unproject(relX, relY, T.HOLD_Z);
  const f = ST.Physics.makeThrow({ vx: speed * Math.sin(ang), vy: -speed * Math.cos(ang) }, spinVel, hold);

  let hit = null;
  for (let i = 0; i < 900 && !hit; i++) hit = ST.Physics.stepFlight(f, 1 / 60);
  if (!hit || hit.type !== 'wall') return { outcome: hit ? hit.type : 'timeout', score: 0, hold: 0, spots: [] };

  const res = ST.Sticky.resolveImpact(hit, shape, map);
  const ts = ST.Score.beginThrow();
  if (!res.stuck) return { outcome: res.reason, score: 0, hold: 0, spots: [], perfect: false };

  ST.Score.onStick(ts, res, hit, map);
  const st = ST.Sticky.createStuck(res, hit, shape, map);
  let fell = false;
  for (let i = 0; i < 60 * 90 && !fell; i++) {
    const evs = ST.Sticky.update(st, 1 / 60);
    ST.Score.tickHold(ts, st, 1 / 60);
    if (evs && evs.indexOf('fall') >= 0) fell = true;
  }
  ST.Score.finalize(ts);
  return {
    outcome: 'stuck', score: ts.total, hold: ts.holdTime,
    spots: Array.from(ts.spotsHit), perfect: !!res.perfect,
    curve: !!ts.curve, x: st.x, y: st.y,
  };
}

/* 맵 하나를 n 회 돌려 집계. seed 를 고정하므로 결과는 재현된다. */
function measure(shape, map, skill, n, seed) {
  srand(seed == null ? 12345 : seed);
  const acc = {
    stuck: 0, perfect: 0, curve: 0, spotAny: 0,
    per: new Array(map.spots.length).fill(0), score: 0, hold: [], miss: 0,
  };
  for (let i = 0; i < n; i++) {
    const r = playThrow(shape, map, skill);
    acc.score += r.score;
    if (r.outcome !== 'stuck') { acc.miss++; continue; }
    acc.stuck++;
    if (r.perfect) acc.perfect++;
    if (r.curve) acc.curve++;
    acc.hold.push(r.hold);
    if (r.spots.length) acc.spotAny++;
    r.spots.forEach((k) => { acc.per[k]++; });
  }
  acc.hold.sort((a, b) => a - b);
  const pick = (q) => (acc.hold.length ? acc.hold[Math.min(acc.hold.length - 1, Math.floor(acc.hold.length * q))] : 0);
  return {
    n,
    stuckPct: (acc.stuck / n) * 100,
    perfectPct: (acc.perfect / n) * 100,
    curvePct: (acc.curve / n) * 100,
    spotPct: (acc.spotAny / n) * 100,
    perSpot: acc.per.map((c) => (c / n) * 100),
    scorePer: acc.score / n,
    hold50: pick(0.5), hold90: pick(0.9),
    holdMax: acc.hold.length ? acc.hold[acc.hold.length - 1] : 0,
  };
}

module.exports = {
  ST, T, gaugeBand, measure, playThrow, srand, rnd, gauss,
  MIN_FLICK, SKILLS, TANGENT_DIV,
};

if (require.main === module) {
  // 플래그(--update/--check)는 위치 인자에서 뺀다 — 안 빼면 Number('--update') = NaN 이
  // 시드로 들어가 srand(NaN)=0 으로 돌고, 수치가 조용히 달라진다 (실제로 한 번 당했다).
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const N = Number(args[0] || 300);
  const SEED = Number(args[1] || 12345);
  if (!Number.isFinite(N) || !Number.isFinite(SEED)) throw new Error('usage: sim.js [n] [seed] [--update|--check]');
  // --update: 결과를 tools/sim/baseline.json 에 저장 / --check: 저장본과 비교, 다르면 exit 1.
  // 문서의 수치는 이 baseline 에서 나온다 — 물리를 바꾸면 --check 가 먼저 깨지고,
  // --update 로 갱신한 뒤 문서를 고친다. 문서가 조용히 낡는 걸 막는 장치 (R15 리뷰 지적).
  const MODE = process.argv.includes('--update') ? 'update' : process.argv.includes('--check') ? 'check' : null;
  const rows = {}, holds = {};
  console.log('TANGENT_K=' + ST.Sticky.TANGENT_K + ' TANGENT_DIV=' + TANGENT_DIV + ' PERFECT_BASE=' + ST.Sticky.PERFECT_BASE + ' (sticky.js)');
  console.log('시드 ' + SEED + ' · ' + N + '회/맵 · 찐득맨 · 평균 플레이어');
  console.log('');
  console.log('맵      부착률  퍼펙트  커브   스팟률  개별 스팟            버티기p50  최대   점수/던지기');
  for (const map of ST.Materials.list) {
    const r = measure(ST.Shapes.get('man'), map, 'avg', N, SEED);
    rows[map.id] = r;
    console.log(
      map.id.padEnd(7),
      (r.stuckPct.toFixed(1) + '%').padStart(6),
      (r.perfectPct.toFixed(1) + '%').padStart(6),
      (r.curvePct.toFixed(1) + '%').padStart(6),
      (r.spotPct.toFixed(1) + '%').padStart(7),
      '  ' + r.perSpot.map((p) => p.toFixed(1) + '%').join(' / ').padEnd(20),
      (r.hold50.toFixed(1) + 's').padStart(8),
      (r.holdMax.toFixed(1) + 's').padStart(6),
      r.scorePer.toFixed(0).padStart(9),
    );
  }
  console.log('');
  console.log('모형별 버티기 (칠판, 평균 플레이어)');
  console.log('모형    p50     p90     최대');
  for (const shape of ST.Shapes.list) {
    const r = measure(shape, ST.Materials.get('chalk'), 'avg', N, SEED);
    holds[shape.id] = r;
    console.log(
      shape.id.padEnd(7),
      (r.hold50.toFixed(1) + 's').padStart(6),
      (r.hold90.toFixed(1) + 's').padStart(7),
      (r.holdMax.toFixed(1) + 's').padStart(7),
    );
  }

  if (MODE) {
    const f1 = (v) => Number(v.toFixed(1));
    const snap = { seed: SEED, n: N, maps: {}, holds: {} };
    for (const id of Object.keys(rows)) {
      const r = rows[id];
      snap.maps[id] = {
        stuck: f1(r.stuckPct), perfect: f1(r.perfectPct), curve: f1(r.curvePct), spot: f1(r.spotPct),
        perSpot: r.perSpot.map(f1), hold50: f1(r.hold50), holdMax: f1(r.holdMax), score: Math.round(r.scorePer),
      };
    }
    for (const id of Object.keys(holds)) {
      const r = holds[id];
      snap.holds[id] = { p50: f1(r.hold50), p90: f1(r.hold90), max: f1(r.holdMax) };
    }
    const file = path.join(__dirname, 'baseline.json');
    if (MODE === 'update') {
      fs.writeFileSync(file, JSON.stringify(snap, null, 2) + '\n');
      console.log('');
      console.log('baseline.json 갱신. 문서 수치를 이 값으로 맞출 것.');
    } else {
      const base = JSON.parse(fs.readFileSync(file, 'utf8'));
      const diffs = [];
      const walk = (a, b, p) => {
        if (a && typeof a === 'object') { for (const k of Object.keys(a)) walk(a[k], b && b[k], p + '.' + k); }
        else if (a !== b) diffs.push(p + ': baseline ' + a + ' / now ' + b);
      };
      walk(base, snap, '');
      console.log('');
      if (diffs.length) {
        console.log('baseline.json 과 다르다 (' + diffs.length + '곳). 의도한 변경이면 --update 후 문서를 고칠 것:');
        diffs.slice(0, 20).forEach((d) => console.log('  ' + d));
        process.exitCode = 1;
      } else {
        console.log('baseline.json 과 일치.');
      }
    }
  }
}
