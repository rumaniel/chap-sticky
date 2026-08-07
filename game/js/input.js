/* 찐득이 토스 - 입력: 드래그 플릭 던지기 + 원형 드래그 스핀(커브볼)
 * 포인터 이벤트 통합(마우스/터치). 가상 좌표계 사용.
 */
window.ST = window.ST || {};

(function () {
  const SAMPLE_MS = 160;   // 위치 샘플 보관 시간
  const FLICK_MS = 90;     // 플릭 속도 계산 구간
  const MIN_FLICK = 0.38;  // px/ms 미만이면 던지기 취소
  const SPIN_R_MIN = 10;   // 스핀 인식 최소 반경(px)

  const samples = []; // {x, y, t}
  let holding = false;
  let enabled = false;
  let spinAccum = 0;      // 누적 회전(rad, 부호 = 방향)
  let spinVel = 0;        // 현재 각속도(rad/s)
  let lastAngle = null;
  let grabOffset = { x: 0, y: 0 };

  const Input = {
    holding: false,
    pos: { x: 0, y: 0 },       // 현재 포인터(가상 좌표)
    spinCharge: 0,             // 시각화용 누적 스핀
    spinVel: 0,
    onGrab: null, onHoldMove: null, onThrow: null, onCancel: null, onTap: null,
    grabTest: null,            // (x,y)=>bool 잡기 허용 판정

    enable() { enabled = true; },
    disable() { enabled = false; this._reset(); },

    // 매 프레임: 스핀 동작을 멈추면 이펙트/스핀 자연 소멸 (커브볼 해제)
    tick(dt) {
      if (!holding) return;
      if (performance.now() - (this._lastSpinAt || 0) > 160) {
        const k = Math.exp(-dt * 5.5);
        spinVel *= k;
        spinAccum *= k;
        if (Math.abs(spinAccum) < 0.4) spinAccum = 0;
        if (Math.abs(spinVel) < 0.3) spinVel = 0;
        this.spinCharge = spinAccum;
        this.spinVel = spinVel;
      }
    },

    _reset() {
      holding = false; this.holding = false;
      samples.length = 0;
      spinAccum = 0; spinVel = 0; lastAngle = null;
      this.spinCharge = 0; this.spinVel = 0;
    },

    _toVirtual(e) {
      const r = ST.canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * ST.view.w,
        y: ((e.clientY - r.top) / r.height) * ST.view.h,
      };
    },

    _centroid(now) {
      // 최근 250ms 평균 위치(스핀 중심 추정)
      let sx = 0, sy = 0, n = 0;
      for (const s of samples) {
        if (now - s.t < 250) { sx += s.x; sy += s.y; n++; }
      }
      return n ? { x: sx / n, y: sy / n } : null;
    },

    _down(e) {
      if (!enabled) return;
      const p = this._toVirtual(e);
      this.pos = p;
      if (this.grabTest && !this.grabTest(p.x, p.y)) {
        if (this.onTap) this.onTap(p);
        return;
      }
      holding = true; this.holding = true;
      samples.length = 0;
      spinAccum = 0; spinVel = 0; lastAngle = null;
      samples.push({ x: p.x, y: p.y, t: performance.now() });
      if (this.onGrab) this.onGrab(p);
    },

    _move(e) {
      if (!enabled || !holding) return;
      const p = this._toVirtual(e);
      this.pos = p;
      const now = performance.now();
      samples.push({ x: p.x, y: p.y, t: now });
      while (samples.length && now - samples[0].t > SAMPLE_MS) samples.shift();

      // 스핀: 이동 중심 대비 각도 변화 누적
      const c = this._centroid(now);
      if (c) {
        const dx = p.x - c.x, dy = p.y - c.y;
        const r = Math.hypot(dx, dy);
        if (r > SPIN_R_MIN) {
          const a = Math.atan2(dy, dx);
          if (lastAngle != null) {
            let d = a - lastAngle;
            if (d > Math.PI) d -= Math.PI * 2;
            if (d < -Math.PI) d += Math.PI * 2;
            if (Math.abs(d) < 1.2) { // 급점프 노이즈 제거
              spinAccum += d;
              const prev = samples[samples.length - 2];
              const dt = prev ? (now - prev.t) / 1000 : 0.016;
              if (dt > 0) spinVel = spinVel * 0.75 + (d / dt) * 0.25;
              if (Math.abs(d) > 0.03) this._lastSpinAt = now;
            }
          }
          lastAngle = a;
        } else {
          lastAngle = null;
        }
      }
      // 스핀 감쇠(가만히 있으면 풀림)
      spinVel *= 0.995;
      this.spinCharge = spinAccum;
      this.spinVel = spinVel;

      if (this.onHoldMove) this.onHoldMove(p);
    },

    _up(e) {
      if (!enabled || !holding) return;
      holding = false; this.holding = false;
      const now = performance.now();
      const p = this._toVirtual(e);
      samples.push({ x: p.x, y: p.y, t: now });

      // 플릭 속도: 최근 FLICK_MS 구간
      let first = null;
      for (const s of samples) {
        if (now - s.t <= FLICK_MS) { first = s; break; }
      }
      const last = samples[samples.length - 1];
      let flick = { vx: 0, vy: 0 };
      if (first && last && last.t > first.t) {
        const dt = last.t - first.t;
        flick = { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
      }
      const speed = Math.hypot(flick.vx, flick.vy);
      const spinOut = { charge: spinAccum, vel: spinVel };
      this._reset();

      if (speed < MIN_FLICK || flick.vy > -0.1) {
        // 너무 약하거나 위로 던지지 않음 → 취소
        if (this.onCancel) this.onCancel();
        return;
      }
      if (this.onThrow) this.onThrow(flick, spinOut);
    },

    init(canvas) {
      canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); canvas.setPointerCapture(e.pointerId); this._down(e); });
      canvas.addEventListener('pointermove', (e) => { e.preventDefault(); this._move(e); });
      canvas.addEventListener('pointerup', (e) => { e.preventDefault(); this._up(e); });
      canvas.addEventListener('pointercancel', () => { if (holding) { this._reset(); if (this.onCancel) this.onCancel(); } });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    },
  };

  ST.Input = Input;
})();
