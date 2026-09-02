# -*- coding: utf-8 -*-
"""브라우저에서 렌더한 캔버스 PNG 를 받아 저장하는 로컬 서버.

게임은 에셋 파일이 0개라 스크린샷·아이콘·피처 그래픽을 전부 게임의 캔버스 드로잉
코드로 브라우저에서 렌더한다. 캔버스 → PNG 는 브라우저 안에서 끝나지만 파일로
떨구는 단계가 필요해서 이 서버가 받는다. 페이지는 localhost:8123(python http.server)
에서 돌고 이 서버는 8124 라 CORS 헤더를 붙인다.

사용법:
  python tools/capture/save_server.py            # 8124 에서 대기
  브라우저: fetch('http://localhost:8124/save?name=itch_s1_aim.png',
                 { method: 'POST', body: canvas.toDataURL('image/png') })

저장 위치는 name 의 접두어로 정한다 — itch_* → marketing/itchio, play_* →
marketing/googleplay, 그 외 → docs/shots. 경로 구분자·상위 이동은 거부한다.
"""
import base64
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PORT = 8124


def target_dir(name):
    if name.startswith('itch_'):
        return os.path.join(ROOT, 'marketing', 'itchio')
    if name.startswith('play_'):
        return os.path.join(ROOT, 'marketing', 'googleplay')
    return os.path.join(ROOT, 'docs', 'shots')


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        q = parse_qs(urlparse(self.path).query)
        name = (q.get('name') or [''])[0]
        if not name or '/' in name or '\\' in name or '..' in name or not name.endswith('.png'):
            self.send_response(400)
            self._cors()
            self.end_headers()
            self.wfile.write(b'bad name')
            return
        n = int(self.headers.get('Content-Length', '0'))
        body = self.rfile.read(n).decode('ascii')
        if not body.startswith('data:image/png;base64,'):
            self.send_response(400)
            self._cors()
            self.end_headers()
            self.wfile.write(b'expect data:image/png;base64')
            return
        data = base64.b64decode(body.split(',', 1)[1])
        d = target_dir(name)
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, name)
        with open(path, 'wb') as f:
            f.write(data)
        msg = '%s %d KB' % (os.path.relpath(path, ROOT), len(data) // 1024)
        print(msg)
        sys.stdout.flush()
        self.send_response(200)
        self._cors()
        self.end_headers()
        self.wfile.write(msg.encode('utf-8'))

    def log_message(self, fmt, *args):  # 기본 액세스 로그는 시끄럽다
        pass


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print('save_server on http://localhost:%d  (POST /save?name=<file>.png)' % PORT)
    sys.stdout.flush()
    HTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
