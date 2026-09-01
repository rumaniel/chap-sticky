/* 찐득이 토스 - 네이티브 셸(Capacitor) 연동
 *
 * 브라우저에서는 window.Capacitor 가 없으므로 전부 no-op 이다. 네이티브
 * 브리지가 주입한 전역만 쓰고 import 는 하지 않는다 — 이 프로젝트는 번들러가
 * 없고 file:// 실행을 보장해야 해서 ES module 을 쓸 수 없다.
 */
window.ST = window.ST || {};

(function () {
  const cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return;

  const App = cap.Plugins && cap.Plugins.App;
  if (!App) return;

  ST.native = true;

  // 하드웨어 뒤로가기. UI.back() 이 false 를 주면 더 올라갈 화면이 없다는 뜻이라
  // 그때만 앱을 닫는다. (타이틀에서 두 번 눌러야 false 가 나온다)
  App.addListener('backButton', function () {
    if (!ST.UI.back()) App.exitApp();
  });

  // 홈 버튼·화면 잠금에서 visibilitychange 가 오지 않는 기기가 있어 따로 받는다.
  // main.js 의 핸들러와 중복 호출돼도 suspend/resume 은 멱등하다.
  App.addListener('appStateChange', function (state) {
    if (state && state.isActive) ST.Audio.resume();
    else ST.Audio.suspend();
  });
})();
