/* 찐득이 토스 - 벽 머테리얼/맵 레지스트리
 * mat: grip(접착 배율), decay(그립 감쇠/초), flipPeriod(크롤 회전 주기 s),
 *      slideStep(플립당 하강 배율), slideCont(연속 미끄러짐 px/s), bounce(튕김 반발)
 * rings: 과녁 (벽 정규화 좌표, 반경은 min(w,h) 비율), mults 배율
 * spots: 보너스 스팟
 */
window.ST = window.ST || {};

(function () {
  const MAPS = {

    // ============ 거실 벽 (기본) ============
    room: {
      id: 'room', name: '거실 벽', desc: '무난한 벽지 · 표준 그립', unlock: 0,
      mat: { grip: 1.0, decay: 0.055, flipPeriod: 1.15, slideStep: 1.0, slideCont: 0, bounce: 0.5 },
      skyColor: '#3a2f5c', floorColor: ['#6b5b3e', '#4a3d28'],
      rings: { cx: 0.5, cy: 0.50, radii: [0.10, 0.20, 0.31, 0.44], mults: [5, 3, 2, 1] },
      spots: [
        { x: 0.14, y: 0.16, r: 0.055, bonus: 150, icon: '★' },
        { x: 0.86, y: 0.62, r: 0.055, bonus: 150, icon: '★' },
      ],
      drawWall(ctx, W, H) {
        // 크림 벽지 + 세로 스트라이프
        ctx.fillStyle = '#efe3c8';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(180,150,110,0.18)';
        const sw = W / 11;
        for (let i = 0; i < 11; i += 2) ctx.fillRect(i * sw, 0, sw, H);
        // 잔잔한 도트 패턴
        ctx.fillStyle = 'rgba(160,120,80,0.15)';
        for (let y = 20; y < H; y += 46) {
          for (let x = 18 + (y % 92 === 20 ? 0 : 23); x < W; x += 46) {
            ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
          }
        }
        // 걸레받이
        ctx.fillStyle = '#c9b28a';
        ctx.fillRect(0, H - 14, W, 14);
      },
    },

    // ============ 유리창 ============
    glass: {
      id: 'glass', name: '유리창', desc: '미끌미끌! 살살 던져야 붙는다', unlock: 3000,
      mat: { grip: 0.85, decay: 0.085, flipPeriod: 0.85, slideStep: 1.25, slideCont: 26, bounce: 0.62 },
      skyColor: '#274a73', floorColor: ['#5a6b7d', '#3a4757'],
      rings: { cx: 0.5, cy: 0.50, radii: [0.10, 0.20, 0.31, 0.44], mults: [6, 4, 2, 1] },
      spots: [
        { x: 0.18, y: 0.70, r: 0.055, bonus: 200, icon: '🐦' },
        { x: 0.82, y: 0.18, r: 0.055, bonus: 200, icon: '☀' },
      ],
      drawWall(ctx, W, H) {
        // 하늘 그라디언트
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#8ec9f0'); g.addColorStop(0.6, '#bfe3f7'); g.addColorStop(1, '#e8f6ff');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        // 구름
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        [[0.25, 0.22], [0.7, 0.5], [0.45, 0.78]].forEach(([nx, ny]) => {
          const x = nx * W, y = ny * H;
          ctx.beginPath();
          ctx.arc(x, y, 22, 0, Math.PI * 2);
          ctx.arc(x + 24, y + 4, 16, 0, Math.PI * 2);
          ctx.arc(x - 24, y + 6, 14, 0, Math.PI * 2);
          ctx.fill();
        });
        // 반사 스트릭
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 10;
        [[0.15, 0.35], [0.3, 0.55]].forEach(([a, b]) => {
          ctx.beginPath();
          ctx.moveTo(W * a, -10); ctx.lineTo(W * a - H * 0.35, H + 10);
          ctx.stroke();
        });
        // 창틀 십자
        ctx.fillStyle = '#7a5a3a';
        ctx.fillRect(W / 2 - 7, 0, 14, H);
        ctx.fillRect(0, H / 2 - 7, W, 14);
      },
    },

    // ============ 칠판 ============
    chalk: {
      id: 'chalk', name: '교실 칠판', desc: '착착 붙는다 · 오래 버티기 명당', unlock: 10000,
      mat: { grip: 1.3, decay: 0.032, flipPeriod: 1.4, slideStep: 0.85, slideCont: 0, bounce: 0.42 },
      skyColor: '#4a3b2a', floorColor: ['#8a7355', '#5f4d36'],
      rings: { cx: 0.5, cy: 0.50, radii: [0.10, 0.20, 0.31, 0.44], mults: [4, 3, 2, 1] },
      spots: [
        { x: 0.15, y: 0.20, r: 0.06, bonus: 120, icon: '100' },
        { x: 0.85, y: 0.24, r: 0.06, bonus: 120, icon: 'A+' },
      ],
      drawWall(ctx, W, H) {
        ctx.fillStyle = '#2e5c46';
        ctx.fillRect(0, 0, W, H);
        // 분필 자국
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 6]);
        ctx.beginPath(); ctx.arc(W * 0.22, H * 0.6, 30, 0, Math.PI * 1.6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W * 0.65, H * 0.72); ctx.lineTo(W * 0.85, H * 0.72); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '24px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText('찐득', W * 0.68, H * 0.6);
        ctx.fillText('1 + 1 = ?', W * 0.12, H * 0.82);
        // 나무 테두리 + 분필 받침
        ctx.strokeStyle = '#8a6a44';
        ctx.lineWidth = 16;
        ctx.strokeRect(8, 8, W - 16, H - 16);
        ctx.fillStyle = '#a5824f';
        ctx.fillRect(W * 0.3, H - 20, W * 0.4, 12);
      },
    },

    // ============ 냉장고 ============
    fridge: {
      id: 'fridge', name: '냉장고', desc: '자석 스팟 대박 보너스!', unlock: 20000,
      mat: { grip: 0.9, decay: 0.05, flipPeriod: 1.05, slideStep: 1.0, slideCont: 4, bounce: 0.55 },
      skyColor: '#2d3f4a', floorColor: ['#8f9aa5', '#5d6771'],
      rings: { cx: 0.5, cy: 0.46, radii: [0.09, 0.18, 0.29, 0.42], mults: [5, 3, 2, 1] },
      spots: [
        { x: 0.2, y: 0.14, r: 0.06, bonus: 300, icon: '🧲' },
        { x: 0.8, y: 0.30, r: 0.06, bonus: 300, icon: '🧲' },
        { x: 0.28, y: 0.72, r: 0.06, bonus: 300, icon: '🧲' },
      ],
      drawWall(ctx, W, H) {
        const g = ctx.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, '#e8edf2'); g.addColorStop(0.5, '#f7fafc'); g.addColorStop(1, '#d5dde5');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        // 냉동/냉장 분리선 + 손잡이
        ctx.fillStyle = '#b8c2cc';
        ctx.fillRect(0, H * 0.3 - 3, W, 6);
        ctx.fillStyle = '#8f9aa5';
        ctx.beginPath();
        ctx.roundRect(W - 34, H * 0.34, 14, H * 0.3, 7);
        ctx.fill();
        // 메모지
        ctx.save();
        ctx.translate(W * 0.62, H * 0.55);
        ctx.rotate(0.06);
        ctx.fillStyle = '#fff7ae';
        ctx.fillRect(-34, -30, 76, 68);
        ctx.fillStyle = '#888';
        ctx.font = '12px sans-serif';
        ctx.fillText('우유 사기', -24, -6);
        ctx.fillText('찐득이 금지', -24, 14);
        ctx.restore();
      },
    },
  };

  ST.Materials = {
    all: MAPS,
    list: ['room', 'glass', 'chalk', 'fridge'].map((k) => MAPS[k]),
    get(id) { return MAPS[id] || MAPS.room; },

    // 맵 미리보기 카드
    preview(canvas, id) {
      const ctx = canvas.getContext('2d');
      const m = ST.Materials.get(id);
      canvas.width = 72; canvas.height = 72;
      m.drawWall(ctx, 72, 72);
      // 미니 과녁
      const r = m.rings;
      ctx.strokeStyle = 'rgba(230,70,70,0.8)';
      ctx.lineWidth = 2;
      [0.32, 0.18, 0.07].forEach((rr) => {
        ctx.beginPath();
        ctx.arc(r.cx * 72, r.cy * 72, rr * 72, 0, Math.PI * 2);
        ctx.stroke();
      });
    },
  };
})();
