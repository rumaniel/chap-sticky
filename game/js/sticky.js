/* 찐득이 토스 - 부착 판정 + 크롤다운(끝넘기 회전 하강)
 * 부착: 충격량 vs (머테리얼 grip × 접촉한 끈적임 포인트 grip 합)
 * 크롤: 그립 체력 감쇠 → 주기적 flip 하강 → 그립 소진/벽 하단 → 낙하
 */
window.ST = window.ST || {};

(function () {
  const K_MAX = 2.1;       // 부착 한계 배율 (adhesion × K_MAX 초과 충격량 = 튕김)
  const FLIP_DUR = 0.42;   // 끝넘기 회전 시간
  const FLIP_COST = 0.055; // 플립당 그립 소모
  const TOY_R = 0.17;      // 찐득이 반경 (m, 벽 위 크기)
  const SWEET = 0.62;      // 최적 충격 비율

  // 품질 곡선: r(충격/한계) — SWEET에서 최대
  function bell(r) {
    const d = (r - SWEET) / (r < SWEET ? SWEET : 1 - SWEET);
    return Math.max(0, 1 - d * d);
  }

  function rotPt(p, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
  }

  const Sticky = {
    TOY_R,

    /* 충돌 해석.
     * impact: {x,y,vx,vy,vz,spin,angle} (월드, 벽 도달 시점)
     * return {stuck, contacts:Set, adhesion, impulse, quality, gh, perfect, reason} */
    resolveImpact(impact, shape, map) {
      const mat = map.mat;
      const speed = Math.hypot(impact.vx, impact.vy, impact.vz);
      const incidence = impact.vz / speed; // 1 = 정면 충돌

      // 접촉 부위: 정면이면 전부, 비스듬하면 진행 방향 쪽 부위만
      const contacts = new Set();
      if (incidence > 0.86) {
        shape.stickyPoints.forEach((p) => contacts.add(p.id));
      } else {
        // 벽면 기준 진행 방향 (화면 좌표: x 우+, y 아래+ / 월드 y는 위+)
        const ld = { x: impact.vx, y: -impact.vy };
        const l = Math.hypot(ld.x, ld.y) || 1;
        ld.x /= l; ld.y /= l;
        shape.stickyPoints.forEach((p) => {
          const rp = rotPt(p, impact.angle);
          if (rp.x * ld.x + rp.y * ld.y > -0.15) contacts.add(p.id);
        });
        if (contacts.size === 0) contacts.add(shape.stickyPoints[0].id);
      }

      let gripSum = 0;
      shape.stickyPoints.forEach((p) => { if (contacts.has(p.id)) gripSum += p.grip; });

      const adhesion = mat.grip * gripSum;
      // 접착엔 법선(vz) 충격이 지배적, 접선 성분은 일부만 기여
      const tangent = Math.hypot(impact.vx, impact.vy);
      const impulse = (impact.vz + 0.35 * tangent) * shape.mass;
      const limit = adhesion * K_MAX;

      if (impulse > limit) {
        return { stuck: false, reason: 'bounce', contacts, adhesion, impulse, speed };
      }

      const r = impulse / limit;
      const q = bell(r);
      // 고속 스핀은 부착엔 불리(대신 커브 보너스)
      const spinPenalty = Math.min(0.25, Math.abs(impact.spin) * 0.006);
      const gh = Math.max(0.15, (0.35 + 0.65 * q) * (1 - spinPenalty));

      return {
        stuck: true, contacts, adhesion, impulse, speed,
        quality: q, gh, perfect: q > 0.9,
      };
    },

    /* 부착 상태 생성 */
    createStuck(res, impact, shape, map) {
      return {
        shape, map,
        x: impact.x, y: impact.y,          // 월드(벽면) 좌표
        angle: impact.angle % (Math.PI * 2),
        gh: res.gh, gh0: res.gh,
        t: 0, holdTime: 0,
        phase: 'settle', phaseT: 0,
        contacts: res.contacts,
        flipFrom: 0, flipDir: Math.random() < 0.5 ? 1 : -1,
        driftX: (impact.spin || 0) * 0.0012, // 잔여 스핀 → 크롤 표류
        wob: 1.0, squash: 1.35,             // 착지 순간 찌부
        mood: 'happy',
        nextFlipIn: (0.6 + map.mat.flipPeriod * 0.5) / shape.decayMod,
      };
    },

    /* 매 프레임 갱신. events 배열 반환: 'flip'|'slip'|'fall' */
    update(st, dt) {
      const mat = st.map.mat;
      const ev = [];
      st.t += dt;
      st.phaseT += dt;
      st.holdTime += dt;

      // 워블/찌부 복원
      st.wob = Math.max(0, st.wob - dt * 2.2);
      st.squash += (1 - st.squash) * Math.min(1, dt * 10);

      // 그립 감쇠 + 연속 미끄러짐
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
          // 끝넘기 시작
          st.phase = 'flip'; st.phaseT = 0;
          st.flipFrom = st.angle;
          st.flipDir = st.driftX >= 0 ? 1 : -1;
          if (Math.abs(st.driftX) < 0.0005) st.flipDir = Math.random() < 0.5 ? 1 : -1;
          ev.push('flip');
        }
      } else if (st.phase === 'flip') {
        const k = Math.min(1, st.phaseT / FLIP_DUR);
        const e = 1 - Math.pow(1 - k, 2.2); // easing
        st.angle = st.flipFrom + Math.PI * st.flipDir * e;
        // 회전하며 하강 + 표류
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

      // 낙하 판정: 그립 소진 or 벽 하단 도달
      const T = ST.Physics.TUNE;
      if (st.gh <= 0 || st.y < T.WALL_BOTTOM + TOY_R * 0.4) {
        st.phase = 'fall';
        st.mood = 'dizzy';
        ev.push('fall');
      }
      return ev;
    },
  };

  ST.Sticky = Sticky;
})();
