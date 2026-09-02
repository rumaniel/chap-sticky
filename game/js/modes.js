/* 찐득이 토스 - 모드 흐름: 연습 / 파티 핫시트 (턴 로테이션 + 동시 크롤 시뮬 옵션)
 * simMode(파티): 각 턴은 착지까지만 → 라운드 전원 완료 시 전원 동시 크롤 시뮬
 */
window.ST = window.ST || {};

(function () {
  const PLAYER_COLORS = ['#7ed957', '#8ad6ff', '#ffb3f2', '#ffd94f', '#ff9d76', '#b9a5f5', '#7affd4', '#ff8a8a'];

  let session = null;

  const Modes = {
    get session() { return session; },

    startPractice(shapeId, mapId, throwsN) {
      session = {
        mode: 'practice',
        shapeId, mapId,
        players: [{ name: ST.I18N.t('player.me'), color: PLAYER_COLORS[0], throws: [], total: 0, bestHold: 0 }],
        throwsPer: throwsN || 5,
        cur: 0, round: 0,
        markers: [],
        pending: [],
        simMode: false,
        done: false,
      };
      this._beginTurn();
    },

    startParty(n, shapeId, mapId, throwsN, simMode) {
      session = {
        mode: 'party',
        shapeId, mapId,
        players: Array.from({ length: n }, (_, i) => ({
          name: 'P' + (i + 1), color: PLAYER_COLORS[i % PLAYER_COLORS.length],
          throws: [], total: 0, bestHold: 0,
        })),
        throwsPer: throwsN || 3,
        cur: 0, round: 0,
        markers: [],
        pending: [],
        simMode: simMode !== false,
        done: false,
      };
      this._beginTurn();
    },

    curPlayer() { return session ? session.players[session.cur] : null; },
    throwNo() { return session ? session.round + 1 : 0; },

    _beginTurn() {
      ST.UI.showGame();
      ST.Game.setup(session.shapeId, session.mapId);
      const p = this.curPlayer();
      const label = session.mode === 'party'
        ? ST.I18N.t('turn.party', p.name, this.throwNo(), session.throwsPer)
        : ST.I18N.t('turn.practice', this.throwNo(), session.throwsPer);
      ST.Game.startTurn(label, p.color);
      if (session.mode === 'party') ST.Audio.play('turn');
    },

    /* Game에서 턴 종료 시 호출 */
    onThrowEnd(res) {
      const p = this.curPlayer();
      if (res.deferred && res.pending) {
        // 동시 시뮬 유예: 착지 정보만 보관
        session.pending.push({
          player: session.cur, name: p.name, color: p.color,
          impact: res.pending.impact, res: res.pending.res, ts: res.pending.ts,
        });
      } else {
        p.throws.push(res);
        p.total += res.total;
        p.bestHold = Math.max(p.bestHold, res.holdTime || 0);
      }
      if (res.impact) {
        session.markers.push({
          x: res.impact.x, y: res.impact.y,
          color: p.color, label: session.mode === 'party' ? p.name : '' + (session.round + 1),
        });
      }

      // 턴 로테이션
      session.cur++;
      let roundEnd = false;
      if (session.cur >= session.players.length) {
        session.cur = 0;
        session.round++;
        roundEnd = true;
      }

      if (roundEnd && session.simMode && session.pending.length) {
        const list = session.pending;
        session.pending = [];
        setTimeout(() => ST.Game.startSimul(list), 400);
        return;
      }
      this._maybeNext();
    },

    /* 동시 크롤 시뮬 종료 — 점수 확정 */
    onSimulEnd(multi) {
      for (const m of multi) {
        const p = session.players[m.player];
        const total = m.result != null ? m.result : ST.Score.finalize(m.ts);
        p.throws.push({ total, holdTime: m.ts.holdTime || 0, stuck: true });
        p.total += total;
        p.bestHold = Math.max(p.bestHold, m.ts.holdTime || 0);
      }
      this._maybeNext();
    },

    _maybeNext() {
      if (session.round >= session.throwsPer) {
        session.done = true;
        this._finish();
      } else {
        setTimeout(() => this._beginTurn(), 350);
      }
    },

    _finish() {
      const s = session;
      // 해금 누적은 최고 1인 점수만. 전원 합이면 8인 파티 한 판이 연습 8판이라
      // 임계값이 무의미해진다 (R12). 파티 한 판 = 연습 한 판과 같은 무게.
      const best = s.players.reduce((a, p) => Math.max(a, p.total), 0);
      ST.Score.addEarned(best);
      ST.Audio.play('fanfare');
      setTimeout(() => ST.UI.showResult(s), 700);
    },

    /* 진행 중인 라운드를 중단하고 타이틀로 (Android 뒤로가기) */
    toTitle() {
      session = null;
      ST.Game.abortToIdle();
      ST.UI.show('scr-title');
    },

    retry() {
      if (!session) return;
      if (session.mode === 'practice') this.startPractice(session.shapeId, session.mapId, session.throwsPer);
      else this.startParty(session.players.length, session.shapeId, session.mapId, session.throwsPer, session.simMode);
    },
  };

  ST.Modes = Modes;
})();
