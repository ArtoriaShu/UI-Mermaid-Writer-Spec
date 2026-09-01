# -*- coding: utf-8 -*-
"""Local-only DeepSeek bridge for Figma development plugins.

The bridge listens on 127.0.0.1:17823, forwards one API endpoint, and never
stores or logs the Authorization header. Keep this window open while using the
plugin when Figma cannot reach DeepSeek directly.
"""

import json
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


HOST = "127.0.0.1"
PORT = 17823
UPSTREAM_URL = "https://api.deepseek.com/chat/completions"
MAX_REQUEST_BYTES = 8 * 1024 * 1024


class BridgeHandler(BaseHTTPRequestHandler):
    server_version = "DeepSeekFigmaBridge/1.0"

    def log_message(self, _format, *_args):
        return

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Cache-Control", "no-store")

    def _send(self, status, body, content_type="application/json; charset=utf-8"):
        payload = body if isinstance(body, bytes) else body.encode("utf-8")
        self.send_response(status)
        self._cors_headers()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path != "/health":
            self._send(404, json.dumps({"error": "not_found"}))
            return
        self._send(200, json.dumps({"ok": True, "service": "deepseek-figma-bridge"}))

    def do_POST(self):
        if self.path != "/deepseek/chat/completions":
            self._send(404, json.dumps({"error": "not_found"}))
            return

        authorization = self.headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            self._send(401, json.dumps({"error": "missing_authorization"}))
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
            self._send(413, json.dumps({"error": "invalid_request_size"}))
            return

        body = self.rfile.read(content_length)
        try:
            json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._send(400, json.dumps({"error": "invalid_json"}))
            return

        request = urllib.request.Request(
            UPSTREAM_URL,
            data=body,
            headers={
                "Authorization": authorization,
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "figma-ui-mermaid-writer-bridge/1.0",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=600) as response:
                response_body = response.read()
                content_type = response.headers.get("Content-Type", "application/json; charset=utf-8")
                self._send(response.status, response_body, content_type)
        except urllib.error.HTTPError as exc:
            self._send(exc.code, exc.read(), exc.headers.get("Content-Type", "application/json; charset=utf-8"))
        except urllib.error.URLError as exc:
            self._send(502, json.dumps({"error": "upstream_unreachable", "message": str(exc.reason)}))
        except Exception as exc:
            self._send(500, json.dumps({"error": "bridge_error", "message": str(exc)}))


def main():
    server = ThreadingHTTPServer((HOST, PORT), BridgeHandler)
    print("DeepSeek Figma bridge is running.")
    print("Listening: http://{0}:{1}".format(HOST, PORT))
    print("Keep this window open while generating MMD. Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
