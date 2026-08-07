/* 찐득이 토스 - 모드 흐름: 연습(5구) / 파티 핫시트(인당 3구, 턴 로테이션) */
window.ST = window.ST || {};

(function () {
  const PLAYER_COLORS = ['#7ed957', '#8ad6ff', '#ffb3f2', '#ffd94f', '#ff9d76', '#b9a5f5', '#7affd4', '#ff8a8a'];

  let session = null;

  const Modes = {
    get session() { return session; },

    startPractice(shapeId, mapId) {
      session = {
        mode: 'practice',
        shapeId, mapId,
        players: [{ name: '나', color: PLAYER_COLORS[0], throws: [], total: 0, bestHold: 0 }],
        throwsPer: 5,
        cur: 0, round: 0,
        markers: [],
        done: false,
      };
      this._beginTurn();
    },

    startParty(n, shapeId, mapId) {
      session = {
        mode: 'party',
        shapeId, mapId,
        players: Array.from({ length: n }, (_, i) => ({
          name: 'P' + (i + 1), color: PLAYER_COLORS[i % PLAYER_COLORS.length],
          throws: [], total: 0, bestHold: 0,
        })),
        throwsPer: 3,
        cur: 0, round: 0,
        markers: [],
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
        ? p.name + ' 차례! (' + this.throwNo() + '/' + session.throwsPer + '구)'
        : this.throwNo() + '구 / ' + session.throwsPer + '구';
      ST.Game.startTurn(label, p.color);
      if (session.mode === 'party') ST.Audio.play('turn');
    },

    /* Game에서 턴 종료 시 호출. res: {total, holdTime, impact:{x,y}|null, stuck:bool} */
    onThrowEnd(res) {
      const p = this.curPlayer();
      p.throws.push(res);
      p.total += res.total;
      p.bestHold = Math.max(p.bestHold, res.holdTime || 0);
      if (res.impact) {
        session.markers.push({
          x: res.impact.x, y: res.impact.y,
          color: p.color, label: session.mode === 'party' ? p.name : '' + p.throws.length,
        });
      }

      // 턴 로테이션
      session.cur++;
      if (session.cur >= session.players.length) {
        session.cur = 0;
        session.round++;
      }
      if (session.round >= session.throwsPer) {
        session.done = true;
        this._finish();
      } else {
        setTimeout(() => this._beginTurn(), 350);
      }
    },

    _finish() {
      const s = session;
      // 해금 포인트: 세션 전체 획득 점수 누적
      const sum = s.players.reduce((a, p) => a + p.total, 0);
      ST.Score.addEarned(sum);
      ST.Audio.play('fanfare');
      setTimeout(() => ST.UI.showResult(s), 700);
    },

    retry() {
      if (!session) return;
      if (session.mode === 'practice') this.startPractice(session.shapeId, session.mapId);
      else this.startParty(session.players.length, session.shapeId, session.mapId);
    },
  };

  ST.Modes = Modes;
})();
