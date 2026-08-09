/* 찐득이 토스 - 메인 루프, 씬 렌더, 던지기 라이프사이클 */
window.ST = window.ST || {};

(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ST.canvas = canvas;
  ST.ctx = ctx;
  ST.view = { w: 480, h: 800, cx: 240, scale: 1 };

  // ---------------- 뷰포트 (레터박스 contain) ----------------
  function resize() {
    // visualViewport: 모바일 주소창/줌 변동까지 반영된 실제 가시 영역
    const vv = window.visualViewport;
    const vw = vv ? Math.round(vv.width) : window.innerWidth;
    const vh = vv ? Math.round(vv.height) : window.innerHeight;
    const scale = Math.min(vw / ST.view.w, vh / ST.view.h);
    const cw = Math.round(ST.view.w * scale), chh = Math.round(ST.view.h * scale);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = cw + 'px';
    canvas.style.height = chh + 'px';
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(chh * dpr);
    ST.view.scale = scale * dpr;
    const ov = document.getElementById('overlay');
    ov.style.width = cw + 'px';
    ov.style.height = chh + 'px';
    // FAB 버튼(사운드/언어)을 캔버스 좌하단에 정렬 — 우하단은 itch 임베드 전체화면 버튼과 겹침
    const left = Math.round((vw - cw) / 2), top = Math.round((vh - chh) / 2);
    const snd = document.getElementById('sndToggle');
    const lng = document.getElementById('langToggle');
    // 가로 배치 — 세로 스택은 위 버튼이 파워 게이지 하단(가상 y~700)을 침범
    if (snd) { snd.style.left = (left + 10) + 'px'; snd.style.top = (top + chh - 54) + 'px'; }
    if (lng) { lng.style.left = (left + 64) + 'px'; lng.style.top = (top + chh - 54) + 'px'; }
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  // ---------------- 게임 오브젝트 ----------------
  const REST = { x: 240, y: 672 };

  const Game = {
    state: 'idle',
    shape: null, map: null,
    wallCache: null, wallRect: null,
    toyScreen: { x: REST.x, y: REST.y },
    flight: null, stuckSt: null, fallAnim: null, bounceAnim: null, flopAnim: null,
    ts: null,               // 현재 던지기 점수 상태
    impactPos: null,
    banner: null, turnLabel: '', turnColor: '#fff',
    hintT: 0, endT: 0, curMult: 0,
    time: 0,

    setup(shapeId, mapId) {
      this.shape = ST.Shapes.get(shapeId);
      this.map = ST.Materials.get(mapId);
      this.buildWallCache();
      this._buildGaugeBand();
      this.state = 'idle';
      this.toyScreen = { x: REST.x, y: REST.y };
      this.flight = this.stuckSt = this.fallAnim = this.bounceAnim = this.flopAnim = null;
      this.impactPos = null;
      this.multi = null;
      this._simulDone = false;
      ST.FX.clear();
      ST.Score.clearFloaters();
    },

    buildWallCache() {
      const r = ST.Physics.wallRect();
      this.wallRect = r;
      const Q = 2;
      const cv = document.createElement('canvas');
      cv.width = Math.round(r.w * Q);
      cv.height = Math.round(r.h * Q);
      const c = cv.getContext('2d');
      this.map.drawWall(c, cv.width, cv.height);

      // 과녁 링 (밴드)
      const T = ST.Physics.TUNE;
      const rw = ST.Score.ringWorld(this.map);
      const toPx = (wx, wy) => ({
        x: ((wx + T.WALL_W / 2) / T.WALL_W) * cv.width,
        y: ((T.WALL_BOTTOM + T.WALL_H - wy) / T.WALL_H) * cv.height,
      });
      const cpx = toPx(rw.x, rw.y);
      const wpm = cv.width / T.WALL_W;
      const R = this.map.rings;
      // 과녁 — 은은한 힌트 스타일 (맵별 표현)
      const style = this.map.ringStyle || { color: 'rgba(255,255,255,0.35)', dash: [8, 7] };
      c.setLineDash(style.dash);
      c.strokeStyle = style.color;
      for (let i = 0; i < R.radii.length; i++) {
        c.lineWidth = i === 0 ? 3.5 : 2.2;
        c.beginPath();
        c.arc(cpx.x, cpx.y, R.radii[i] * rw.unit * wpm, 0, Math.PI * 2);
        c.stroke();
      }
      c.setLineDash([]);
      c.beginPath();
      c.fillStyle = style.color;
      c.arc(cpx.x, cpx.y, 5, 0, Math.PI * 2);
      c.fill();
      // 냉장고: 자석 장식으로 링 은유
      if (style.magnets) {
        const rr = R.radii[1] * rw.unit * wpm;
        const cols = ['#e86a6a', '#6a9de8', '#e8c76a', '#7ec98f'];
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          c.beginPath();
          c.fillStyle = cols[k % 4];
          c.globalAlpha = 0.6;
          c.arc(cpx.x + Math.cos(a) * rr, cpx.y + Math.sin(a) * rr, 7, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
      }
      // 배율 라벨 (작게, 흐리게)
      c.font = '700 ' + Math.round(cv.width * 0.024) + 'px sans-serif';
      c.textAlign = 'center';
      c.globalAlpha = 0.6;
      c.fillStyle = style.color;
      R.radii.forEach((rr, i) => {
        c.fillText('×' + R.mults[i], cpx.x, cpx.y - rr * rw.unit * wpm + cv.width * 0.028);
      });
      c.globalAlpha = 1;

      // 보너스 스팟
      this.map.spots.forEach((sp) => {
        const w = ST.Score.spotWorld(this.map, sp);
        const p = toPx(w.x, w.y);
        const rad = w.r * wpm;
        c.beginPath();
        c.fillStyle = 'rgba(186,120,255,0.42)';
        c.arc(p.x, p.y, rad, 0, Math.PI * 2);
        c.fill();
        c.setLineDash([6, 5]);
        c.strokeStyle = 'rgba(255,255,255,0.95)';
        c.lineWidth = 3.5;
        c.stroke();
        c.setLineDash([]);
        this._spotIcon(c, sp.icon, p.x, p.y, rad);
        c.font = '700 ' + Math.round(rad * 0.5) + 'px sans-serif';
        c.textAlign = 'center';
        c.fillStyle = 'rgba(255,255,255,0.95)';
        c.fillText('+' + sp.bonus, p.x, p.y + rad + 14);
      });

      this.wallCache = cv;
    },

    /* 보너스 스팟 아이콘 — 무테 벡터 (캐릭터와 동일한 소프트 스타일). 칠판 텍스트는 분필 낙서 유지 */
    _spotIcon(c, icon, x, y, rad) {
      const s = rad * 0.62;
      c.save();
      c.translate(x, y);
      c.lineCap = c.lineJoin = 'round';
      if (icon === '★') {
        c.fillStyle = 'rgba(255,255,255,0.95)';
        c.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = (i % 2 === 0 ? 1 : 0.45) * s;
          i === 0 ? c.moveTo(Math.cos(a) * r, Math.sin(a) * r) : c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        c.closePath();
        c.fill();
      } else if (icon === '☀') {
        c.strokeStyle = 'rgba(255,255,255,0.95)';
        c.lineWidth = s * 0.22;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          c.beginPath();
          c.moveTo(Math.cos(a) * s * 0.62, Math.sin(a) * s * 0.62);
          c.lineTo(Math.cos(a) * s * 0.95, Math.sin(a) * s * 0.95);
          c.stroke();
        }
        c.fillStyle = 'rgba(255,255,255,0.95)';
        c.beginPath(); c.arc(0, 0, s * 0.42, 0, Math.PI * 2); c.fill();
      } else if (icon === '🐦') {
        c.fillStyle = 'rgba(255,255,255,0.95)';
        c.beginPath(); c.ellipse(s * 0.08, s * 0.12, s * 0.62, s * 0.48, 0, 0, Math.PI * 2); c.fill(); // 몸통
        c.beginPath(); c.arc(-s * 0.42, -s * 0.3, s * 0.34, 0, Math.PI * 2); c.fill();               // 머리
        c.fillStyle = '#ffb84f';                                                                      // 부리
        c.beginPath();
        c.moveTo(-s * 0.7, -s * 0.34); c.lineTo(-s * 0.98, -s * 0.22); c.lineTo(-s * 0.66, -s * 0.14);
        c.closePath(); c.fill();
        c.fillStyle = 'rgba(186,120,255,0.9)';                                                        // 날개
        c.beginPath(); c.ellipse(s * 0.18, s * 0.05, s * 0.3, s * 0.2, -0.35, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#2d3f4a';                                                                      // 눈
        c.beginPath(); c.arc(-s * 0.5, -s * 0.36, s * 0.06, 0, Math.PI * 2); c.fill();
      } else if (icon === '🧲') {
        c.strokeStyle = '#ff8a8a';
        c.lineWidth = s * 0.4;
        c.beginPath();
        c.arc(0, -s * 0.12, s * 0.5, Math.PI, 0);          // U 아치 (다리 아래로)
        c.moveTo(-s * 0.5, -s * 0.12); c.lineTo(-s * 0.5, s * 0.42);
        c.moveTo(s * 0.5, -s * 0.12); c.lineTo(s * 0.5, s * 0.42);
        c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.95)';            // 흰 팁
        c.beginPath(); c.roundRect(-s * 0.72, s * 0.42, s * 0.44, s * 0.3, s * 0.08); c.fill();
        c.beginPath(); c.roundRect(s * 0.28, s * 0.42, s * 0.44, s * 0.3, s * 0.08); c.fill();
      } else {
        c.font = '700 ' + Math.round(rad * 0.8) + 'px sans-serif';
        c.textAlign = 'center';
        c.fillStyle = 'rgba(255,255,255,0.95)';
        c.fillText(icon, 0, rad * 0.28);
      }
      c.restore();
    },

    /* 접착 자국 — 벽 캐시에 영구 스탬프 (턴 넘어도 누적). k = 진하기 배율 */
    _stainWall(wx, wy, shape, k) {
      const cv = this.wallCache;
      if (!cv) return;
      const T = ST.Physics.TUNE;
      const c = cv.getContext('2d');
      const px = ((wx + T.WALL_W / 2) / T.WALL_W) * cv.width;
      const py = ((T.WALL_BOTTOM + T.WALL_H - wy) / T.WALL_H) * cv.height;
      const R = ST.Sticky.TOY_R * (cv.width / T.WALL_W) * 0.72;
      c.save();
      c.fillStyle = shape.color;
      c.globalAlpha = 0.13 * k;
      c.beginPath();
      c.ellipse(px, py, R, R * 0.9, 0, 0, Math.PI * 2);
      c.fill();
      // 튄 방울들
      c.globalAlpha = 0.11 * k;
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = R * (0.85 + Math.random() * 0.55);
        c.beginPath();
        c.arc(px + Math.cos(a) * d, py + Math.sin(a) * d, R * (0.1 + Math.random() * 0.14), 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    },

    startTurn(label, color) {
      this.turnLabel = label;
      this.turnColor = color || '#fff';
      this.banner = { t: 1.2 };
      this.state = 'aim';
      this.ts = ST.Score.beginThrow();
      this.toyScreen = { x: REST.x, y: REST.y };
      this.flight = this.stuckSt = this.fallAnim = this.bounceAnim = this.flopAnim = null;
      this.impactPos = null;
      this.curMult = 0;
      this.wasStuck = false;
      this.aimRot = 0;
      this._spinBlend = 0;
      const s = ST.Modes.session;
      this.simDefer = !!(s && s.simMode);
      this.hintT = s && s.round === 0 && s.cur === 0 ? 6 : 0;
      // 첫 던지기 성공 전까지 고스트 손 시연 (기기당 1회 학습)
      let tut = null;
      try { tut = localStorage.getItem('stickytoss_tut'); } catch (e) { /* file:// 등 */ }
      this._ghostOn = !tut;
      ST.Input.enable();
    },

    // ---------- 입력 콜백 ----------
    bindInput() {
      const I = ST.Input;
      I.grabTest = (x, y) => this.state === 'aim' &&
        Math.hypot(x - this.toyScreen.x, y - this.toyScreen.y) < 115;
      I.onGrab = () => { ST.Audio.play('grab'); };
      I.onHoldMove = (p) => {
        this.toyScreen.x = Math.max(35, Math.min(445, p.x));
        this.toyScreen.y = Math.max(330, Math.min(775, p.y));
        // 스핀 슉슉
        if (Math.abs(I.spinVel) > 9) {
          const now = performance.now();
          if (!this._swishT || now - this._swishT > 90) {
            this._swishT = now;
            ST.Audio.sfx.swish(0.3);
          }
        }
      };
      I.onCancel = (speed) => {
        // 제자리 복귀는 update에서 lerp. 취소된 세기를 게이지에 잠깐 남겨 학습 피드백
        if (this.state === 'aim' && speed != null) this._lastGauge = { speed, t: 1.2 };
      };
      I.onThrow = (flick, spin) => {
        if (this.state !== 'aim') return;
        const T = ST.Physics.TUNE;
        const hw = ST.Physics.unproject(this.toyScreen.x, this.toyScreen.y, T.HOLD_Z);
        this.flight = ST.Physics.makeThrow(flick, spin.vel, hw);
        this.flight.angle = this.aimRot || 0; // 조준 중 돌린 자세 그대로 비행
        this.state = 'fly';
        this.hintT = 0;
        this._lastGauge = { speed: Math.hypot(flick.vx, flick.vy), t: 1.4 };
        this._ghostOn = false;
        try { localStorage.setItem('stickytoss_tut', '1'); } catch (e) { /* noop */ }
        ST.Audio.play('whoosh');
        ST.Input.disable();
      };
    },

    // ---------- 갱신 ----------
    update(dt) {
      this.time += dt;
      if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
      if (this.hintT > 0) this.hintT -= dt;
      if (this._lastGauge) { this._lastGauge.t -= dt; if (this._lastGauge.t <= 0) this._lastGauge = null; }

      const T = ST.Physics.TUNE;

      if (this.state === 'aim') {
        ST.Input.tick(dt); // 스핀 멈추면 커브 이펙트 자연 소멸
        // 게이지 직구↔커브 모드 크로스페이드
        const sbTgt = ST.Input.holding && this._spinActive() ? 1 : 0;
        this._spinBlend = (this._spinBlend || 0) + (sbTgt - (this._spinBlend || 0)) * Math.min(1, dt * 9);
        // 셰브런 흐름 속도 = 스핀 각속도 연동. 위상 적분이라 속도 변화가 점프 없이 가감속으로만 반영
        const chevTgt = 26 + 130 * Math.min(1, Math.abs(ST.Input.spinVel) * T.KSPIN / T.SPIN_MAX);
        this._chevSpd = (this._chevSpd || 26) + (chevTgt - (this._chevSpd || 26)) * Math.min(1, dt * 5);
        this._chevPhase = ((this._chevPhase || 0) + dt * this._chevSpd) % 34;
        if (ST.Input.holding) {
          // 스핀으로 돌아간 각도는 누적 유지 (멈춰도 원상복구하지 않음)
          this.aimRot += ST.Input.spinVel * dt * 0.55;
        } else {
          this.toyScreen.x += (REST.x - this.toyScreen.x) * Math.min(1, dt * 10);
          this.toyScreen.y += (REST.y - this.toyScreen.y) * Math.min(1, dt * 10);
        }
      }

      if (this.state === 'fly') {
        const f = this.flight;
        const res = ST.Physics.stepFlight(f, dt);
        // 스핀 트레일 + 비행 슉슉
        if (Math.abs(f.spin) > 5) {
          if (Math.random() < 0.6) {
            const pr = ST.Physics.project(f.x, f.y, f.z);
            ST.FX.burst(pr.x, pr.y, 1, { speed: 30, size: 4, life: 0.35, grav: 0, color: '#8ad6ff' });
          }
          const now = performance.now();
          if (!this._fswishT || now - this._fswishT > 130) {
            this._fswishT = now;
            ST.Audio.sfx.swish(0.12);
          }
        }
        if (res) this._onFlightEnd(res);
      } else if (this.state === 'stuck') {
        const st = this.stuckSt;
        const evs = ST.Sticky.update(st, dt);
        this.curMult = ST.Score.tickHold(this.ts, st, dt);
        this._handleStickyEvents(evs, st);
        // 초당 점수 틱 표시
        this._tickAcc = (this._tickAcc || 0) + dt;
        if (this._tickAcc >= 1) {
          this._tickAcc -= 1;
          const p = ST.Physics.project(st.x, st.y, T.WALL_Z);
          ST.Score.float(p.x, p.y - 46, '+' + Math.round(ST.Score.HOLD_RATE * this.curMult), { color: '#c7f77a', size: 18, dur: 0.8 });
          ST.Audio.play('tick');
        }
      } else if (this.state === 'simul') {
        let allDone = true;
        for (const m of this.multi) {
          if (m.done) continue;
          allDone = false;
          if (m.fall) {
            m.fall.vy -= 9.8 * dt;
            m.fall.y += m.fall.vy * dt;
            m.fall.x += m.fall.vx * dt;
            m.fall.rot += m.fall.rotV * dt;
            if (m.fall.y <= 0.12) {
              m.done = true;
              m.result = ST.Score.finalize(m.ts);
              ST.Audio.play('thud');
              const p = ST.Physics.project(m.fall.x, 0.1, T.WALL_Z);
              ST.FX.burst(p.x, p.y, 8, { color: '#bbb', speed: 80, size: 4, life: 0.4 });
              ST.Score.float(p.x, p.y - 30, m.name + ' +' + m.result.toLocaleString(), { color: m.color, size: 22, dur: 1.5 });
            }
            continue;
          }
          const evs = ST.Sticky.update(m.st, dt);
          ST.Score.tickHold(m.ts, m.st, dt);
          this._handleStickyEvents(evs, m.st, (kick) => {
            m.fall = { x: m.st.x, y: m.st.y, vx: kick.vx, vy: kick.vy, rot: m.st.angle, rotV: kick.rotV };
          });
        }
        if (allDone) {
          this.state = 'done';
          this.endT = 1.0;
          this._simulDone = true;
        }
      } else if (this.state === 'fall') {
        const fa = this.fallAnim;
        fa.vy -= 9.8 * dt;
        fa.y += fa.vy * dt;
        fa.x += fa.vx * dt;
        fa.rot += fa.rotV * dt;
        if (fa.y <= 0.12) {
          ST.Audio.play('thud');
          ST.FX.addShake(4);
          const p = ST.Physics.project(fa.x, 0.1, T.WALL_Z);
          ST.FX.burst(p.x, p.y, 10, { color: '#bbb', speed: 90, size: 4, life: 0.5 });
          this._endThrow(this.wasStuck);
        }
      } else if (this.state === 'bounceoff') {
        const b = this.bounceAnim;
        b.vy -= 9.8 * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        b.x += b.vx * dt;
        b.rot += b.rotV * dt;
        if (b.y <= 0.1 || b.z < 0.3) {
          ST.Audio.play('thud');
          this._endThrow(false);
        }
      } else if (this.state === 'floorflop') {
        this.flopAnim.t += dt;
        if (this.flopAnim.t > 0.8) this._endThrow(false);
      } else if (this.state === 'done') {
        this.endT -= dt;
        if (this.endT <= 0 && this._doneRes) {
          const r = this._doneRes;
          this._doneRes = null;
          ST.Modes.onThrowEnd(r);
        } else if (this.endT <= 0 && this._simulDone) {
          this._simulDone = false;
          const multi = this.multi;
          this.multi = null;
          ST.Modes.onSimulEnd(multi);
        }
      }
    },

    // 부착 상태 이벤트 공통 처리 (solo/simul). onFall: 낙하 시작 콜백(없으면 solo 낙하)
    _handleStickyEvents(evs, st, onFall) {
      for (const e of evs) {
        const t = e.type || e;
        if (t === 'flip' || t === 'roll') ST.Audio.play('flip');
        else if (t === 'land') { ST.Audio.play('land'); ST.FX.addShake(2); this._dustAt(st, 4); }
        else if (t === 'slip') ST.Audio.play('slip');
        else if (t === 'peelstart') ST.Audio.play('peel');
        else if (t === 'swing') ST.Audio.play('slip');
        else if (t === 'pop') {
          ST.Audio.play('pop');
          const T = ST.Physics.TUNE;
          const px = e.x != null ? e.x : st.x, py = e.y != null ? e.y : st.y;
          const p = ST.Physics.project(px, py, T.WALL_Z);
          ST.FX.burst(p.x, p.y, 5, { color: st.shape.light, speed: 90, size: 4, life: 0.35 });
        } else if (t === 'fall') {
          const kick = st.fallKick || { vx: st.driftX * 20, vy: 0.3, rotV: (st.flipDir || 1) * 6 };
          ST.Audio.play('fallWhistle');
          if (onFall) onFall(kick);
          else this._startFall(kick);
        }
      }
    },

    _onFlightEnd(res) {
      const T = ST.Physics.TUNE;
      if (res.type === 'wall') {
        const shape = this.shape, map = this.map;
        const r = ST.Sticky.resolveImpact(res, shape, map);
        const p = ST.Physics.project(res.x, res.y, T.WALL_Z);
        if (r.stuck) {
          this.impactPos = { x: res.x, y: res.y };
          this._stainWall(res.x, res.y, shape, 1);
          ST.Score.onStick(this.ts, r, res, map);
          ST.Audio.play('splat');
          if (r.perfect) ST.Audio.play('perfect');
          else if (r.quality > 0.6) ST.Audio.play('goodStick');
          if (this.ts.bonuses.some((b) => b.text.startsWith('커브'))) ST.Audio.play('curveHit');
          ST.FX.addShake(r.perfect ? 8 : 5);
          ST.FX.addHitstop(0.07);
          ST.FX.burst(p.x, p.y, 14, { color: shape.light, speed: 150, size: 5, life: 0.45 });
          this.ts.bonuses.forEach((b, i) => {
            if (!b.live) setTimeout(() => ST.Score.float(p.x, p.y - 60 - i * 26, b.text, { color: b.color, size: 24 }), 150 + i * 220);
          });
          if (this.simDefer) {
            // 파티 동시 시뮬: 착지까지만, 크롤은 라운드 끝에 일괄
            ST.Score.float(p.x, p.y - 34, ST.I18N.t('float.stick'), { color: '#ffe27a', size: 26 });
            this.wasStuck = true;
            this._pendingStick = { impact: res, res: r, ts: this.ts };
            this._endThrow(true, true);
          } else {
            this.stuckSt = ST.Sticky.createStuck(r, res, shape, map);
            this.wasStuck = true;
            this.state = 'stuck';
          }
        } else if (r.reason === 'nogrip') {
          // 그립 없는 존 → 툭 치고 낙하
          this._stainWall(res.x, res.y, shape, 0.4);
          ST.Audio.play('pop');
          ST.Audio.play('sadDrop');
          ST.FX.burst(p.x, p.y, 8, { color: '#ccc', speed: 90, size: 4, life: 0.35 });
          ST.Score.float(p.x, p.y - 40, ST.I18N.t('float.noGrip'), { color: '#c9c0e8', size: 24 });
          this.fallAnim = { x: res.x, y: res.y, vx: res.vx * 0.15, vy: 0, rot: res.angle, rotV: (Math.random() - 0.5) * 8 };
          this.state = 'fall';
        } else {
          // 너무 세다 → 튕겨나감
          this._stainWall(res.x, res.y, shape, 0.4);
          this.state = 'bounceoff';
          this.bounceAnim = {
            x: res.x, y: res.y, z: T.WALL_Z,
            vx: res.vx * 0.25, vy: Math.max(0.8, res.vy * 0.3),
            vz: -res.vz * map.mat.bounce * 0.4,
            rot: res.angle, rotV: (Math.random() - 0.5) * 14,
          };
          ST.Audio.play('bounce');
          ST.Audio.play('stingBad');
          ST.FX.addShake(6);
          ST.FX.burst(p.x, p.y, 10, { color: '#fff', speed: 120, size: 4, life: 0.35 });
          ST.Score.float(p.x, p.y - 40, ST.I18N.t('float.tooHard'), { color: '#ff9d76', size: 26 });
        }
      } else if (res.type === 'floor') {
        this.state = 'floorflop';
        this.flopAnim = { x: res.x, z: res.z, t: 0 };
        const p = ST.Physics.project(res.x, 0.05, res.z);
        ST.Audio.play('thud');
        ST.Audio.play('sadDrop');
        ST.FX.burst(p.x, p.y, 8, { color: '#a89878', speed: 80, size: 4, life: 0.4 });
        ST.Score.float(p.x, p.y - 30, ST.I18N.t('float.floor'), { color: '#c9b8a0', size: 24 });
      } else { // past — 존 밖, 시각적으로 떨어짐
        ST.Score.float(240, 300, ST.I18N.t('float.outZone'), { color: '#9d92c7', size: 24 });
        ST.Audio.play('sadDrop');
        this.fallAnim = {
          x: res.x, y: Math.max(res.y, 0.5), vx: res.vx * 0.2, vy: Math.min(0, res.vy * 0.2),
          rot: res.angle, rotV: (res.spin || 8) * 0.4,
        };
        this.state = 'fall';
      }
    },

    _startFall(kick) {
      const st = this.stuckSt;
      this.fallAnim = {
        x: st.x, y: st.y, vx: kick.vx, vy: kick.vy,
        rot: st.angle, rotV: kick.rotV,
      };
      this.state = 'fall';
    },

    /* 파티 동시 시뮬 시작. list: [{player,name,color,impact,res,ts}] */
    startSimul(list) {
      ST.UI.showGame();
      this.turnLabel = ST.I18N.t('turn.simul');
      this.turnColor = '#ffe27a';
      this.banner = { t: 1.2 };
      this.state = 'simul';
      this.multi = list.map((it) => ({
        player: it.player, name: it.name, color: it.color, ts: it.ts,
        st: ST.Sticky.createStuck(it.res, it.impact, this.shape, this.map),
        fall: null, done: false, result: null,
      }));
      ST.Audio.play('turn');
      ST.Input.disable();
    },

    _dustAt(st, n) {
      const p = ST.Physics.project(st.x, st.y, ST.Physics.TUNE.WALL_Z);
      ST.FX.burst(p.x, p.y + 12, n, { color: '#ffffff88', speed: 50, size: 3, life: 0.3, grav: 60 });
    },

    _endThrow(wasStuck, deferred) {
      if (deferred) {
        // 시뮬 유예: 점수 확정하지 않고 착지 정보만 전달
        this.state = 'done';
        this.endT = 0.55;
        this._doneRes = {
          total: 0, holdTime: 0,
          impact: this.impactPos,
          stuck: true, deferred: true,
          pending: this._pendingStick,
        };
        this._pendingStick = null;
        return;
      }
      const total = ST.Score.finalize(this.ts);
      if (total > 0) {
        ST.Score.float(240, 360, ST.I18N.t('float.sum', total.toLocaleString()), { color: '#ffe27a', size: 34, dur: 1.4 });
      }
      this.state = 'done';
      this.endT = 0.9;
      this._doneRes = {
        total,
        holdTime: this.ts.holdTime || 0,
        impact: this.impactPos,
        stuck: !!wasStuck,
      };
    },

    // ---------- 렌더 ----------
    render() {
      const T = ST.Physics.TUNE;
      const v = ST.view;
      ctx.save();
      ctx.setTransform(v.scale, 0, 0, v.scale, 0, 0);
      ctx.translate(ST.FX.shakeX, ST.FX.shakeY);

      // 배경
      const bg = ctx.createLinearGradient(0, 0, 0, v.h);
      bg.addColorStop(0, this.map ? this.map.skyColor : '#3a2f5c');
      bg.addColorStop(1, '#1a1530');
      ctx.fillStyle = bg;
      ctx.fillRect(-20, -20, v.w + 40, v.h + 40);

      if (this.map) {
        const r = this.wallRect;
        // 벽
        ctx.drawImage(this.wallCache, r.x, r.y, r.w, r.h);
        // 벽 테두리
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 4;
        ctx.strokeRect(r.x, r.y, r.w, r.h);

        // 바닥 (원근 사다리꼴)
        const fb = this.map.floorColor;
        const fg = ctx.createLinearGradient(0, r.y + r.h, 0, v.h);
        fg.addColorStop(0, fb[0]); fg.addColorStop(1, fb[1]);
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y + r.h);
        ctx.lineTo(r.x + r.w, r.y + r.h);
        ctx.lineTo(v.w + 60, v.h);
        ctx.lineTo(-60, v.h);
        ctx.closePath();
        ctx.fill();
        // 바닥 원근선
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 2;
        for (let i = 1; i < 6; i++) {
          const k = i / 6;
          const y = r.y + r.h + (v.h - r.y - r.h) * k * k;
          const spread = 60 * k * k;
          ctx.beginPath();
          ctx.moveTo(r.x - spread, y);
          ctx.lineTo(r.x + r.w + spread, y);
          ctx.stroke();
        }

        // 이전 던지기 마커
        const s = ST.Modes.session;
        if (s) {
          for (const m of s.markers) {
            const p = ST.Physics.project(m.x, m.y, T.WALL_Z);
            ctx.beginPath();
            ctx.fillStyle = m.color;
            ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.font = '700 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fff';
            ctx.fillText(m.label, p.x, p.y + 3.5);
          }
        }
      }

      // ---- 파티 동시 시뮬: 전원 찐득이 ----
      if (this.state === 'simul' && this.multi) {
        for (const m of this.multi) {
          if (m.done) continue;
          const pos = m.fall || m.st;
          const p = ST.Physics.project(pos.x, pos.y, T.WALL_Z);
          const S = ST.Sticky.TOY_R * T.PPM * p.s * 1.1;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(m.fall ? m.fall.rot : m.st.angle);
          this.shape.draw(ctx, S, m.fall
            ? { wob: 1, t: this.time + m.player, mood: 'dizzy' }
            : { wob: m.st.wob, t: this.time + m.player, squash: m.st.squash, mood: m.st.mood, contacts: ST.Sticky.displayContacts(m.st, this.time) });
          ctx.restore();
          // 플레이어 색 링 + 이름표
          ctx.strokeStyle = m.color;
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.arc(p.x, p.y, S + 9, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.font = '700 13px "Malgun Gothic", sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.strokeText(m.name, p.x, p.y - S - 16);
          ctx.fillStyle = m.color;
          ctx.fillText(m.name, p.x, p.y - S - 16);
          if (!m.fall) this._drawGrip(p.x, p.y - S - 46, m.st.gh);
        }
      }

      // ---- 찐득이 ----
      if (this.state === 'stuck' && this.stuckSt) {
        const st = this.stuckSt;
        const p = ST.Physics.project(st.x, st.y, T.WALL_Z);
        const S = ST.Sticky.TOY_R * T.PPM * p.s * (this.shape.radius + 0.15);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(st.angle);
        this.shape.draw(ctx, S, { wob: st.wob, t: this.time, squash: st.squash, mood: st.mood, contacts: ST.Sticky.displayContacts(st, this.time) });
        ctx.restore();
        // 그립 게이지
        this._drawGrip(p.x, p.y - S - 16, st.gh);
      } else if (this.state === 'fall' && this.fallAnim) {
        const fa = this.fallAnim;
        const p = ST.Physics.project(fa.x, fa.y, T.WALL_Z);
        const S = ST.Sticky.TOY_R * T.PPM * p.s * 1.1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(fa.rot);
        this.shape.draw(ctx, S, { wob: 1, t: this.time, mood: 'dizzy' });
        ctx.restore();
      } else if (this.state === 'bounceoff' && this.bounceAnim) {
        const b = this.bounceAnim;
        const p = ST.Physics.project(b.x, b.y, b.z);
        const S = ST.Sticky.TOY_R * T.PPM * p.s * 1.1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(b.rot);
        this.shape.draw(ctx, S, { wob: 1, t: this.time, mood: 'dizzy' });
        ctx.restore();
      } else if (this.state === 'floorflop' && this.flopAnim) {
        const f = this.flopAnim;
        const p = ST.Physics.project(f.x, 0.06, f.z);
        const S = ST.Sticky.TOY_R * T.PPM * p.s;
        ctx.save();
        ctx.translate(p.x, p.y);
        this.shape.draw(ctx, S, { squash: 0.45, mood: 'dizzy', t: this.time });
        ctx.restore();
      } else if (this.state === 'fly' && this.flight) {
        const f = this.flight;
        const p = ST.Physics.project(f.x, f.y, f.z);
        const S = ST.Sticky.TOY_R * T.PPM * p.s * 1.15;
        // 그림자
        const sh = ST.Physics.project(f.x, 0.02, f.z);
        ctx.beginPath();
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.ellipse(sh.x, sh.y, S * 0.7, S * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(f.angle);
        this.shape.draw(ctx, S, { wob: 0.3, t: this.time, mood: 'excited', squash: 1.08 });
        ctx.restore();
      } else if (this.state === 'aim' || this.state === 'idle' || this.state === 'done') {
        if (this.shape && this.state !== 'done') {
          const t = this.toyScreen;
          const S = ST.Sticky.TOY_R * T.PPM * 0.82;
          // 그림자
          ctx.beginPath();
          ctx.fillStyle = 'rgba(0,0,0,0.28)';
          ctx.ellipse(REST.x, REST.y + 66, 52, 13, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.save();
          ctx.translate(t.x, t.y + (ST.Input.holding ? 0 : Math.sin(this.time * 2.2) * 4));
          ctx.rotate(this.aimRot || 0);
          this.shape.draw(ctx, S, { wob: ST.Input.holding ? 0.35 : 0.12, t: this.time, mood: 'happy' });
          ctx.restore();
          // 스핀 인디케이터 — 빠른 이중 호 (텍스트 없음)
          if (ST.Input.holding && Math.abs(ST.Input.spinCharge) > 2.5) {
            const dir = Math.sign(ST.Input.spinCharge);
            const spd = this.time * 9 * dir;
            ctx.strokeStyle = 'rgba(138,214,255,0.9)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(t.x, t.y, S + 16, spd, spd + 1.3);
            ctx.stroke();
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(t.x, t.y, S + 27, spd + Math.PI, spd + Math.PI + 1.0);
            ctx.stroke();
          }
          if (this.state === 'aim') {
            if (ST.Input.holding) {
              // 원형 드래그 중엔 속도 벡터가 회전해 예측이 무의미 → 커브 힌트로 대체
              if (this._spinActive()) this._drawCurveHint(t.x, t.y, S);
              else this._drawTraj();
            } else if (this._ghostOn) this._drawGhost();
          }
        }
      }

      // 조작 힌트
      if (this.hintT > 0 && this.state === 'aim') {
        ctx.globalAlpha = Math.min(1, this.hintT);
        ctx.font = '700 17px "Malgun Gothic", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText(ST.I18N.t('hint.flick'), 240, 560);
        ctx.font = '400 14px "Malgun Gothic", sans-serif';
        ctx.fillStyle = '#c9c0e8';
        ctx.fillText(ST.I18N.t('hint.spin'), 240, 584);
        ctx.globalAlpha = 1;
      }

      // 파워 게이지 (드래그 중 라이브 + 던진 직후 잔상)
      this._drawGaugeUI();

      // HUD
      this._drawHUD();

      // 배너
      if (this.banner) {
        const a = Math.min(1, this.banner.t / 0.3);
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(20,15,40,0.82)';
        ctx.beginPath();
        ctx.roundRect(70, 300, 340, 84, 20);
        ctx.fill();
        ctx.strokeStyle = this.turnColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.font = '900 30px "Malgun Gothic", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = this.turnColor;
        ctx.fillText(this.turnLabel, 240, 352);
        ctx.globalAlpha = 1;
      }

      ST.FX.draw(ctx);
      ST.Score.drawFloaters(ctx);
      ctx.restore();
    },

    /* 게이지 밴드: 현재 모형×맵에서 "붙는 세기" 구간을 플릭 속도(px/ms)로 환산.
     * 전패드 접촉 가정, 접선 성분은 평균 몫(0.4m/s)으로 근사 — 안내용 근사치 */
    _buildGaugeBand() {
      const T = ST.Physics.TUNE;
      const sumGrip = this.shape.stickyPoints.reduce((s, p) => s + p.grip, 0);
      const limit = sumGrip * this.map.mat.grip * ST.Sticky.K_MAX;
      const toSpeed = (vz) => Math.max(0, Math.min(T.VZ_MAX, vz)) / T.KZ;
      this.gaugeBand = {
        max: T.VZ_MAX / T.KZ,
        min: ST.Input.MIN_FLICK,
        limit: toSpeed(limit / this.shape.mass - 0.4),
        sweet: toSpeed(ST.Sticky.SWEET * limit / this.shape.mass - 0.4),
      };
    },

    // 스핀 제스처 진행 중 판정 (스핀 호 표시 임계와 동일 + 최근 회전 입력)
    _spinActive() {
      return Math.abs(ST.Input.spinCharge) > 2.5 ||
        performance.now() - (ST.Input._lastSpinAt || 0) < 220;
    },

    // 커브 힌트: 착탄 예측 대신 "이만큼 이쪽으로 휜다" — 휜 화살표 (Magnus 방향과 일치)
    _drawCurveHint(tx, ty, S) {
      const I = ST.Input;
      const T = ST.Physics.TUNE;
      const dir = Math.sign(I.spinVel || I.spinCharge) || 1;
      const norm = Math.min(1, Math.abs(I.spinVel) * T.KSPIN / T.SPIN_MAX);
      const bend = dir * (24 + 76 * norm);
      const y0 = ty - S - 34;
      const cx = tx + bend * 0.15, cy = y0 - 62, ex = tx + bend, ey = y0 - 104;
      ctx.globalAlpha = 0.65 + 0.25 * Math.sin(this.time * 6);
      ctx.strokeStyle = '#8ad6ff';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, y0);
      ctx.quadraticCurveTo(cx, cy, ex, ey);
      ctx.stroke();
      const ang = Math.atan2(ey - cy, ex - cx); // 끝점 접선
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(ang - 0.5) * 14, ey - Math.sin(ang - 0.5) * 14);
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(ang + 0.5) * 14, ey - Math.sin(ang + 0.5) * 14);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    // 부분 궤적 미리보기: 현재 드래그 속도로 던졌을 때의 초반 50% 깊이까지 점선
    _drawTraj() {
      const I = ST.Input;
      if (I.liveSpeed < 0.12 || I.liveFlick.vy > -0.03) return;
      const T = ST.Physics.TUNE;
      const hw = ST.Physics.unproject(this.toyScreen.x, this.toyScreen.y, T.HOLD_Z);
      const f = ST.Physics.makeThrow(I.liveFlick, I.spinVel, hw);
      const spin = Math.abs(f.spin) > 4;
      const pts = [];
      for (let i = 0; i < 160; i++) {
        const res = ST.Physics.stepFlight(f, 1 / 120);
        if (i >= 3) pts.push(ST.Physics.project(f.x, f.y, f.z));
        if (res || f.z > T.WALL_Z * 0.5) break;
      }
      const base = Math.max(0, Math.min(0.65, (I.liveSpeed - 0.08) * 1.1)); // 약할수록 흐리게
      pts.forEach((p, i) => {
        const k = i / pts.length;
        ctx.globalAlpha = base * (1 - k * 0.8);
        ctx.beginPath();
        ctx.arc(p.x, p.y, (5.5 - k * 2.6) * Math.max(0.55, p.s), 0, Math.PI * 2);
        ctx.fillStyle = spin ? '#8ad6ff' : '#ffe9a8';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(30,20,10,0.35)'; // 밝은 벽 대비
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    },

    /* 파워 게이지. 직구: 세기 vs 찹 존(초록)·과속(빨강)·무효(회색) + 스윗 라인.
     * 스핀 중: 파란 커브 충전 바로 크로스페이드 변신(_spinBlend) — 커브볼 모드 표현 */
    _drawGaugeUI() {
      const I = ST.Input;
      const B = this.gaugeBand;
      if (!B) return;
      const T = ST.Physics.TUNE;
      const live = this.state === 'aim' && I.holding;
      let sp = null, alpha = 1;
      if (live) {
        if (!this._spinActive()) sp = I.liveSpeed;
      } else if (this._lastGauge) {
        sp = this._lastGauge.speed;
        alpha = Math.min(1, this._lastGauge.t / 0.45);
      }
      if (!live && sp == null) return;
      const blend = live ? (this._spinBlend || 0) : 0;

      const x = 24, w = 12, y1 = 700, hh = 260;
      const yAt = (v) => y1 - hh * Math.max(0, Math.min(1, v / B.max));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(10,8,24,0.55)';
      ctx.beginPath();
      ctx.roundRect(x - 4, y1 - hh - 4, w + 8, hh + 8, 7);
      ctx.fill();
      // 직구 존 — 스핀 모드로 갈수록 흐려짐
      if (blend < 0.98) {
        ctx.globalAlpha = alpha * (1 - blend);
        ctx.fillStyle = 'rgba(255,255,255,0.16)';                  // 무효(너무 약함)
        ctx.fillRect(x, yAt(B.min), w, y1 - yAt(B.min));
        ctx.fillStyle = 'rgba(126,217,87,0.5)';                    // 찹 존
        ctx.fillRect(x, yAt(B.limit), w, yAt(B.min) - yAt(B.limit));
        ctx.fillStyle = 'rgba(255,120,100,0.5)';                   // 과속(튕김)
        ctx.fillRect(x, y1 - hh, w, yAt(B.limit) - (y1 - hh));
        const ys = yAt(B.sweet);
        ctx.strokeStyle = '#c7f77a';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x - 5, ys); ctx.lineTo(x + w + 5, ys); ctx.stroke();
      }
      // 커브볼 모드 — 바 전체를 덮는 등속 셰브런 연출 (스핀량 표현 안 함, 요동 없음)
      if (blend > 0.02) {
        ctx.save();
        ctx.globalAlpha = alpha * blend;
        ctx.beginPath();
        ctx.rect(x, y1 - hh, w, hh);
        ctx.clip();
        ctx.fillStyle = 'rgba(138,214,255,0.3)';
        ctx.fillRect(x, y1 - hh, w, hh);
        const gap = 34;
        const off = this._chevPhase || 0; // 위로 흐르는 루프 (속도 = 스핀 각속도 연동, update에서 적분)
        ctx.strokeStyle = 'rgba(205,238,255,0.9)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (let yy = y1 + gap - off; yy > y1 - hh - gap; yy -= gap) {
          ctx.beginPath();
          ctx.moveTo(x + 1.5, yy);
          ctx.lineTo(x + w / 2, yy - 7);
          ctx.lineTo(x + w - 1.5, yy);
          ctx.stroke();
        }
        ctx.restore();
      }
      // 현재 세기 바늘 (직구 라이브 / 던진 직후 잔상)
      if (sp != null) {
        ctx.globalAlpha = alpha;
        const yc = yAt(sp);
        const over = sp > B.limit;
        ctx.fillStyle = over ? 'rgba(255,190,190,0.9)' : 'rgba(255,255,255,0.85)';
        ctx.fillRect(x + 4, yc, w - 8, y1 - yc);
        ctx.fillStyle = over ? '#ff8a8a' : sp >= B.min ? '#fff' : 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.moveTo(x + w + 3, yc);
        ctx.lineTo(x + w + 12, yc - 6);
        ctx.lineTo(x + w + 12, yc + 6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },

    // 고스트 손: 찐득이를 잡고 위로 스윽 미는 시연 (첫 던지기 전까지 루프)
    _drawGhost() {
      const cyc = this.time % 1.9;
      if (cyc > 1.35) return;
      const t = cyc / 1.35;
      const k = Math.pow(t, 1.8); // 천천히 잡고 → 가속하며 밀어올림 (플릭 리듬)
      const sx = 246, sy = 668, ex = 302, ey = 452;
      const x = sx + (ex - sx) * k, y = sy + (ey - sy) * k;
      const a = t < 0.12 ? t / 0.12 : t > 0.72 ? Math.max(0, (1 - t) / 0.28) : 1;
      ctx.globalAlpha = a * 0.9;
      const kb = Math.pow(Math.max(0, t - 0.22), 1.8); // 꼬리 잔상
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx + (ex - sx) * kb, sy + (ey - sy) * kb);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.font = '38px "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👆', x, y + 34);
      ctx.globalAlpha = 1;
    },

    _drawGrip(x, y, gh) {
      const w = 64, h = 9;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.roundRect(x - w / 2 - 2, y - 2, w + 4, h + 4, 5);
      ctx.fill();
      const g = Math.max(0, Math.min(1, gh));
      ctx.fillStyle = g > 0.5 ? '#7ed957' : g > 0.25 ? '#ffd94f' : '#ff8a8a';
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y, w * g, h, 4);
      ctx.fill();
    },

    _chip(x, y, w, h, hi, color) {
      ctx.fillStyle = hi ? 'rgba(30,24,58,0.85)' : 'rgba(18,14,36,0.6)';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.fill();
      if (hi) {
        ctx.strokeStyle = color || '#ffe27a';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    },

    _drawHUD() {
      const s = ST.Modes.session;
      if (!s) return;

      // ── 1행: 좌 턴 라벨 칩 / 우 점수 칩 (상단 밴드 안, 벽과 분리)
      ctx.font = '700 16px "Malgun Gothic", sans-serif';
      const tw = ctx.measureText(this.turnLabel).width;
      this._chip(10, 9, tw + 24, 30, false);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillText(this.turnLabel, 22, 30);

      if (this.ts || this.state === 'simul') {
        let scoreTxt = '0';
        if (this.ts) scoreTxt = Math.round(this.ts.holdScore + this.ts.throwBonus).toLocaleString();
        ctx.font = '900 24px "Malgun Gothic", sans-serif';
        const sw = Math.max(64, ctx.measureText(scoreTxt).width + 28);
        this._chip(470 - sw, 9, sw, 32, false);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffe27a';
        ctx.fillText(scoreTxt, 456, 34);
        if (this.state === 'stuck' && this.stuckSt) {
          ctx.font = '700 15px "Malgun Gothic", sans-serif';
          const ht = '⏱ ' + this.stuckSt.holdTime.toFixed(1) + 's ×' + this.curMult;
          const hw = ctx.measureText(ht).width + 22;
          this._chip(470 - hw, 45, hw, 26, false);
          ctx.fillStyle = '#8ad6ff';
          ctx.fillText(ht, 459, 64);
        }
      }

      // ── 2행: 플레이어 칩 가로 나열 (시뮬 중 실시간 합산)
      ctx.font = '700 13px "Malgun Gothic", sans-serif';
      let xx = 10;
      let yy = 46;
      s.players.forEach((pl, i) => {
        let tot = pl.total;
        let liveNow = false;
        if (this.state === 'simul' && this.multi) {
          const m = this.multi.find((mm) => mm.player === i);
          if (m) {
            tot += m.done ? (m.result || 0) : Math.round(m.ts.holdScore + m.ts.throwBonus);
            liveNow = !m.done;
          }
        }
        const hi = this.state === 'simul' ? liveNow : i === s.cur;
        const label = pl.name + ' ' + tot.toLocaleString();
        const w = ctx.measureText(label).width + 30;
        if (xx + w > 470) { xx = 10; yy += 30; }
        this._chip(xx, yy, w, 26, hi, pl.color);
        ctx.beginPath();
        ctx.fillStyle = pl.color;
        ctx.arc(xx + 13, yy + 13, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.textAlign = 'left';
        ctx.fillStyle = hi ? '#fff' : 'rgba(255,255,255,0.6)';
        ctx.fillText(label, xx + 23, yy + 18);
        xx += w + 8;
      });
    },
  };

  ST.Game = Game;

  // ---------------- 메인 루프 ----------------
  let last = performance.now();
  let lastW = 0, lastH = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    // 뷰포트 변화 감지 (iframe/pane 표시 지연, itch.io 임베드 대응)
    if (window.innerWidth !== lastW || window.innerHeight !== lastH) {
      lastW = window.innerWidth; lastH = window.innerHeight;
      if (lastW > 0 && lastH > 0) resize();
    }
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;

    if (ST.FX.hitstop > 0) {
      ST.FX.hitstop -= dt;
    } else {
      Game.update(dt);
      ST.FX.update(dt);
      ST.Score.updateFloaters(dt);
    }
    Game.render();
  }

  // ---------------- 부트 ----------------
  function boot() {
    resize();
    ST.Input.init(canvas);
    Game.bindInput();
    Game.setup('man', 'room'); // 타이틀 뒤 배경 씬
    ST.UI.init();
    requestAnimationFrame((t) => { last = t; requestAnimationFrame(loop); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
