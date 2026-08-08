/* 찐득이 토스 - 문자열 테이블 (ko/en)
 * 사용: ST.I18N.t('key', arg0, arg1...) — {0},{1} 치환
 * DOM: data-i18n="key" → applyDOM()이 innerHTML 주입, data-i18n-ph → placeholder
 */
window.ST = window.ST || {};

(function () {
  const TABLES = {
    ko: {
      'title': '찹! 찐득이 - Splat! Sticky',
      'logo': '찹!<br>찐득이',
      'logoSub': 'SPLAT! STICKY',
      'tagline': '벽에 던져라, 붙어라, 버텨라!',
      'titleHint': '추억의 찐득이 장난감을 진짜 물리로!<br>드래그로 던지고, 빙글빙글 돌려 커브볼도 가능',
      'btn.start': '시작하기',
      'btn.board': '🏆 리더보드',
      'btn.back': '← 뒤로',
      'btn.next': '다음 →',
      'btn.play': '던지러 가기!',
      'btn.retry': '🔄 한판 더',
      'btn.menu': '메뉴로',
      'btn.save': '기록 저장',
      'common.on': 'ON',
      'common.off': 'OFF',

      'mode.title': '모드 선택',
      'mode.practice': '🎯 연습 모드',
      'mode.practiceDesc': '혼자서 최고 기록에 도전',
      'mode.party': '🎉 파티 모드',
      'mode.partyDesc': '친구들과 번갈아 던지기',

      'party.title': '몇 명이서 할까?',
      'party.hint': '한 기기로 번갈아 던집니다 (2~8명)',
      'party.sim': '🎬 동시 결과: {0}',
      'party.simHint': 'ON: 전원 던진 뒤 한 벽에서 동시에 크롤 대결<br>OFF: 던질 때마다 바로 결과',

      'sel.shape': '찐득이 선택',
      'sel.map': '맵 선택',
      'sel.throws': '몇 구 던질까?',
      'sel.earned': '누적 획득 점수: {0}점',
      'sel.lock': '누적 {0}점 해금',

      'res.practice': '🎯 라운드 결과',
      'res.party': '🎉 파티 결과',
      'res.points': '{0}점',
      'res.bestHold': '최고 버티기 <b>{0}초</b> · {1}구 합산',
      'res.winnerSub': '{0}점으로 우승!',
      'res.savedRank': '🏆 리더보드 <b>{0}위</b> 등극!',
      'res.savedOk': '기록 저장 완료!',
      'res.namePh': '이름 입력',
      'th.throw': '구', 'th.score': '점수', 'th.hold': '버티기',
      'th.rank': '순위', 'th.name': '이름', 'th.bestHold': '최고 버티기', 'th.combo': '구성',

      'board.title': '🏆 리더보드',
      'board.empty': '아직 기록이 없다.<br>연습 모드에서 기록을 남겨보자!',

      'turn.practice': '{0}구 / {1}구',
      'turn.party': '{0} 차례! ({1}/{2}구)',
      'turn.simul': '동시 크롤 스타트!',
      'hint.flick': '찐득이를 잡고 벽으로 플릭! ☝',
      'hint.spin': '잡은 채로 빙글빙글 돌리면 커브볼',

      'float.stick': '착!',
      'float.tooHard': '너무 세다!',
      'float.floor': '철퍼덕...',
      'float.outZone': '존 밖으로!',
      'float.noGrip': '안 붙는 곳!',
      'float.curve': '커브 착! +{0}',
      'float.perfect': '퍼펙트 착!! +{0}',
      'float.spot': '{0} 스팟! +{1}',
      'float.sum': '합계 +{0}',

      'player.me': '나',

      'shape.man.name': '찐득맨', 'shape.man.desc': '양손·양발이 끈적',
      'shape.octo.name': '문어찐득', 'shape.octo.desc': '다리 끝 8곳이 끈적',
      'shape.star.name': '별찐득', 'shape.star.desc': '꼭짓점 5곳이 끈적 · 가볍다',

      'map.room.name': '거실 벽', 'map.room.desc': '무난한 벽지 · 표준 그립',
      'map.glass.name': '유리창', 'map.glass.desc': '미끌미끌! 살살 던져야 붙는다',
      'map.chalk.name': '교실 칠판', 'map.chalk.desc': '착착 붙는다 · 오래 버티기 명당',
      'map.fridge.name': '냉장고', 'map.fridge.desc': '자석 스팟 대박 보너스!',
    },

    en: {
      'title': 'Splat! Sticky',
      'logo': 'SPLAT!<br>STICKY',
      'logoSub': '찹! 찐득이',
      'tagline': 'Throw it, stick it, hang on!',
      'titleHint': 'The classic sticky wall crawler toy, with real physics!<br>Drag to throw, twirl for a curveball',
      'btn.start': 'START',
      'btn.board': '🏆 Leaderboard',
      'btn.back': '← Back',
      'btn.next': 'Next →',
      'btn.play': 'Let\'s Toss!',
      'btn.retry': '🔄 One More',
      'btn.menu': 'Menu',
      'btn.save': 'Save Score',
      'common.on': 'ON',
      'common.off': 'OFF',

      'mode.title': 'Select Mode',
      'mode.practice': '🎯 Practice',
      'mode.practiceDesc': 'Chase your high score solo',
      'mode.party': '🎉 Party',
      'mode.partyDesc': 'Pass & play with friends',

      'party.title': 'How many players?',
      'party.hint': 'Take turns on one device (2–8)',
      'party.sim': '🎬 Simul Finish: {0}',
      'party.simHint': 'ON: everyone throws, then all crawl at once<br>OFF: instant result after each throw',

      'sel.shape': 'Pick Your Sticky',
      'sel.map': 'Pick a Map',
      'sel.throws': 'Throws per player?',
      'sel.earned': 'Total earned: {0} pts',
      'sel.lock': 'Unlock at {0} pts',

      'res.practice': '🎯 Round Result',
      'res.party': '🎉 Party Result',
      'res.points': '{0} pts',
      'res.bestHold': 'Best hold <b>{0}s</b> · {1} throws',
      'res.winnerSub': 'wins with {0} pts!',
      'res.savedRank': '🏆 Ranked <b>#{0}</b> on the board!',
      'res.savedOk': 'Score saved!',
      'res.namePh': 'Your name',
      'th.throw': '#', 'th.score': 'Score', 'th.hold': 'Hold',
      'th.rank': 'Rank', 'th.name': 'Name', 'th.bestHold': 'Best Hold', 'th.combo': 'Setup',

      'board.title': '🏆 Leaderboard',
      'board.empty': 'No records yet.<br>Set one in Practice mode!',

      'turn.practice': 'Throw {0} / {1}',
      'turn.party': '{0}\'s turn! ({1}/{2})',
      'turn.simul': 'Simul crawl, GO!',
      'hint.flick': 'Grab & flick at the wall! ☝',
      'hint.spin': 'Twirl while holding for a curveball',

      'float.stick': 'Stuck!',
      'float.tooHard': 'Too hard!',
      'float.floor': 'Splat...',
      'float.outZone': 'Out of zone!',
      'float.noGrip': 'No grip there!',
      'float.curve': 'Curve stick! +{0}',
      'float.perfect': 'PERFECT! +{0}',
      'float.spot': '{0} Spot! +{1}',
      'float.sum': 'Total +{0}',

      'player.me': 'Me',

      'shape.man.name': 'Sticky Man', 'shape.man.desc': 'Sticky hands & feet',
      'shape.octo.name': 'Octo Sticky', 'shape.octo.desc': '8 sticky tentacle tips',
      'shape.star.name': 'Star Sticky', 'shape.star.desc': '5 sticky points · lightweight',

      'map.room.name': 'Living Room', 'map.room.desc': 'Plain wallpaper · standard grip',
      'map.glass.name': 'Window', 'map.glass.desc': 'Slippery! Toss it gently',
      'map.chalk.name': 'Chalkboard', 'map.chalk.desc': 'Super grippy · hold forever',
      'map.fridge.name': 'Fridge', 'map.fridge.desc': 'Magnet spots = big bonus!',
    },
  };

  let lang = (navigator.language || 'ko').toLowerCase().startsWith('ko') ? 'ko' : 'en';

  ST.I18N = {
    get lang() { return lang; },
    setLang(l) {
      lang = TABLES[l] ? l : 'ko';
      this.applyDOM();
      if (ST.UI && ST.UI.onLangChange) ST.UI.onLangChange();
    },
    toggle() { this.setLang(lang === 'ko' ? 'en' : 'ko'); return lang; },
    t(key) {
      let s = TABLES[lang][key];
      if (s == null) s = TABLES.ko[key];
      if (s == null) return key;
      for (let i = 1; i < arguments.length; i++) {
        s = s.replace('{' + (i - 1) + '}', arguments[i]);
      }
      return s;
    },
    applyDOM() {
      document.querySelectorAll('[data-i18n]').forEach((el) => {
        el.innerHTML = this.t(el.dataset.i18n);
      });
      document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
        el.placeholder = this.t(el.dataset.i18nPh);
      });
      document.title = this.t('title');
    },
  };
})();
