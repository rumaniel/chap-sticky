/* 찐득이 토스 - DOM UI (전 스트링 i18n) */
window.ST = window.ST || {};

(function () {
  const $ = (id) => document.getElementById(id);
  const t = (...a) => ST.I18N.t(...a);
  let partyN = 2;
  let throwsN = 5;
  let simMode = true;
  let nextMode = 'practice';
  let titleAnim = null;

  ST.sel = { shape: 'man', map: 'chalk' }; // 첫 맵 = 관대한 칠판 (튜토리얼 역할)

  function show(id) {
    $('overlay').classList.add('show');
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('show'));
    $(id).classList.add('show');
    if (id === 'scr-title') startTitleAnim(); else stopTitleAnim();
  }

  function startTitleAnim() {
    const cv = $('titleToy');
    const ctx = cv.getContext('2d');
    const t0 = performance.now();
    cancelAnimationFrame(titleAnim);
    (function loop() {
      const tt = (performance.now() - t0) / 1000;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.save();
      ctx.translate(cv.width / 2, cv.height / 2 + Math.sin(tt * 2) * 5);
      ctx.rotate(Math.sin(tt * 1.3) * 0.12);
      ST.Shapes.get('man').draw(ctx, 46, { wob: 0.5, t: tt, mood: 'happy' });
      ctx.restore();
      titleAnim = requestAnimationFrame(loop);
    })();
  }
  function stopTitleAnim() { cancelAnimationFrame(titleAnim); }

  function updateSimToggle() {
    $('btnSimToggle').textContent = t('party.sim', t(simMode ? 'common.on' : 'common.off'));
  }
  function updateLangBtn() {
    $('langToggle').textContent = ST.I18N.lang === 'ko' ? 'EN' : '한';
  }

  function buildCards() {
    const earned = ST.Score.earned();
    const mk = (wrap, defs, kind) => {
      wrap.innerHTML = '';
      defs.forEach((d) => {
        const kindKey = kind === 'shape' ? 'shape.' : 'map.';
        const locked = !ST.Score.unlocked(d);
        const el = document.createElement('div');
        el.className = 'card' + (locked ? ' lock' : '') + (ST.sel[kind] === d.id ? ' sel' : '');
        const cv = document.createElement('canvas');
        cv.width = 72; cv.height = 72;
        el.appendChild(cv);
        const nm = document.createElement('div');
        nm.className = 'nm';
        nm.textContent = (locked ? '🔒 ' : '') + t(kindKey + d.id + '.name');
        el.appendChild(nm);
        const ds = document.createElement('div');
        ds.className = 'desc';
        ds.textContent = locked ? t('sel.lock', d.unlock.toLocaleString()) : t(kindKey + d.id + '.desc');
        el.appendChild(ds);
        if (kind === 'shape') ST.Shapes.preview(cv, d.id);
        else ST.Materials.preview(cv, d.id);
        el.addEventListener('click', () => {
          ST.Audio.unlock();
          if (locked) { ST.Audio.play('tick'); return; }
          ST.Audio.play('ui');
          ST.sel[kind] = d.id;
          buildCards();
        });
        wrap.appendChild(el);
      });
      if (kind === 'map') {
        const hint = document.createElement('div');
        hint.className = 'hint';
        hint.style.width = '100%';
        hint.textContent = t('sel.earned', earned.toLocaleString());
        wrap.appendChild(hint);
      }
    };
    mk($('shapeCards'), ST.Shapes.list, 'shape');
    mk($('mapCards'), ST.Materials.list, 'map');
  }

  // 화면별 상위 화면. scr-select 는 진입 경로에 따라 갈리므로 back()에서 따로 처리한다.
  const BACK_PARENT = {
    'scr-mode': 'scr-title',
    'scr-party': 'scr-mode',
    'scr-board': 'scr-title',
    'scr-result': 'scr-title',
  };
  const BACK_WINDOW_MS = 2000;
  let backArmedAt = 0;

  // 되돌릴 수 없는 뒤로가기(라운드 포기·앱 종료)는 2초 안에 두 번 눌러야 한다.
  function armBack() {
    const now = performance.now();
    if (now - backArmedAt < BACK_WINDOW_MS) { backArmedAt = 0; return true; }
    backArmedAt = now;
    return false;
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  const UI = {
    show,
    toast,
    showGame() {
      stopTitleAnim();
      $('overlay').classList.remove('show');
    },

    showResult(session) {
      show('scr-result');
      const p0 = session.players[0];
      if (session.mode === 'practice') {
        $('resTitle').textContent = t('res.practice');
        $('resScore').textContent = t('res.points', p0.total.toLocaleString());
        $('resSub').innerHTML = t('res.bestHold', p0.bestHold.toFixed(1), session.throwsPer);
        let html = '<table class="rtable"><tr><th>' + t('th.throw') + '</th><th>' + t('th.score') + '</th><th>' + t('th.hold') + '</th></tr>';
        p0.throws.forEach((tr, i) => {
          html += '<tr><td>' + (i + 1) + '</td><td>' + tr.total.toLocaleString() +
            '</td><td>' + (tr.holdTime || 0).toFixed(1) + 's</td></tr>';
        });
        html += '</table>';
        $('resTableWrap').innerHTML = html;
        const canRank = p0.total > 0;
        $('nameEntry').style.display = canRank ? 'flex' : 'none';
        $('nameInput').value = '';
        $('btnSaveScore').disabled = false;
        this._pending = { score: p0.total, holdTime: p0.bestHold, shape: session.shapeId, map: session.mapId };
      } else {
        const ranked = session.players.slice().sort((a, b) => b.total - a.total);
        $('resTitle').textContent = t('res.party');
        $('resScore').textContent = '👑 ' + ranked[0].name;
        $('resSub').textContent = t('res.winnerSub', ranked[0].total.toLocaleString());
        let html = '<table class="rtable"><tr><th>' + t('th.rank') + '</th><th>' + t('th.name') + '</th><th>' + t('th.score') + '</th><th>' + t('th.bestHold') + '</th></tr>';
        ranked.forEach((p, i) => {
          html += '<tr' + (i === 0 ? ' class="me"' : '') + '><td>' + (i + 1) + '</td><td>' +
            '<span style="color:' + p.color + '">●</span> ' + p.name + '</td><td>' +
            p.total.toLocaleString() + '</td><td>' + p.bestHold.toFixed(1) + 's</td></tr>';
        });
        html += '</table>';
        $('resTableWrap').innerHTML = html;
        $('nameEntry').style.display = 'none';
      }
    },

    showBoard() {
      show('scr-board');
      const list = ST.Score.top();
      if (!list.length) {
        $('boardWrap').innerHTML = '<div class="hint">' + t('board.empty') + '</div>';
        return;
      }
      let html = '<table class="rtable"><tr><th>#</th><th>' + t('th.name') + '</th><th>' + t('th.score') + '</th><th>' + t('th.hold') + '</th><th>' + t('th.combo') + '</th></tr>';
      list.forEach((e, i) => {
        html += '<tr><td>' + (i + 1) + '</td><td>' + e.name + '</td><td>' +
          e.score.toLocaleString() + '</td><td>' + (e.holdTime || 0).toFixed(1) + 's</td><td>' +
          t('shape.' + e.shape + '.name') + '·' + t('map.' + e.map + '.name') + '</td></tr>';
      });
      html += '</table>';
      $('boardWrap').innerHTML = html;
    },

    /* Android 뒤로가기 진입점. 처리했으면 true, 최상위(타이틀)면 false 를 돌려주고
     * 앱 종료 여부는 플랫폼 셸이 결정하게 둔다. 웹에서는 호출되지 않는다. */
    back() {
      // 오버레이가 닫혀 있으면 플레이 중이다. 실수로 라운드를 날리지 않게 두 번 눌러야 한다.
      if (!$('overlay').classList.contains('show')) {
        if (!armBack()) { toast(t('back.toMenu')); return true; }
        ST.Modes.toTitle();
        return true;
      }
      const cur = document.querySelector('.screen.show');
      const id = cur ? cur.id : 'scr-title';
      if (id === 'scr-select') { show(nextMode === 'party' ? 'scr-party' : 'scr-mode'); return true; }
      const parent = BACK_PARENT[id];
      if (parent) { show(parent); return true; }
      if (!armBack()) { toast(t('back.exit')); return true; }
      return false;
    },

    // 언어 전환 시 열려 있는 동적 화면 갱신
    onLangChange() {
      updateSimToggle();
      updateLangBtn();
      if ($('scr-select').classList.contains('show')) buildCards();
      if ($('scr-board').classList.contains('show')) this.showBoard();
    },

    init() {
      ST.I18N.applyDOM();
      updateSimToggle();
      updateLangBtn();

      const wire = (id, fn) => $(id).addEventListener('click', () => { ST.Audio.unlock(); ST.Audio.play('ui'); fn(); });

      const setThrows = (n) => {
        throwsN = Math.max(1, Math.min(10, n));
        $('tCount').textContent = throwsN;
      };
      wire('btnStart', () => show('scr-mode'));
      wire('btnBoard', () => this.showBoard());
      wire('btnBoardBack', () => show('scr-title'));
      wire('btnModeBack', () => show('scr-title'));
      wire('btnPractice', () => { nextMode = 'practice'; setThrows(5); buildCards(); show('scr-select'); });
      wire('btnParty', () => { show('scr-party'); });
      wire('btnPartyBack', () => show('scr-mode'));
      wire('btnPartyGo', () => { nextMode = 'party'; setThrows(3); buildCards(); show('scr-select'); });
      wire('btnSelBack', () => show(nextMode === 'party' ? 'scr-party' : 'scr-mode'));
      wire('btnPlay', () => {
        if (nextMode === 'party') ST.Modes.startParty(partyN, ST.sel.shape, ST.sel.map, throwsN, simMode);
        else ST.Modes.startPractice(ST.sel.shape, ST.sel.map, throwsN);
      });
      wire('btnRetry', () => ST.Modes.retry());
      wire('btnResMenu', () => show('scr-title'));
      wire('pMinus', () => { partyN = Math.max(2, partyN - 1); $('pCount').textContent = partyN; });
      wire('pPlus', () => { partyN = Math.min(8, partyN + 1); $('pCount').textContent = partyN; });
      wire('tMinus', () => setThrows(throwsN - 1));
      wire('tPlus', () => setThrows(throwsN + 1));
      wire('btnSimToggle', () => { simMode = !simMode; updateSimToggle(); });
      wire('langToggle', () => ST.I18N.toggle());

      $('btnSaveScore').addEventListener('click', () => {
        ST.Audio.play('ui');
        const name = ($('nameInput').value || t('player.me')).trim().slice(0, 8);
        if (this._pending) {
          const rank = ST.Score.addBoard(Object.assign({ name }, this._pending));
          this._pending = null;
          $('btnSaveScore').disabled = true;
          $('nameEntry').style.display = 'none';
          $('resSub').innerHTML = rank > 0 ? t('res.savedRank', rank) : t('res.savedOk');
        }
      });

      $('sndToggle').addEventListener('click', () => {
        const m = ST.Audio.toggleMute();
        $('sndToggle').textContent = m ? '🔇' : '🔊';
      });

      window.addEventListener('pointerdown', () => ST.Audio.unlock(), { once: true });

      show('scr-title');
    },
  };

  ST.UI = UI;
})();
