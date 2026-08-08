/* 찐득이 토스 - 모형(Shape) 레지스트리
 * 좌표계: 로컬 단위 좌표 -1..1 (x 오른쪽 +, y 아래 +)
 * stickyPoints: 끈적임 부위 — 부착 판정·크롤다운 피벗에 사용
 */
window.ST = window.ST || {};

(function () {
  // 공용 드로잉 헬퍼 -------------------------------------------------
  function capsule(ctx, x1, y1, x2, y2, w) {
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineWidth = w;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function blob(ctx, x, y, r, fill) {
    ctx.beginPath();
    ctx.fillStyle = fill;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function face(ctx, x, y, s, mood) {
    ctx.fillStyle = '#233';
    // 눈
    if (mood === 'dizzy') {
      ctx.strokeStyle = '#233';
      ctx.lineWidth = s * 0.06;
      const ex = s * 0.13;
      [[-s * 0.14, 0], [s * 0.14, 0]].forEach(([dx]) => {
        ctx.beginPath();
        ctx.moveTo(x + dx - ex / 2, y - ex / 2); ctx.lineTo(x + dx + ex / 2, y + ex / 2);
        ctx.moveTo(x + dx + ex / 2, y - ex / 2); ctx.lineTo(x + dx - ex / 2, y + ex / 2);
        ctx.stroke();
      });
    } else {
      blob(ctx, x - s * 0.14, y, s * (mood === 'worry' ? 0.07 : 0.055), '#233');
      blob(ctx, x + s * 0.14, y, s * (mood === 'worry' ? 0.07 : 0.055), '#233');
    }
    // 입
    ctx.strokeStyle = '#233';
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    if (mood === 'happy') {
      ctx.arc(x, y + s * 0.1, s * 0.13, 0.15 * Math.PI, 0.85 * Math.PI);
    } else if (mood === 'worry') {
      ctx.arc(x, y + s * 0.26, s * 0.1, 1.2 * Math.PI, 1.8 * Math.PI);
    } else if (mood === 'dizzy') {
      ctx.arc(x, y + s * 0.16, s * 0.07, 0, Math.PI * 2);
    } else { // excited
      ctx.arc(x, y + s * 0.12, s * 0.11, 0, Math.PI);
      ctx.fillStyle = '#e8556f';
      ctx.fill();
    }
    ctx.stroke();
  }

  function gloss(ctx, x, y, rx, ry, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || -0.5);
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 끈적 부위 강조(부착 중 글로우)
  function stickyGlow(ctx, pt, S, on) {
    if (!on) return;
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,240,120,0.5)';
    ctx.arc(pt.x * S, pt.y * S, S * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }

  /* opt: { wob:0..1 흔들림, t:시간, squash:1(1=원형), mood, contacts:Set(부착중 부위 id) } */
  const SHAPES = {

    // ============ 찐득맨 (기본) ============
    man: {
      id: 'man', name: '찐득맨', desc: '양손·양발이 끈적', unlock: 0,
      mass: 1.0, decayMod: 1.0, radius: 0.95, rollStep: Math.PI,
      color: '#7ed957', dark: '#48a53c', light: '#c7f77a',
      stickyPoints: [
        { id: 'lh', x: -0.92, y: -0.50, grip: 1.0 },
        { id: 'rh', x: 0.92, y: -0.50, grip: 1.0 },
        { id: 'lf', x: -0.50, y: 0.92, grip: 1.0 },
        { id: 'rf', x: 0.50, y: 0.92, grip: 1.0 },
      ],
      draw(ctx, S, opt) {
        opt = opt || {};
        const wob = opt.wob || 0, t = opt.t || 0, sq = opt.squash || 1;
        const contacts = opt.contacts;
        ctx.save();
        ctx.scale(1 / sq, sq);
        const sway = (ph) => Math.sin(t * 16 + ph) * wob * S * 0.10;

        // 끈적 부위 좌표(흔들림 적용)
        const P = {};
        this.stickyPoints.forEach((p, i) => {
          P[p.id] = { x: p.x * S + sway(i * 2.1), y: p.y * S + sway(i * 2.1 + 1.3) * 0.6 };
        });

        ctx.strokeStyle = this.color;
        // 팔 (어깨→손)
        capsule(ctx, -0.30 * S, -0.18 * S, P.lh.x, P.lh.y, S * 0.24);
        capsule(ctx, 0.30 * S, -0.18 * S, P.rh.x, P.rh.y, S * 0.24);
        // 다리 (골반→발)
        capsule(ctx, -0.18 * S, 0.38 * S, P.lf.x, P.lf.y, S * 0.26);
        capsule(ctx, 0.18 * S, 0.38 * S, P.rf.x, P.rf.y, S * 0.26);

        // 몸통
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.ellipse(0, 0.06 * S, 0.40 * S, 0.50 * S, 0, 0, Math.PI * 2);
        ctx.fill();

        // 머리
        const hy = -0.58 * S + sway(9) * 0.5;
        blob(ctx, 0, hy, 0.33 * S, this.color);
        gloss(ctx, -0.10 * S, hy - 0.12 * S, 0.12 * S, 0.06 * S);
        gloss(ctx, -0.12 * S, -0.08 * S, 0.14 * S, 0.08 * S);

        // 손발 블롭 + 끈적 글로우
        this.stickyPoints.forEach((p) => {
          stickyGlow(ctx, { x: P[p.id].x / S, y: P[p.id].y / S }, S, contacts && contacts.has(p.id));
          blob(ctx, P[p.id].x, P[p.id].y, S * 0.17, this.light);
        });

        face(ctx, 0, hy, S * 0.7, opt.mood || 'happy');
        ctx.restore();
      },
    },

    // ============ 문어 ============
    octo: {
      id: 'octo', name: '문어찐득', desc: '다리 끝 8곳이 끈적', unlock: 5000,
      mass: 1.1, decayMod: 0.85, radius: 0.95, rollStep: Math.PI / 2,
      color: '#e88ac8', dark: '#b45a99', light: '#ffc6ec',
      stickyPoints: (function () {
        // 전방위 방사형 8다리 — 어느 방향으로 굴러도 다음 다리가 벽에 닿는다
        const pts = [];
        for (let i = 0; i < 8; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 4;
          const r = i % 2 ? 0.92 : 0.78;
          pts.push({ id: 't' + i, x: Math.cos(a) * r, y: Math.sin(a) * r, grip: 0.55 });
        }
        return pts;
      })(),
      draw(ctx, S, opt) {
        opt = opt || {};
        const wob = opt.wob || 0, t = opt.t || 0, sq = opt.squash || 1;
        const contacts = opt.contacts;
        ctx.save();
        ctx.scale(1 / sq, sq);
        const sway = (ph) => Math.sin(t * 14 + ph) * wob * S * 0.12;

        ctx.strokeStyle = this.color;
        this.stickyPoints.forEach((p, i) => {
          const tx = p.x * S + sway(i * 1.7), ty = p.y * S + sway(i * 1.7 + 2) * 0.6;
          // 중심에서 방사형 곡선 다리
          const mx = p.x * 0.55 * S + sway(i * 1.3) * 0.5;
          const my = p.y * 0.55 * S - Math.abs(p.x) * 0.12 * S;
          ctx.beginPath();
          ctx.lineCap = 'round';
          ctx.lineWidth = S * 0.15;
          ctx.moveTo(p.x * 0.18 * S, p.y * 0.18 * S);
          ctx.quadraticCurveTo(mx, my, tx, ty);
          ctx.stroke();
          stickyGlow(ctx, { x: tx / S, y: ty / S }, S, contacts && contacts.has(p.id));
          blob(ctx, tx, ty, S * 0.12, this.light);
        });

        // 머리 돔 (중앙)
        const hy = -0.1 * S + sway(5) * 0.4;
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.ellipse(0, hy, 0.5 * S, 0.52 * S, 0, 0, Math.PI * 2);
        ctx.fill();
        gloss(ctx, -0.15 * S, hy - 0.18 * S, 0.15 * S, 0.09 * S);
        face(ctx, 0, hy + 0.02 * S, S * 0.8, opt.mood || 'happy');
        ctx.restore();
      },
    },

    // ============ 별 ============
    star: {
      id: 'star', name: '별찐득', desc: '꼭짓점 5곳이 끈적 · 가볍다', unlock: 15000,
      mass: 0.8, decayMod: 1.2, radius: 0.95, rollStep: (2 * Math.PI) / 5,
      color: '#ffd94f', dark: '#d9a520', light: '#fff3b0',
      stickyPoints: (function () {
        const pts = [];
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          pts.push({ id: 's' + i, x: Math.cos(a) * 0.95, y: Math.sin(a) * 0.95, grip: 0.75 });
        }
        return pts;
      })(),
      draw(ctx, S, opt) {
        opt = opt || {};
        const wob = opt.wob || 0, t = opt.t || 0, sq = opt.squash || 1;
        const contacts = opt.contacts;
        ctx.save();
        ctx.scale(1 / sq, sq);
        const swell = 1 + Math.sin(t * 15) * wob * 0.08;

        // 별 본체 (라운드 별)
        ctx.beginPath();
        ctx.fillStyle = this.color;
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = (i % 2 === 0 ? 0.95 * swell : 0.45) * S;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.lineJoin = 'round';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = S * 0.22;
        ctx.stroke();
        ctx.fill();

        this.stickyPoints.forEach((p) => {
          stickyGlow(ctx, p, S, contacts && contacts.has(p.id));
          blob(ctx, p.x * S * swell, p.y * S * swell, S * 0.11, this.light);
        });

        gloss(ctx, -0.15 * S, -0.25 * S, 0.16 * S, 0.09 * S);
        face(ctx, 0, -0.02 * S, S * 0.8, opt.mood || 'happy');
        ctx.restore();
      },
    },
  };

  ST.Shapes = {
    all: SHAPES,
    list: ['man', 'octo', 'star'].map((k) => SHAPES[k]),
    get(id) { return SHAPES[id] || SHAPES.man; },
    totalGrip(shape) {
      return shape.stickyPoints.reduce((s, p) => s + p.grip, 0);
    },
    // 선택 카드 미리보기
    preview(canvas, id) {
      const ctx = canvas.getContext('2d');
      const s = ST.Shapes.get(id);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      s.draw(ctx, canvas.width * 0.36, { mood: 'happy' });
      ctx.restore();
    },
  };
})();
