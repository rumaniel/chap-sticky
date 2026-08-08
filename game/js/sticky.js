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
  const K_MAX = 2.1;
  const TOY_R = 0.17;
  const SWEET = 0.62;
  const SWING_MAX = 1.05;

  // v2 튜닝 (시뮬로 조정)
  const V2 = {
    PADK: 6.0,          // 패드 감쇠 배율
    LOAD_TOP: 1.2,      // 위쪽 패드 하중 가중
    JUICE0: 0.55, JUICE_Q: 0.75, // 주스 초기치 = JUICE0 + JUICE_Q×품질그립
    JUICE_COST: 0.16,   // 재부착당 주스 소모
    JUICE_VELCOST: 0.03,
    JUICE_WEAK: 0.22,   // 이하로는 재부착 약화
    JUICE_FAIL: 0.09,   // 이하는 재부착 실패
    RESTICK_HP: 1.45,   // 재부착 HP 배율 — 플립 후에도 확실히 버티게
    TOPPLE_RATIO: 0.25, // 지지 HP가 초기 대비 이 비율 미만이면 topple
    TORQUE_STRESS: 1.35,
    ROLL_L: TOY_R * 1.15,
    ROLL_NUDGE: 0.14,   // 초기 기울기(rad)
    ROLL_MINDROP: TOY_R * 0.55, // 롤 1회당 최소 하강 보장 (상승 롤 방지)
    ROLL_MAXPHI: Math.PI * 2.2,
    SETTLE: 0.35,
  };

  function bell(r) {
    const d = (r - SWEET) / (r < SWEET ? SWEET : 1 - SWEET);
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
    TOY_R, V2, pointWorld,

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
      shape.stickyPoints.forEach((p) => {
        if (!geo.has(p.id)) return;
        const w = pointWorld(fake, p);
        const m = ST.Materials.materialAt(map, w.x, w.y);
        if (m) {
          contacts.add(p.id);
          adhesion += p.grip * m.grip;
          if (!centerMat) centerMat = m;
        }
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
      const gh = Math.max(0.15, (0.35 + 0.65 * q) * (1 - spinPenalty));

      return {
        stuck: true, contacts, adhesion, impulse, speed,
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
      // 주스: 던지기 품질이 좋을수록 오래 산다
      st.juiceMax = V2.JUICE0 + V2.JUICE_Q * res.gh;
      st.juice = st.juiceMax;
      st.gh = 1;

      // 패드 초기화: 접촉 패드만 부착, HP = 품질 × 그 위치 머테리얼
      shape.stickyPoints.forEach((p) => {
        const w = pointWorld(st, p);
        const m = ST.Materials.materialAt(map, w.x, w.y);
        const stuck = res.contacts.has(p.id) && !!m;
        // 패드 grip은 부착 판정에서 이미 반영 — HP는 모형 간 정규화(decayMod가 개성 담당)
        const hp = stuck ? Math.min(1.2, (0.55 + 0.7 * res.gh) * m.grip) : 0;
        st.pads.push({ id: p.id, def: p, stuck, hp, hp0: Math.max(0.001, hp) });
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
          p.hp -= m.decay * st.shape.decayMod * share * stress * V2.PADK * dt;
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
        // 마지막 패드 → 진자 스윙 낙하
        this._startPeel(st, ev, 0.05, true);
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
      const dir = st.driftX > 0.0004 ? 1 : st.driftX < -0.0004 ? -1 : (Math.random() < 0.5 ? 1 : -1);
      st.roll = {
        pivot: { x: px, y: py },
        pivotIds: support.map((p) => p.id),
        phi: 0, vel: 0, dir,
        step: st.shape.rollStep || Math.PI,
        y0: st.y, // 하강량 검증 기준
      };
      st.phase = 'roll';
      st.phaseT = 0;
      ev.push('roll');
    },

    _updateRoll(st, dt, ev) {
      const R = st.roll;
      const T = ST.Physics.TUNE;
      // 역진자: 기울수록 가속 (π/2 이후는 관성 유지)
      const acc = (9.8 / V2.ROLL_L) * Math.sin(Math.min(R.phi + V2.ROLL_NUDGE, Math.PI / 2));
      R.vel += acc * dt;
      let d = Math.min(0.3, R.vel * dt); // 프레임당 회전 상한(안정성)
      R.phi += d;

      // 피벗 중심 실제 회전 → 하강이 물리로 발생
      const a = d * R.dir;
      const c = Math.cos(a), s = Math.sin(a);
      const dx = st.x - R.pivot.x, dy = st.y - R.pivot.y;
      st.x = R.pivot.x + dx * c - dy * s;
      st.y = R.pivot.y + dx * s + dy * c;
      st.angle += a;
      st.x += st.driftX * dt * 30;

      // 완료 조건: 규정 스텝 + 최소 하강 달성 (안 내려갔으면 계속 굴러감 — 상승 롤 방지)
      const dropped = R.y0 - st.y >= V2.ROLL_MINDROP;
      if ((R.phi >= R.step - 1e-6 && dropped) || R.phi >= V2.ROLL_MAXPHI) {
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
            let hp = st.juice * V2.RESTICK_HP * m.grip * (0.85 + Math.random() * 0.3);
            if (st.juice < V2.JUICE_WEAK) hp *= 0.45;
            p.stuck = true;
            p.hp = Math.min(1.2, hp);
            p.hp0 = Math.max(0.001, p.hp);
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
        st.angle += S.a - prev;
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
