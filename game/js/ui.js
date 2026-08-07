/* 찐득이 토스 - DOM UI: 타이틀/모드/파티설정/선택/결과/리더보드 */
window.ST = window.ST || {};

(function () {
  const $ = (id) => document.getElementById(id);
  let partyN = 2;
  let throwsN = 5;
  let simMode = true;
  let nextMode = 'practice';
  let titleAnim = null;

  ST.sel = { shape: 'man', map: 'room' };

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
      const t = (performance.now() - t0) / 1000;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.save();
      ctx.translate(cv.width / 2, cv.height / 2 + Math.sin(t * 2) * 5);
      ctx.rotate(Math.sin(t * 1.3) * 0.12);
      ST.Shapes.get('man').draw(ctx, 46, { wob: 0.5, t, mood: 'happy' });
      ctx.restore();
      titleAnim = requestAnimationFrame(loop);
    })();
  }
  function stopTitleAnim() { cancelAnimationFrame(titleAnim); }

  function buildCards() {
    const earned = ST.Score.earned();
    const mk = (wrap, defs, kind) => {
      wrap.innerHTML = '';
      defs.forEach((d) => {
        const locked = !ST.Score.unlocked(d);
        const el = document.createElement('div');
        el.className = 'card' + (locked ? ' lock' : '') + (ST.sel[kind] === d.id ? ' sel' : '');
        const cv = document.createElement('canvas');
        cv.width = 72; cv.height = 72;
        el.appendChild(cv);
        const nm = document.createElement('div');
        nm.className = 'nm';
        nm.textContent = locked ? '🔒 ' + d.name : d.name;
        el.appendChild(nm);
        const ds = document.createElement('div');
        ds.className = 'desc';
        ds.textContent = locked ? '누적 ' + d.unlock.toLocaleString() + '점 해금' : d.desc;
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
      // 진행도 힌트
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.style.width = '100%';
      hint.textContent = '누적 획득 점수: ' + earned.toLocaleString() + '점';
      if (kind === 'map') wrap.appendChild(hint);
    };
    mk($('shapeCards'), ST.Shapes.list, 'shape');
    mk($('mapCards'), ST.Materials.list, 'map');
  }

  const UI = {
    show,
    showGame() {
      stopTitleAnim();
      $('overlay').classList.remove('show');
      $('sndToggle').classList.add('show');
    },

    showResult(session) {
      show('scr-result');
      const p0 = session.players[0];
      if (session.mode === 'practice') {
        $('resTitle').textContent = '🎯 라운드 결과';
        $('resScore').textContent = p0.total.toLocaleString() + '점';
        $('resSub').innerHTML = '최고 버티기 <b>' + p0.bestHold.toFixed(1) + '초</b> · ' +
          session.throwsPer + '구 합산';
        let html = '<table class="rtable"><tr><th>구</th><th>점수</th><th>버티기</th></tr>';
        p0.throws.forEach((t, i) => {
          html += '<tr><td>' + (i + 1) + '</td><td>' + t.total.toLocaleString() +
            '</td><td>' + (t.holdTime || 0).toFixed(1) + 's</td></tr>';
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
        $('resTitle').textContent = '🎉 파티 결과';
        $('resScore').textContent = '👑 ' + ranked[0].name;
        $('resSub').textContent = ranked[0].total.toLocaleString() + '점으로 우승!';
        let html = '<table class="rtable"><tr><th>순위</th><th>이름</th><th>점수</th><th>최고 버티기</th></tr>';
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
        $('boardWrap').innerHTML = '<div class="hint">아직 기록이 없다.<br>연습 모드에서 기록을 남겨보자!</div>';
        return;
      }
      let html = '<table class="rtable"><tr><th>#</th><th>이름</th><th>점수</th><th>버티기</th><th>구성</th></tr>';
      list.forEach((e, i) => {
        html += '<tr><td>' + (i + 1) + '</td><td>' + e.name + '</td><td>' +
          e.score.toLocaleString() + '</td><td>' + (e.holdTime || 0).toFixed(1) + 's</td><td>' +
          ST.Shapes.get(e.shape).name + '·' + ST.Materials.get(e.map).name + '</td></tr>';
      });
      html += '</table>';
      $('boardWrap').innerHTML = html;
    },

    init() {
      const wire = (id, fn) => $(id).addEventListener('click', () => { ST.Audio.unlock(); ST.Audio.play('ui'); fn(); });

      wire('btnStart', () => show('scr-mode'));
      wire('btnBoard', () => this.showBoard());
      wire('btnBoardBack', () => show('scr-title'));
      wire('btnModeBack', () => show('scr-title'));
      const setThrows = (n) => {
        throwsN = Math.max(1, Math.min(10, n));
        $('tCount').textContent = throwsN;
      };
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
      wire('btnSimToggle', () => {
        simMode = !simMode;
        $('btnSimToggle').textContent = '🎬 동시 결과: ' + (simMode ? 'ON' : 'OFF');
      });

      $('btnSaveScore').addEventListener('click', () => {
        ST.Audio.play('ui');
        const name = ($('nameInput').value || '찐득이').trim().slice(0, 8);
        if (this._pending) {
          const rank = ST.Score.addBoard(Object.assign({ name }, this._pending));
          this._pending = null;
          $('btnSaveScore').disabled = true;
          $('nameEntry').style.display = 'none';
          $('resSub').innerHTML = rank > 0
            ? '🏆 리더보드 <b>' + rank + '위</b> 등극!'
            : '기록 저장 완료!';
        }
      });

      $('sndToggle').addEventListener('click', () => {
        const m = ST.Audio.toggleMute();
        $('sndToggle').textContent = m ? '🔇' : '🔊';
      });

      // 첫 터치에서 오디오 언락 (모바일)
      window.addEventListener('pointerdown', () => ST.Audio.unlock(), { once: true });

      show('scr-title');
    },
  };

  ST.UI = UI;
})();
