/* 찹! 찐득이 - 부착/크롤 물리 v2 (그립 주도)
 *
 * 부착: 접촉한 각 끈적 패드 위치의 머테리얼로 개별 연산 (멀티 머테리얼 존)
 * 크롤 v2:
 *  - 패드별 그립 HP: 하중 분배(무게중심 위 패드 = 장력 집중)에 따라 개별 감쇠
 *  - 지지 패드 소진 → "뽁" 분리 → 남은 지지가 무게중심 아래면 토크로 끝-넘기 롤
 *    (역진자: 천천히 기울다 가속 — 피벗 중심 실제 회전으로 하강이 물리적으로 발생)
 *  - 롤 완료 시 반대편 패드 재부착: 새 HP = 찐득 주스 × 그 위치 머테리얼
 *    주스는 재부착마다 감소 → 결국 반드시 낙하
 *  - 지지가 위쪽뿐(매달림)이면 롤 없이 버티다 패드가 하나씩 죽고,
 *    마지막 패드는 진자 스윙 → 낙하 (필-오프)
 *  - 노그립 존: 그 위치 패드는 재부착 실패 → 비대칭 크롤/조기 낙하
 */
window.ST = window.ST || {};

(function () {
  const K_MAX = 2.45;      // 튕김 한계 — 첫 경험 관대하게
  const TOY_R = 0.17;
  const SWEET = 0.62;
  const SWEET_HARD = 0.55; // 과속 쪽 품질 하락 완만화 (기존 1-SWEET=0.38)
  const SWING_MAX = 1.05;

  // v2 튜닝 (시뮬로 조정)
  const V2 = {
    PADK: 6.0,          // 패드 감쇠 배율
    LOAD_TOP: 0.85,     // 위쪽 패드 하중 가중 (대체로 위부터 벗겨지되 예외 허용)
    // 주스 = 크롤 수명. 품질 비중을 키워 "잘 던지면 바닥까지 라이드" 가능하게
    JUICE0: 0.45, JUICE_Q: 1.0,  // 초기치 = JUICE0 + JUICE_Q×품질그립
    JUICE_COST: 0.11,   // 재부착당 주스 소모 (롤 상한 ~6-8회)
    JUICE_VELCOST: 0.02,
    JUICE_WEAK: 0.22,   // 이하로는 재부착 약화
    JUICE_FAIL: 0.09,   // 이하는 재부착 실패
    RESTICK_HP: 1.45,   // 재부착 HP 배율 — 플립 후에도 확실히 버티게
    TOPPLE_RATIO: 0.35, // 지지 HP가 초기 대비 이 비율 미만이면 topple (빠른 템포)
    TORQUE_STRESS: 1.35,
    ROLL_L: TOY_R * 1.15,
    ROLL_NUDGE: 0.14,   // 초기 기울기(rad)
    ROLL_CONTACT: TOY_R * 0.75, // 재접촉 판정 깊이 — 완전한 끝넘기(~π)와 회당 ~0.28m 하강
    ROLL_MAXPHI: Math.PI * 1.5,
    SETTLE: 0.35,
    // 크롤 다이나믹스 — 던지기 개성이 크롤 서사로 이어지게
    GEO_ALIGN: 0.22,    // 접선 진행 방향 쪽 패드 눌림(강) / 반대쪽 스침(약) 계수
    GEO_SPIN: 0.14,     // 커브 스핀 쪽 사이드 비틀림 약화 계수
    JIT_BASE: 0.15,     // 패드 HP 지터 최소폭 (퍼펙트 부착 ±15% — 롱라이드 꼬리 유지)
    JIT_Q: 0.18,        // 품질 나쁠수록 지터 확대 (최대 ±33%) — 대충 붙으면 카오스
    SLIP_RATE: 0.35,    // 저품질 미끄덩 기본 확률/s (×(1-q)×경과 가중)
    // 롤 방향 확률 샘플링 — 한쪽 고정 방지, 지그재그 라이드
    ROLL_MOMENTUM: 0.12,   // 직전 롤 방향 관성 가중
    ROLL_HP_BIAS: 0.25,    // 좌우 잔여 HP 비대칭 가중 (약한 쪽으로)
    CURVE_BIAS: 30,        // driftX → 방향 가중 환산 (커브 초반 지배)
    CURVE_ROLL_DECAY: 0.55, // 롤 한 번마다 커브 편향 감쇠 (1~2롤 후 자유)
  };

  function bell(r) {
    const d = (r - SWEET) / (r < SWEET ? SWEET : SWEET_HARD);
    return Math.max(0, 1 - d * d);
  }

  function rotPt(p, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
  }

  // 패드 월드 좌표 (로컬 y아래+ → 월드 y위+)
  function pointWorld(st, p) {
    const r = rotPt(p, st.angle);
    return { x: st.x + r.x * TOY_R, y: st.y - r.y * TOY_R };
  }

  const Sticky = {
    TOY_R, V2, pointWorld, K_MAX, SWEET,

    /* ---------------- 충돌 해석 (포인트 단위 머테리얼) ---------------- */
    resolveImpact(impact, shape, map) {
      const speed = Math.hypot(impact.vx, impact.vy, impact.vz);
      const incidence = impact.vz / speed;

      const geo = new Set();
      if (incidence > 0.86) {
        shape.stickyPoints.forEach((p) => geo.add(p.id));
      } else {
        const ld = { x: impact.vx, y: -impact.vy };
        const l = Math.hypot(ld.x, ld.y) || 1;
        ld.x /= l; ld.y /= l;
        shape.stickyPoints.forEach((p) => {
          const rp = rotPt(p, impact.angle);
          if (rp.x * ld.x + rp.y * ld.y > -0.15) geo.add(p.id);
        });
        if (geo.size === 0) geo.add(shape.stickyPoints[0].id);
      }

      const fake = { x: impact.x, y: impact.y, angle: impact.angle };
      const contacts = new Set();
      let adhesion = 0;
      let centerMat = ST.Materials.materialAt(map, impact.x, impact.y);
      const wpos = {};
      shape.stickyPoints.forEach((p) => {
        if (!geo.has(p.id)) return;
        const w = pointWorld(fake, p);
        const m = ST.Materials.materialAt(map, w.x, w.y);
        if (m) {
          contacts.add(p.id);
          adhesion += p.grip * m.grip;
          wpos[p.id] = w;
          if (!centerMat) centerMat = m;
        }
      });

      // 충격 기하 → 패드별 초기 HP 계수 (결정론적): 가로 미끄러짐 진행 쪽 = 눌림(강),
      // 반대쪽 = 스침(약), 커브 스핀 도는 쪽 사이드 = 비틀림(약).
      // 수직 성분은 제외 — 모든 던지기가 위로 스치므로 넣으면 아래 패드 상시 약화 편향.
      // 가로·스핀은 조준·커브에 따라 던지기마다 달라져 "어느 패드부터 죽는지"가 매판 바뀐다.
      const geoF = {};
      const tvx = impact.vx;
      const sp = impact.spin || 0;
      const spN = Math.min(1, Math.abs(sp) / 18);
      contacts.forEach((id) => {
        const w = wpos[id];
        const dx = w.x - impact.x;
        const dmag = Math.hypot(dx, w.y - impact.y) || 1;
        let f = 1;
        if (Math.abs(tvx) > 0.25) {
          f += V2.GEO_ALIGN * (dx / dmag) * Math.sign(tvx) * Math.min(1, Math.abs(tvx) / 1.5);
        }
        if (spN > 0.15 && Math.abs(dx) > 0.02) {
          f -= V2.GEO_SPIN * spN * (Math.sign(dx) === Math.sign(sp) ? 1 : -0.3);
        }
        geoF[id] = Math.max(0.72, Math.min(1.28, f));
      });

      if (contacts.size === 0 || adhesion < 0.3) {
        return { stuck: false, reason: 'nogrip', contacts: geo, speed };
      }

      const tangent = Math.hypot(impact.vx, impact.vy);
      const impulse = (impact.vz + 0.35 * tangent) * shape.mass;
      const limit = adhesion * K_MAX;

      if (impulse > limit) {
        return { stuck: false, reason: 'bounce', contacts, adhesion, impulse, speed };
      }

      const r = impulse / limit;
      const q = bell(r);
      const spinPenalty = Math.min(0.25, Math.abs(impact.spin) * 0.006);
      const gh = Math.max(0.15, (0.42 + 0.58 * q) * (1 - spinPenalty));

      return {
        stuck: true, contacts, adhesion, impulse, speed, geoF,
        quality: q, gh, perfect: q > 0.9, mat: centerMat || map.mat,
      };
    },

    /* ---------------- 부착 상태 생성 (v2: 패드 HP + 주스) ---------------- */
    createStuck(res, impact, shape, map) {
      const st = {
        shape, map,
        mat: res.mat || map.mat,
        x: impact.x, y: impact.y,
        angle: impact.angle % (Math.PI * 2),
        t: 0, holdTime: 0,
        phase: 'settle', phaseT: 0,
        driftX: (impact.spin || 0) * 0.0012,
        wob: 1.0, squash: 1.35,
        mood: 'happy',
        peel: null, roll: null,
        contacts: new Set(),
        pads: [],
      };
      st.q = res.quality != null ? res.quality : 0.5;

      // 주스: 던지기 품질이 좋을수록 오래 산다 (개체 랜덤 — 품질 나쁠수록 폭 확대)
      // shape.juiceMod: 모형별 라이드 여력 보정 (별 = 데굴이 정체성 유지)
      const jm = 0.05 + 0.10 * (1 - st.q);
      st.juiceMax = (V2.JUICE0 + V2.JUICE_Q * res.gh) * (shape.juiceMod || 1) * (1 - jm + Math.random() * 2 * jm);
      st.juice = st.juiceMax;
      st.gh = 1;

      // 패드 초기화: HP = 품질 × 그 위치 머테리얼 × 충격 기하 계수(geoF) × 지터.
      // 지터 폭은 품질 연동(퍼펙트 ±10% ~ 슬로피 ±30%) — 잘 붙으면 안정, 대충이면 카오스
      const jAmp = V2.JIT_BASE + V2.JIT_Q * (1 - st.q);
      const rjAmp = jAmp * 0.9;
      shape.stickyPoints.forEach((p) => {
        const w = pointWorld(st, p);
        const m = ST.Materials.materialAt(map, w.x, w.y);
        const stuck = res.contacts.has(p.id) && !!m;
        const gf = (res.geoF && res.geoF[p.id]) || 1;
        const jitter = 1 - jAmp + Math.random() * 2 * jAmp;
        // 캡은 베이스에만 — 지터·기하 계수까지 뭉개면 패드 분산이 사라진다 (경향성 원인)
        const hp = stuck ? Math.min(1.2, (0.55 + 0.7 * res.gh) * m.grip) * gf * jitter : 0;
        st.pads.push({
          id: p.id, def: p, stuck, hp, hp0: Math.max(0.001, hp),
          rj: 1 - rjAmp + Math.random() * 2 * rjAmp,
        });
        if (stuck) st.contacts.add(p.id);
      });
      return st;
    },

    stuckPads(st) { return st.pads.filter((p) => p.stuck); },

    // 렌더용: 부착 패드 (약한 패드는 깜빡)
    displayContacts(st, time) {
      const out = new Set();
      for (const p of st.pads) {
        if (!p.stuck) continue;
        if (p.hp > 0.3 || Math.sin(time * 14 + p.id.length) > -0.2) out.add(p.id);
      }
      return out;
    },

    /* ---------------- 매 프레임 갱신 ---------------- */
    update(st, dt) {
      const ev = [];
      st.t += dt;
      st.phaseT += dt;

      st.wob = Math.max(0, st.wob - dt * 2.2);
      st.squash += (1 - st.squash) * Math.min(1, dt * 10);
      st.gh = Math.max(0, st.juice / st.juiceMax);

      if (st.phase === 'peel') {
        this._updatePeel(st, dt, ev);
        return ev;
      }

      st.holdTime += dt;
      const T = ST.Physics.TUNE;

      if (st.phase === 'settle') {
        if (st.phaseT > V2.SETTLE) { st.phase = 'hold'; st.phaseT = 0; }
        return ev;
      }

      if (st.phase === 'roll') {
        this._updateRoll(st, dt, ev);
        return ev;
      }

      // ---------- hold: 패드 하중 감쇠 ----------
      const matC = ST.Materials.materialAt(st.map, st.x, st.y);
      if (matC) st.mat = matC;
      const mat = st.mat;

      // 연속 미끄러짐 (유리)
      if (mat.slideCont) {
        st.y -= (mat.slideCont / 300) * dt;
        if (Math.random() < dt * 2.2) ev.push('slip');
      } else {
        // 저품질 미끄덩: 대충 붙은 부착은 가끔 찔끔 미끄러진다.
        // 확률 ∝ (1-품질)×경과 — 이산 사건이라 매판 다른 전개로 읽힌다
        const prog = Math.min(1, st.holdTime / 6);
        if (Math.random() < dt * V2.SLIP_RATE * (1 - (st.q || 0.5)) * (0.25 + 0.75 * prog)) {
          st.y -= 0.03 + Math.random() * 0.03;
          st.wob = Math.min(1, st.wob + 0.5);
          st.squash = 1.12;
          ev.push('slip');
        }
      }

      const stuck = this.stuckPads(st);
      // 스탠스 분류: 위/아래 지지 여부 → 안정(둘 다) / 매달림(위만) / 토크 버팀(아래만)
      let hasAbove = false, hasBelow = false;
      stuck.forEach((p) => {
        const wy = pointWorld(st, p.def).y;
        if (wy > st.y + 0.01) hasAbove = true;
        else if (wy < st.y - 0.01) hasBelow = true;
      });
      const belowOnly = hasBelow && !hasAbove;
      if (stuck.length) {
        // 하중 분배: 무게중심보다 위(장력) 패드가 더 소모.
        // 아래만 지지 = 넘어지려는 토크를 그립이 버팀 → 추가 스트레스
        const stress = belowOnly ? V2.TORQUE_STRESS : 1.0;
        let wsum = 0;
        const ws = stuck.map((p) => {
          const w = pointWorld(st, p.def);
          const hi = (w.y - st.y) / TOY_R; // +위
          const load = 1 + V2.LOAD_TOP * Math.max(0, hi);
          wsum += load;
          return { p, load, wpos: w };
        });
        for (const { p, load, wpos } of ws) {
          const m = ST.Materials.materialAt(st.map, wpos.x, wpos.y);
          if (!m) { p.hp = 0; continue; } // 크롤로 노그립 존 진입
          const share = (load / wsum) * stuck.length; // 평균 1
          p.hp -= m.decay * st.shape.decayMod * share * stress * V2.PADK * (p.rj || 1) * dt;
        }
      }

      // 죽은 패드 정리
      for (const p of st.pads) {
        if (p.stuck && p.hp <= 0) {
          p.stuck = false;
          st.contacts.delete(p.id);
          st.wob = Math.min(1, st.wob + 0.45);
          const w = pointWorld(st, p.def);
          ev.push({ type: 'pop', x: w.x, y: w.y });
        }
      }

      const left = this.stuckPads(st);
      st.mood = st.juice / st.juiceMax > 0.45 ? 'happy' : 'worry';

      if (left.length === 0) {
        ev.push('fall');
        st.fallKick = { vx: st.driftX * 20, vy: 0.1, rotV: (Math.random() < 0.5 ? -1 : 1) * 3 };
        return ev;
      }

      if (left.length === 1) {
        // 마지막 패드: 아래 지지면 1점 topple 롤로 체인 연장 (바닥 라이드 핵심),
        // 위에 매달린 상태면 진자 스윙 낙하
        const wy = pointWorld(st, left[0].def).y;
        if (wy < st.y - 0.01 && st.juice > V2.JUICE_FAIL) {
          if (left[0].hp / left[0].hp0 < V2.TOPPLE_RATIO) this._startRoll(st, ev, left);
        } else {
          this._startPeel(st, ev, 0.05, true);
        }
        return ev;
      }

      // 아래만 지지: 그립이 topple 토크를 버티다 소진(32% 미만) → 끝-넘기 롤
      let above2 = false, below2 = false;
      left.forEach((p) => {
        const wy = pointWorld(st, p.def).y;
        if (wy > st.y + 0.01) above2 = true;
        else if (wy < st.y - 0.01) below2 = true;
      });
      if (below2 && !above2) {
        const minRatio = Math.min(...left.map((p) => p.hp / p.hp0));
        if (minRatio < V2.TOPPLE_RATIO) {
          this._startRoll(st, ev, left);
          return ev;
        }
      }

      // 벽 하단/노그립 중심 → 필-오프
      if (st.y < T.WALL_BOTTOM + TOY_R * 0.4) {
        this._startPeel(st, ev, 0.07);
      } else if (!matC) {
        this._startPeel(st, ev, 0.06);
      }
      return ev;
    },

    /* ---------------- 토크 롤 (끝-넘기) ---------------- */
    _startRoll(st, ev, support) {
      let px = 0, py = 0;
      support.forEach((p) => { const w = pointWorld(st, p.def); px += w.x; py += w.y; });
      px /= support.length; py /= support.length;
      // 방향: 매 롤 확률 샘플링 — 커브 편향(롤마다 감쇠) + 좌우 HP 비대칭(약한 쪽)
      // + 직전 방향 관성. 클램프 [0.15,0.85]라 한쪽 영구 고정이 없고 지그재그가 나온다.
      let bias = Math.max(-0.35, Math.min(0.35, st.driftX * V2.CURVE_BIAS));
      let lh = 0, rh = 0;
      support.forEach((p) => {
        const w = pointWorld(st, p.def);
        if (w.x < st.x - 0.01) lh += p.hp;
        else if (w.x > st.x + 0.01) rh += p.hp;
      });
      const tot = lh + rh;
      if (tot > 0.01) bias += ((lh - rh) / tot) * V2.ROLL_HP_BIAS; // 약한 쪽(-작은 합)으로
      if (st.lastRollDir) bias += st.lastRollDir * V2.ROLL_MOMENTUM;
      const pRight = Math.max(0.15, Math.min(0.85, 0.5 + bias));
      const dir = Math.random() < pRight ? 1 : -1;
      st.lastRollDir = dir;
      st.driftX *= V2.CURVE_ROLL_DECAY; // 커브 지배력은 초반 1~2롤로 제한
      st.roll = {
        pivot: { x: px, y: py },
        pivotIds: support.map((p) => p.id),
        phi: 0, vel: Math.random() * 0.6, dir,
        step: st.shape.rollStep || Math.PI,
      };
      st.phase = 'roll';
      st.phaseT = 0;
      ev.push('roll');
    },

    _updateRoll(st, dt, ev) {
      const R = st.roll;
      const T = ST.Physics.TUNE;
      // 역진자: 기울수록 가속 (π/2 이후는 관성 유지)
      if (R.nudge == null) R.nudge = V2.ROLL_NUDGE * (0.7 + Math.random() * 0.7);
      const acc = (9.8 / V2.ROLL_L) * Math.sin(Math.min(R.phi + R.nudge, Math.PI / 2));
      R.vel += acc * dt;
      let d = Math.min(0.3, R.vel * dt); // 프레임당 회전 상한(안정성)
      R.phi += d;

      // 피벗 중심 실제 회전 → 하강이 물리로 발생
      // 주의: 바디 각도는 화면(y아래+) 기준 시계방향이 +. 월드(y위+)에서 같은 회전은
      // 수학적 음의 방향이므로 궤도는 -a 로 돌려야 몸통과 궤도가 일치한다.
      const a = d * R.dir;
      const c = Math.cos(a), s = Math.sin(a);
      const dx = st.x - R.pivot.x, dy = st.y - R.pivot.y;
      st.x = R.pivot.x + dx * c + dy * s;
      st.y = R.pivot.y - dx * s + dy * c;
      st.angle += a;
      st.x += st.driftX * dt * 30;

      // 완료 = 완전한 topple: 규정 스텝을 돌고 무게중심이 피벗 아래로 넘어간 순간 착지.
      // 중심이 피벗 위에 있는 동안은 계속 굴러감 → 상승 궤도 불가 + 회당 하강 극대화.
      const relX = st.x - R.pivot.x, relY = st.y - R.pivot.y;
      const relL = Math.hypot(relX, relY) || 0.01;
      let complete = R.phi >= V2.ROLL_MAXPHI ||
        (R.phi >= (R.step || Math.PI) && relY < -0.35 * relL);
      if (complete) {
        // 롤 완료: 피벗 패드 해제, 새 아래쪽 패드 재부착 시도
        const vel = R.vel;
        st.pads.forEach((p) => {
          if (R.pivotIds.includes(p.id)) { p.stuck = false; p.hp = 0; st.contacts.delete(p.id); }
        });
        ev.push('slip');

        st.juice -= V2.JUICE_COST + V2.JUICE_VELCOST * vel;
        let candidates = st.pads.filter((p) => !p.stuck && rotPt(p.def, st.angle).y > 0.2);
        if (!candidates.length) {
          candidates = st.pads.slice().sort((a2, b2) => rotPt(b2.def, st.angle).y - rotPt(a2.def, st.angle).y).slice(0, 2);
        }
        let stickN = 0;
        if (st.juice > V2.JUICE_FAIL) {
          for (const p of candidates) {
            const w = pointWorld(st, p.def);
            const m = ST.Materials.materialAt(st.map, w.x, w.y);
            if (!m) continue;
            let hp = st.juice * V2.RESTICK_HP * m.grip * (0.78 + Math.random() * 0.5);
            if (st.juice < V2.JUICE_WEAK) hp *= 0.45;
            p.stuck = true;
            p.hp = Math.min(1.2, hp);
            p.hp0 = Math.max(0.001, p.hp);
            p.rj = 0.86 + Math.random() * 0.28;
            st.contacts.add(p.id);
            stickN++;
          }
        }
        st.roll = null;

        if (!stickN) {
          ev.push('fall');
          st.fallKick = { vx: st.driftX * 25, vy: -0.15, rotV: vel * R.dir * 0.7 };
          return;
        }
        st.phase = 'hold';
        st.phaseT = 0;
        st.wob = 0.85;
        st.squash = 1.16;
        ev.push('land');
        // 착지 직후 하단/노그립 즉시 판정
        const T2 = ST.Physics.TUNE;
        if (st.y < T2.WALL_BOTTOM + TOY_R * 0.4) this._startPeel(st, ev, 0.07);
      }
    },

    /* ---------------- 필-오프 (순차 분리 → 진자) ---------------- */
    _startPeel(st, ev, interval, swingOnly) {
      st.phase = 'peel';
      st.phaseT = 0;
      st.mood = 'worry';
      let ids = [...st.contacts];
      if (!ids.length) ids = st.pads.filter((p) => p.hp > 0).map((p) => p.id);
      if (!ids.length) ids = [st.pads[0].id];
      const byId = {};
      st.shape.stickyPoints.forEach((p) => { byId[p.id] = p; });
      ids.sort((a, b) => pointWorld(st, byId[b]).y - pointWorld(st, byId[a]).y);
      if (swingOnly) ids = ids.slice(-1);
      st.peel = {
        order: ids, byId,
        timer: 0.0001,
        interval: Math.max(0.05, (interval || 0.14) * (ids.length > 5 ? 0.6 : 1)),
        swing: null, swingT: 0,
      };
      st.contacts = new Set(ids);
      ev.push('peelstart');
    },

    _updatePeel(st, dt, ev) {
      const P = st.peel;

      if (!P.swing) {
        P.timer -= dt;
        if (P.timer <= 0) {
          if (P.order.length > 1) {
            const id = P.order.shift();
            const pw = pointWorld(st, P.byId[id]);
            st.contacts.delete(id);
            st.wob = Math.min(1, st.wob + 0.5);
            P.timer = P.interval;
            ev.push({ type: 'pop', x: pw.x, y: pw.y });
          }
          if (P.order.length === 1 && !P.swing) {
            const pivotP = P.byId[P.order[0]];
            const pw = pointWorld(st, pivotP);
            const dx = st.x - pw.x, dy = st.y - pw.y;
            const L = Math.max(0.06, Math.hypot(dx, dy));
            P.swing = {
              pivot: pw, L,
              a: Math.atan2(dx, -dy),
              v: (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random()),
            };
            ev.push('swing');
          }
        }
      } else {
        const S = P.swing;
        P.swingT += dt;
        const acc = -(9.8 / S.L) * Math.sin(S.a) - 1.6 * S.v;
        S.v += acc * dt;
        const prev = S.a;
        S.a += S.v * dt;
        st.angle -= S.a - prev; // 화면 좌표계(y아래+)에선 반대 부호
        st.x = S.pivot.x + Math.sin(S.a) * S.L;
        st.y = S.pivot.y - Math.cos(S.a) * S.L;
        if (P.swingT > SWING_MAX) {
          st.contacts.clear();
          ev.push('fall');
          st.fallKick = {
            vx: S.v * S.L * Math.cos(S.a),
            vy: S.v * S.L * Math.sin(S.a) * 0.5,
            rotV: S.v * 1.2,
          };
        }
      }
    },
  };

  ST.Sticky = Sticky;
})();
