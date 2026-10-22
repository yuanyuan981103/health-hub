#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
健康集 · 本地服务器
- 提供静态页面（手机/电脑浏览器访问）
- 代理 /api/chat 到 OpenAI 兼容接口（解决浏览器跨域问题）

用法：
    python server.py            # 默认端口 8000
    python server.py 9000       # 指定端口

访问：
    http://localhost:8000              本机
    http://<本机局域网IP>:8000         同一 WiFi 下的手机
"""
import json
import sys
import urllib.request
import urllib.error
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
TIMEOUT = 180


class Handler(SimpleHTTPRequestHandler):
    def _send_json(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_POST(self):
        if self.path.rstrip("/") != "/api/chat":
            self.send_error(404, "Not Found")
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
        except Exception as e:
            self._send_json(400, {"error": "请求体解析失败：" + str(e)})
            return

        endpoint = (payload.get("endpoint") or "").strip()
        api_key = (payload.get("apiKey") or "").strip()
        model = (payload.get("model") or "").strip()
        messages = payload.get("messages") or []

        if not endpoint:
            self._send_json(400, {"error": "缺少 endpoint（接口地址）"})
            return
        if not api_key:
            self._send_json(400, {"error": "缺少 API Key"})

        body = json.dumps({
            "model": model,
            "messages": messages,
            "stream": False,
            "temperature": 0.5,
        }).encode("utf-8")

        req = urllib.request.Request(
            endpoint,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer " + api_key,
                "Accept": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                data = resp.read()
                self._send_json(200, json.loads(data.decode("utf-8")))
        except urllib.error.HTTPError as e:
            detail = ""
            try:
                detail = e.read().decode("utf-8", errors="replace")[:800]
            except Exception:
                pass
            self._send_json(e.code or 502, {"error": f"上游接口错误 {e.code}: {detail}"})
        except Exception as e:
            self._send_json(502, {"error": "请求上游接口失败：" + str(e)})

    def log_message(self, fmt, *args):  # 精简日志
        sys.stderr.write("[health-hub] %s\n" % (fmt % args))


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    import socket

    def lan_ip():
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return None

    ip = lan_ip()
    print("=" * 48)
    print(" 健康集 · 本地服务器已启动")
    print(f" 本机访问:   http://localhost:{PORT}")
    if ip:
        print(f" 手机访问:   http://{ip}:{PORT}   (同一 WiFi)")
    print(" 按 Ctrl+C 停止")
    print("=" * 48)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
