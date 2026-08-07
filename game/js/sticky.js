/* 찐득이 토스 - 부착 판정 + 크롤다운 + 필-오프(포인트 순차 분리→진자 스윙→낙하)
 * 부착: 접촉한 각 끈적 포인트 위치의 머테리얼로 개별 연산 (멀티 머테리얼 존 지원)
 *       접착력 = Σ(포인트 grip × 그 위치 머테리얼 grip). 전 포인트 존 밖 = 안 붙음
 * 필-오프: 위쪽 포인트부터 하나씩 "뽁" 분리 → 마지막 포인트 축 진자 스윙 → 낙하
 */
window.ST = window.ST || {};

(function () {
  const K_MAX = 2.1;       // 부착 한계 배율
  const FLIP_DUR = 0.42;   // 끝넘기 회전 시간
  const FLIP_COST = 0.055; // 플립당 그립 소모
  const TOY_R = 0.17;      // 찐득이 반경 (m)
  const SWEET = 0.62;      // 최적 충격 비율
  const PEEL_IV = 0.14;    // 포인트 분리 간격(s)
  const SWING_MAX = 1.05;  // 스윙 지속(s)

  function bell(r) {
    const d = (r - SWEET) / (r < SWEET ? SWEET : 1 - SWEET);
    return Math.max(0, 1 - d * d);
  }

  // 로컬(단위, y아래+) → 회전 적용
  function rotPt(p, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
  }

  // 포인트의 월드 좌표 (벽면. 월드 y는 위+, 로컬 y는 아래+)
  function pointWorld(st, p) {
    const r = rotPt(p, st.angle);
    return { x: st.x + r.x * TOY_R, y: st.y - r.y * TOY_R };
  }

  const Sticky = {
    TOY_R, pointWorld,

    /* 충돌 해석 — 포인트 단위 머테리얼 연산 */
    resolveImpact(impact, shape, map) {
      const speed = Math.hypot(impact.vx, impact.vy, impact.vz);
      const incidence = impact.vz / speed;

      // 기하학적 접촉 후보
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

      // 포인트별 머테리얼: 존 밖 포인트는 그립 0
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

    createStuck(res, impact, shape, map) {
      return {
        shape, map,
        mat: res.mat || map.mat,
        x: impact.x, y: impact.y,
        angle: impact.angle % (Math.PI * 2),
        gh: res.gh, gh0: res.gh,
        t: 0, holdTime: 0,
        phase: 'settle', phaseT: 0,
        contacts: new Set(res.contacts),
        flipFrom: 0, flipDir: Math.random() < 0.5 ? 1 : -1,
        driftX: (impact.spin || 0) * 0.0012,
        wob: 1.0, squash: 1.35,
        mood: 'happy',
        nextFlipIn: (0.6 + map.mat.flipPeriod * 0.5) / shape.decayMod,
        peel: null,
      };
    },

    /* 매 프레임. events: 'flip'|'land'|'slip'|'pop'|'swing'|'fall' */
    update(st, dt) {
      const ev = [];
      st.t += dt;
      st.phaseT += dt;

      st.wob = Math.max(0, st.wob - dt * 2.2);
      st.squash += (1 - st.squash) * Math.min(1, dt * 10);

      // ---- 필-오프 진행 중 ----
      if (st.phase === 'peel') {
        this._updatePeel(st, dt, ev);
        return ev;
      }

      st.holdTime += dt;

      // 현재 위치 머테리얼 (크롤로 존 이동 대응)
      const matNow = ST.Materials.materialAt(st.map, st.x, st.y);
      if (!matNow) {
        // 그립 없는 존으로 크롤해 들어감 → 즉시 필-오프(빠르게)
        this._startPeel(st, ev, 0.06);
        return ev;
      }
      st.mat = matNow;
      const mat = matNow;

      st.gh -= mat.decay * st.shape.decayMod * dt;
      if (mat.slideCont) {
        st.y -= (mat.slideCont / 300) * dt;
        if (Math.random() < dt * 2.2) ev.push('slip');
      }

      st.mood = st.gh > 0.45 ? 'happy' : 'worry';

      if (st.phase === 'settle') {
        if (st.phaseT > 0.5) { st.phase = 'hold'; st.phaseT = 0; }
      } else if (st.phase === 'hold') {
        st.nextFlipIn -= dt;
        if (st.nextFlipIn <= 0) {
          st.phase = 'flip'; st.phaseT = 0;
          st.flipFrom = st.angle;
          st.flipDir = st.driftX >= 0 ? 1 : -1;
          if (Math.abs(st.driftX) < 0.0005) st.flipDir = Math.random() < 0.5 ? 1 : -1;
          ev.push('flip');
        }
      } else if (st.phase === 'flip') {
        const k = Math.min(1, st.phaseT / FLIP_DUR);
        const e = 1 - Math.pow(1 - k, 2.2);
        st.angle = st.flipFrom + Math.PI * st.flipDir * e;
        const step = TOY_R * 1.7 * mat.slideStep;
        st.y -= step * (e - (st._lastE || 0));
        st.x += st.driftX * dt * 60;
        st._lastE = e;
        if (k >= 1) {
          st._lastE = 0;
          st.phase = 'hold'; st.phaseT = 0;
          st.gh -= FLIP_COST * st.shape.decayMod;
          st.wob = 0.8; st.squash = 1.18;
          st.nextFlipIn = (mat.flipPeriod / st.shape.decayMod) * (0.55 + 0.5 * Math.max(0, st.gh));
          ev.push('land');
        }
      }

      // 그립 소진 or 벽 하단 → 필-오프 시작
      const T = ST.Physics.TUNE;
      if (st.gh <= 0 || st.y < T.WALL_BOTTOM + TOY_R * 0.4) {
        this._startPeel(st, ev, st.gh <= 0 ? PEEL_IV : 0.08);
      }
      return ev;
    },

    _startPeel(st, ev, interval) {
      st.phase = 'peel';
      st.phaseT = 0;
      st.mood = 'worry';
      // 남은 접촉 포인트가 없으면 전체 포인트 기준
      let ids = [...st.contacts];
      if (!ids.length) ids = st.shape.stickyPoints.map((p) => p.id);
      const byId = {};
      st.shape.stickyPoints.forEach((p) => { byId[p.id] = p; });
      // 위쪽(월드 y 큰) 포인트부터 분리
      ids.sort((a, b) => pointWorld(st, byId[b]).y - pointWorld(st, byId[a]).y);
      st.peel = {
        order: ids, byId,
        timer: 0.0001, // 첫 팝 거의 즉시
        interval: Math.max(0.05, interval * (ids.length > 5 ? 0.6 : 1)),
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
          if (P.order.length === 1) {
            // 마지막 포인트 = 진자 축
            const pivotP = P.byId[P.order[0]];
            const pw = pointWorld(st, pivotP);
            const dx = st.x - pw.x, dy = st.y - pw.y;
            const L = Math.max(0.06, Math.hypot(dx, dy));
            P.swing = {
              pivot: pw, L,
              a: Math.atan2(dx, -dy), // 0 = 축 바로 아래
              v: (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random()),
            };
            ev.push('swing');
          }
        }
      } else {
        // 감쇠 진자
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
          // 최종 분리 → 낙하 (스윙 속도 이어받음)
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
