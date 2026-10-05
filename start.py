"""Local preview: python3 start.py (Python standard library only)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent

if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 4173), partial(SimpleHTTPRequestHandler, directory=str(ROOT)))
    print('SAPUN HOME: http://127.0.0.1:4173/', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
