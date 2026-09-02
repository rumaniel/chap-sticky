/* 찐득이 토스 - 물리: 유사3D 투영, 포사체+Magnus 비행, 이펙트(파티클/셰이크/히트스탑)
 * 월드 단위: 미터. x 우측+, y 위+, z 화면 안쪽+(벽 방향)
 */
window.ST = window.ST || {};

(function () {
  // 튜닝 상수 -------------------------------------------------------
  const TUNE = {
    WALL_Z: 3.0,        // 벽까지 거리
    WALL_W: 3.2,        // 벽 폭 (m)
    WALL_H: 2.73,       // 벽 높이 (m) — 상단 HUD 밴드 확보
    WALL_BOTTOM: 0.30,  // 벽 하단 y (m)
    CAM_H: 1.40,        // 카메라 높이
    FOCAL: 1.9,
    PPM: 355,           // z=0 기준 픽셀/미터
    HORIZON: 310,       // 카메라 축의 화면 y (가상 좌표)
    GRAVITY: 9.8,
    MAGNUS: 0.013,      // 커브 계수
    SPIN_DECAY: 0.12,
    HOLD_Z: 0.45,       // 조준 중 찐득이 깊이
    // 던지기 변환 (스크린 px/ms → m/s)
    KZ: 4.4, KY: 3.4, KX: 2.6,
    VZ_MIN: 3.2, VZ_MAX: 12.5,
    KSPIN: 1.05, SPIN_MAX: 32,   // rad/s
  };

  const Physics = {
    TUNE,

    // 투영: 월드(x,y,z) → 화면(sx, sy, scale)
    project(x, y, z) {
      const p = TUNE.FOCAL / (TUNE.FOCAL + z);
      return {
        x: ST.view.cx + x * TUNE.PPM * p,
        y: TUNE.HORIZON + (TUNE.CAM_H - y) * TUNE.PPM * p,
        s: p,
      };
    },

    // 역투영: 화면(sx,sy) → 깊이 z 평면의 월드(x,y)
    unproject(sx, sy, z) {
      const p = TUNE.FOCAL / (TUNE.FOCAL + z);
      return {
        x: (sx - ST.view.cx) / (TUNE.PPM * p),
        y: TUNE.CAM_H - (sy - TUNE.HORIZON) / (TUNE.PPM * p),
      };
    },

    // 벽 화면 사각형 (가상 좌표)
    wallRect() {
      const tl = this.project(-TUNE.WALL_W / 2, TUNE.WALL_BOTTOM + TUNE.WALL_H, TUNE.WALL_Z);
      const br = this.project(TUNE.WALL_W / 2, TUNE.WALL_BOTTOM, TUNE.WALL_Z);
      return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
    },

    // 월드 → 벽 로컬 픽셀 (벽 캐시 그리기용, 좌상단 0,0)
    worldToWallPx(x, y, wallPxW, wallPxH) {
      return {
        x: ((x + TUNE.WALL_W / 2) / TUNE.WALL_W) * wallPxW,
        y: ((TUNE.WALL_BOTTOM + TUNE.WALL_H - y) / TUNE.WALL_H) * wallPxH,
      };
    },

    // 던지기 입력 → 초기 속도
    makeThrow(flick, spinVel, holdWorld) {
      const speed = Math.hypot(flick.vx, flick.vy); // px/ms
      const vz = Math.min(TUNE.VZ_MAX, Math.max(TUNE.VZ_MIN, speed * TUNE.KZ));
      return {
        x: holdWorld.x, y: holdWorld.y, z: TUNE.HOLD_Z,
        vx: flick.vx * TUNE.KX,
        vy: -flick.vy * TUNE.KY,
        vz,
        spin: Math.max(-TUNE.SPIN_MAX, Math.min(TUNE.SPIN_MAX, spinVel * TUNE.KSPIN)),
        angle: 0,
      };
    },

    // 비행 적분. 결과: null(비행중) | {type:'wall'|'floor'|'past', ...}
    stepFlight(f, dt) {
      const N = 2; // 서브스텝
      for (let i = 0; i < N; i++) {
        const h = dt / N;
        const px = f.x, py = f.y, pz = f.z, pvx = f.vx, pvy = f.vy, pa = f.angle, pspin = f.spin;
        f.vy -= TUNE.GRAVITY * h;
        f.vx += TUNE.MAGNUS * f.spin * f.vz * h;
        f.spin *= 1 - TUNE.SPIN_DECAY * h;
        f.x += f.vx * h;
        f.y += f.vy * h;
        f.z += f.vz * h;
        f.angle += f.spin * h;

        if (f.z >= TUNE.WALL_Z) {
          // 벽면(z = WALL_Z)까지 서브스텝 안에서 선형 보간한다. 전에는 서브스텝 끝 상태를
          // 그대로 충돌 상태로 썼는데, 그러면 착탄 위치·속도가 프레임 길이에 따라 흔들린다 —
          // 100ms 히치 한 번이면 같은 던지기의 착탄 y 가 0.1m 까지 달라지고, 충격비 r 이
          // 서브스텝 경계마다 톱니처럼 뛰었다 (R15 적대적 리뷰). 보간하면 결정론적이다.
          const u = f.z > pz ? (TUNE.WALL_Z - pz) / (f.z - pz) : 1;
          f.x = px + (f.x - px) * u;
          f.y = py + (f.y - py) * u;
          f.vx = pvx + (f.vx - pvx) * u;
          f.vy = pvy + (f.vy - pvy) * u;
          f.angle = pa + (f.angle - pa) * u;
          // spin 도 충돌 시점까지만 감쇠 — resolveImpact 가 impact.spin/angle 로 패드 접촉을
          // 정하므로 여기만 서브스텝 끝 값이면 판정이 다시 dt 에 묶인다 (Copilot 지적).
          f.spin = pspin * (1 - TUNE.SPIN_DECAY * h * u);
          f.z = TUNE.WALL_Z;
          const inWall =
            f.x > -TUNE.WALL_W / 2 && f.x < TUNE.WALL_W / 2 &&
            f.y > TUNE.WALL_BOTTOM && f.y < TUNE.WALL_BOTTOM + TUNE.WALL_H;
          return inWall
            ? { type: 'wall', x: f.x, y: f.y, vx: f.vx, vy: f.vy, vz: f.vz, spin: f.spin, angle: f.angle }
            : { type: 'past', x: f.x, y: f.y, vx: f.vx, vy: f.vy, spin: f.spin, angle: f.angle };
        }
        if (f.y <= 0.04 && f.vy < 0) return { type: 'floor', x: f.x, z: f.z };
      }
      return null;
    },
  };

  // ==================== 이펙트 ====================
  const parts = [];
  const FX = {
    shake: 0, shakeX: 0, shakeY: 0,
    hitstop: 0,

    addShake(v) { this.shake = Math.min(18, this.shake + v); },
    addHitstop(sec) { this.hitstop = Math.max(this.hitstop, sec); },

    // 화면 좌표 파티클
    burst(x, y, n, opt) {
      opt = opt || {};
      for (let i = 0; i < n; i++) {
        const a = opt.angle != null ? opt.angle + (Math.random() - 0.5) * (opt.spread || 1.2) : Math.random() * Math.PI * 2;
        const sp = (opt.speed || 160) * (0.4 + Math.random() * 0.8);
        parts.push({
          x, y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 1, decay: 1 / ((opt.life || 0.5) * (0.6 + Math.random() * 0.7)),
          r: (opt.size || 5) * (0.5 + Math.random()),
          color: opt.color || '#c7f77a',
          grav: opt.grav != null ? opt.grav : 500,
        });
      }
    },

    update(dt) {
      if (this.shake > 0.2) {
        this.shakeX = (Math.random() - 0.5) * this.shake;
        this.shakeY = (Math.random() - 0.5) * this.shake;
        this.shake *= Math.pow(0.001, dt); // 빠른 감쇠
      } else { this.shake = 0; this.shakeX = 0; this.shakeY = 0; }

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= p.decay * dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.vy += p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    },

    draw(ctx) {
      for (const p of parts) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },

    clear() { parts.length = 0; this.shake = 0; this.hitstop = 0; },
  };

  ST.Physics = Physics;
  ST.FX = FX;
})();
