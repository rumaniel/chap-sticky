/* 찐득이 토스 - WebAudio 프로시저럴 사운드 (외부 파일 0개 = file:// 안전 + 저작권 클린) */
window.ST = window.ST || {};

(function () {
  let ctx = null;
  let master = null;
  let bgmGain = null;
  let muted = false;
  let bgmTimer = null;
  let noiseBuf = null;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      bgmGain = ctx.createGain();
      bgmGain.gain.value = 0.16;
      bgmGain.connect(master);
      // 노이즈 버퍼
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return ctx;
  }

  function now() { return ctx.currentTime; }

  // 기본 톤: type, 주파수(시작→끝), 길이, 볼륨, 필터
  function tone(type, f0, f1, dur, vol, opt) {
    if (!ctx || muted) return;
    opt = opt || {};
    const t = now() + (opt.delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (opt.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(opt.dest || master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, f0, f1, opt) {
    if (!ctx || muted) return;
    opt = opt || {};
    const t = now() + (opt.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = opt.type || 'bandpass';
    flt.Q.value = opt.q || 1.2;
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (opt.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  const SFX = {
    ui() { tone('square', 660, 880, 0.08, 0.12); },
    grab() { tone('sine', 300, 380, 0.06, 0.1); },
    spin() { tone('sine', 500 + Math.random() * 300, 700, 0.05, 0.05); },
    // 스핀 슉슉 (홀드 중 강하게, 비행 중 약하게)
    swish(vol) { noise(0.09, vol || 0.28, 1100, 3400, { q: 1.6, attack: 0.012 }); },
    // 포인트 분리 "뽁"
    pop() { tone('sine', 420 + Math.random() * 120, 900, 0.06, 0.3, { attack: 0.004 }); },
    // 너무 셈: 낮은 부정 스팅
    stingBad() { tone('sawtooth', 220, 210, 0.28, 0.16); tone('sawtooth', 233, 222, 0.28, 0.16); },
    // 너무 약함: 하강 2음
    sadDrop() { tone('triangle', 392, 392, 0.18, 0.2); tone('triangle', 311, 300, 0.3, 0.2, { delay: 0.16 }); },
    // 좋은 부착 "띠링"
    goodStick() { tone('sine', 660, 660, 0.12, 0.2, { delay: 0.05 }); tone('sine', 990, 990, 0.18, 0.2, { delay: 0.14 }); },
    // 커브 성공 스파클
    curveHit() { [740, 932, 1244, 1480].forEach((f, i) => tone('sine', f, f * 1.02, 0.12, 0.16, { delay: i * 0.045 })); },
    whoosh() { noise(0.28, 0.5, 500, 3200, { q: 0.9, attack: 0.02 }); },
    splat() {
      tone('sine', 260, 60, 0.22, 0.6, { attack: 0.004 });
      noise(0.14, 0.5, 2500, 500, { attack: 0.004 });
    },
    perfect() {
      [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.22, 0.22, { delay: i * 0.06 }));
    },
    bounce() { tone('sine', 500, 140, 0.3, 0.4); tone('sine', 250, 70, 0.3, 0.3); },
    flip() { tone('sine', 340 + Math.random() * 80, 240, 0.1, 0.22); },
    land() { tone('sine', 190, 120, 0.09, 0.28); },
    slip() { tone('sawtooth', 1300, 1900, 0.07, 0.045, { attack: 0.02 }); },
    peel() { noise(0.3, 0.35, 800, 2600, { q: 2.5 }); tone('sine', 400, 800, 0.25, 0.15); },
    fallWhistle() { tone('sine', 1200, 300, 0.7, 0.16); },
    thud() { tone('sine', 120, 45, 0.25, 0.6, { attack: 0.003 }); noise(0.1, 0.3, 300, 80); },
    spot() { [880, 1175, 1568].forEach((f, i) => tone('sine', f, f, 0.14, 0.2, { delay: i * 0.05 })); },
    tick() { tone('sine', 990, 990, 0.03, 0.05); },
    fanfare() {
      [392, 523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.3, 0.25, { delay: i * 0.1 }));
      noise(0.5, 0.15, 3000, 6000, { delay: 0.4 });
    },
    turn() { tone('triangle', 523, 523, 0.12, 0.2); tone('triangle', 784, 784, 0.15, 0.2, { delay: 0.12 }); },
  };

  // ---------------- BGM: 잔잔한 코드 루프 ----------------
  const CHORDS = [
    [220.0, 277.2, 329.6],  // A
    [174.6, 220.0, 261.6],  // F
    [196.0, 246.9, 293.7],  // G
    [164.8, 207.7, 246.9],  // E
  ];
  let chordIdx = 0;

  function bgmStep() {
    if (!ctx || muted) return;
    const ch = CHORDS[chordIdx % CHORDS.length];
    chordIdx++;
    ch.forEach((f, i) => {
      tone('triangle', f, f, 2.3, 0.10, { delay: i * 0.03, dest: bgmGain, attack: 0.4 });
      tone('sine', f * 2, f * 2, 2.3, 0.05, { delay: i * 0.03, dest: bgmGain, attack: 0.5 });
    });
    // 가벼운 펜타토닉 플럭
    if (Math.random() < 0.7) {
      const penta = [440, 523.3, 587.3, 659.3, 784];
      const n = penta[(Math.random() * penta.length) | 0];
      tone('sine', n, n, 0.5, 0.06, { delay: 0.8 + Math.random() * 1.0, dest: bgmGain });
    }
  }

  ST.Audio = {
    sfx: SFX,
    unlock() {
      const c = ac();
      if (c && c.state === 'suspended') c.resume();
      if (c && !bgmTimer) {
        bgmStep();
        bgmTimer = setInterval(bgmStep, 2400);
      }
    },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    play(name) {
      if (!ctx || muted) return;
      if (SFX[name]) SFX[name]();
    },
  };
})();
