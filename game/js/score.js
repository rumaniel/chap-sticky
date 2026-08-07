/* 찐득이 토스 - 점수(버티기 시간×링 배율 + 보너스), 플로터, 리더보드/해금(localStorage) */
window.ST = window.ST || {};

(function () {
  const KEY = 'stickytoss_v1';
  const HOLD_RATE = 15; // 초당 기본 점수

  let store = { board: [], earned: 0, muted: false };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) store = Object.assign(store, JSON.parse(raw));
  } catch (e) { /* localStorage 불가(file:// 일부 브라우저) 시 메모리로만 */ }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 무시 */ }
  }

  // 과녁 월드 좌표 헬퍼
  function ringWorld(map) {
    const T = ST.Physics.TUNE;
    return {
      x: (map.rings.cx - 0.5) * T.WALL_W,
      y: T.WALL_BOTTOM + (1 - map.rings.cy) * T.WALL_H,
      unit: Math.min(T.WALL_W, T.WALL_H),
    };
  }

  function spotWorld(map, sp) {
    const T = ST.Physics.TUNE;
    return {
      x: (sp.x - 0.5) * T.WALL_W,
      y: T.WALL_BOTTOM + (1 - sp.y) * T.WALL_H,
      r: sp.r * Math.min(T.WALL_W, T.WALL_H),
    };
  }

  const floaters = [];

  ST.Score = {
    HOLD_RATE,
    ringWorld, spotWorld,

    ringMult(map, x, y) {
      const rw = ringWorld(map);
      const d = Math.hypot(x - rw.x, y - rw.y);
      const R = map.rings;
      for (let i = 0; i < R.radii.length; i++) {
        if (d < R.radii[i] * rw.unit) return R.mults[i];
      }
      return 0.5; // 링 밖 벽면
    },

    beginThrow() {
      return { throwBonus: 0, holdScore: 0, holdTime: 0, spotsHit: new Set(), bonuses: [] };
    },

    onStick(ts, res, impact, map) {
      if (Math.abs(impact.spin) > 6) {
        const b = Math.round(60 + Math.abs(impact.spin) * 6);
        ts.throwBonus += b;
        ts.bonuses.push({ text: '커브 착! +' + b, color: '#8ad6ff' });
      }
      if (res.perfect) {
        ts.throwBonus += 200;
        ts.bonuses.push({ text: '퍼펙트 착!! +200', color: '#ffe27a' });
      }
    },

    tickHold(ts, st, dt) {
      const mult = this.ringMult(st.map, st.x, st.y);
      ts.holdScore += HOLD_RATE * mult * dt;
      ts.holdTime = st.holdTime;
      // 보너스 스팟 진입
      st.map.spots.forEach((sp, i) => {
        if (ts.spotsHit.has(i)) return;
        const w = spotWorld(st.map, sp);
        if (Math.hypot(st.x - w.x, st.y - w.y) < w.r + ST.Sticky.TOY_R * 0.5) {
          ts.spotsHit.add(i);
          ts.throwBonus += sp.bonus;
          ts.bonuses.push({ text: sp.icon + ' 스팟! +' + sp.bonus, color: '#ffb3f2', live: true });
          ST.Audio.play('spot');
        }
      });
      return mult;
    },

    finalize(ts) {
      ts.total = Math.round(ts.holdScore + ts.throwBonus);
      return ts.total;
    },

    // ---------- 플로터 (화면 좌표 점수 텍스트) ----------
    float(x, y, text, opt) {
      opt = opt || {};
      floaters.push({
        x, y, text,
        color: opt.color || '#fff',
        size: opt.size || 22,
        life: 1, dur: opt.dur || 1.1,
        vy: opt.vy != null ? opt.vy : -55,
      });
    },
    updateFloaters(dt) {
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.life -= dt / f.dur;
        if (f.life <= 0) { floaters.splice(i, 1); continue; }
        f.y += f.vy * dt;
      }
    },
    drawFloaters(ctx) {
      for (const f of floaters) {
        ctx.globalAlpha = Math.min(1, f.life * 2);
        ctx.font = '900 ' + f.size + 'px "Malgun Gothic", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;
    },
    clearFloaters() { floaters.length = 0; },

    // ---------- 리더보드 / 해금 ----------
    addBoard(entry) {
      entry.date = new Date().toISOString().slice(0, 10);
      store.board.push(entry);
      store.board.sort((a, b) => b.score - a.score);
      store.board = store.board.slice(0, 10);
      persist();
      return store.board.indexOf(entry) + 1; // 순위 (0 = 순위권 밖)
    },
    top() { return store.board; },
    addEarned(pts) { store.earned += Math.max(0, Math.round(pts)); persist(); },
    earned() { return store.earned; },
    unlocked(def) { return store.earned >= (def.unlock || 0); },
  };
})();
