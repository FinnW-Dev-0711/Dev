from __future__ import annotations

import json
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.parse import urlencode, urlparse
from urllib.request import urlopen

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATE_DIR = BASE_DIR / "templates"
INDEX_FILE = TEMPLATE_DIR / "index.html"

WIKIPEDIA_SEARCH_URL = "https://de.wikipedia.org/w/api.php"

CATEGORY_KEYWORDS = {
    "Filme & Serien": [
        "film",
        "serie",
        "stream",
        "video on demand",
        "cinema",
        "tv",
        "anime",
    ],
    "Musik & Audio": ["musik", "audio", "podcast", "hörbuch", "music", "radio"],
    "Gaming": ["spiel", "gaming", "game", "xbox", "playstation", "nintendo", "esports"],
    "Produktivität & Cloud": [
        "cloud",
        "storage",
        "produktiv",
        "office",
        "software",
        "notiz",
        "projekt",
        "backup",
    ],
    "Fitness & Gesundheit": ["fitness", "gesund", "meditation", "wellness", "sport", "training"],
    "Shopping & Lieferung": ["liefer", "shopping", "e-commerce", "versand", "retail"],
    "Sonstiges": [],
}


@dataclass
class Subscription:
    name: str
    price: float


def fetch_subscription_context(name: str) -> str:
    query = urlencode(
        {
            "action": "query",
            "format": "json",
            "list": "search",
            "utf8": 1,
            "srlimit": 1,
            "srsearch": name,
        }
    )

    try:
        with urlopen(f"{WIKIPEDIA_SEARCH_URL}?{query}", timeout=8) as response:
            data = json.loads(response.read().decode("utf-8"))

        hits = data.get("query", {}).get("search", [])
        if not hits:
            return ""

        first_hit = hits[0]
        title = first_hit.get("title", "")
        snippet = first_hit.get("snippet", "")
        return f"{title} {snippet}".lower()
    except (URLError, TimeoutError, json.JSONDecodeError):
        return ""


def classify_subscription(name: str, web_context: str) -> str:
    text = f"{name} {web_context}".lower()

    best_category = "Sonstiges"
    best_score = 0

    for category, keywords in CATEGORY_KEYWORDS.items():
        if category == "Sonstiges":
            continue

        score = sum(1 for kw in keywords if kw in text)
        if score > best_score:
            best_category = category
            best_score = score

    return best_category


def analyze_subscriptions(raw_subscriptions: list[dict[str, Any]]) -> dict[str, Any]:
    subscriptions: list[Subscription] = []
    for item in raw_subscriptions:
        name = str(item.get("name", "")).strip()
        price = item.get("price", 0)

        if not name:
            continue

        try:
            parsed_price = float(price)
        except (TypeError, ValueError):
            continue

        if parsed_price < 0:
            continue

        subscriptions.append(Subscription(name=name, price=round(parsed_price, 2)))

    grouped: dict[str, list[dict[str, Any]]] = {}
    totals: dict[str, float] = {}
    grand_total = 0.0

    for sub in subscriptions:
        context = fetch_subscription_context(sub.name)
        category = classify_subscription(sub.name, context)

        grouped.setdefault(category, []).append(
            {
                "name": sub.name,
                "price": sub.price,
                "contextUsed": bool(context),
            }
        )

        totals[category] = round(totals.get(category, 0.0) + sub.price, 2)
        grand_total += sub.price

    sorted_categories = sorted(grouped.keys(), key=lambda cat: totals.get(cat, 0), reverse=True)

    return {
        "categories": [
            {
                "name": category,
                "items": grouped[category],
                "total": totals[category],
            }
            for category in sorted_categories
        ],
        "grandTotal": round(grand_total, 2),
        "currency": "EUR",
    }


class SubscriptionHandler(BaseHTTPRequestHandler):
    def _send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _send_file(self, path: Path, content_type: str) -> None:
        if not path.exists() or not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return

        content = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)

        if parsed.path == "/":
            self._send_file(INDEX_FILE, "text/html; charset=utf-8")
            return

        if parsed.path.startswith("/static/"):
            rel_path = parsed.path.removeprefix("/static/")
            file_path = (STATIC_DIR / rel_path).resolve()
            if STATIC_DIR.resolve() not in file_path.parents and file_path != STATIC_DIR.resolve():
                self.send_error(HTTPStatus.FORBIDDEN, "Forbidden")
                return

            if file_path.suffix == ".css":
                ctype = "text/css; charset=utf-8"
            elif file_path.suffix == ".js":
                ctype = "application/javascript; charset=utf-8"
            else:
                ctype = "application/octet-stream"

            self._send_file(file_path, ctype)
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/api/analyze":
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length)

        try:
            payload = json.loads(body.decode("utf-8")) if body else {}
        except json.JSONDecodeError:
            self._send_json({"error": "Ungültiges JSON."}, HTTPStatus.BAD_REQUEST)
            return

        subscriptions = payload.get("subscriptions", [])
        if not isinstance(subscriptions, list):
            self._send_json({"error": "subscriptions muss ein Array sein."}, HTTPStatus.BAD_REQUEST)
            return

        response = analyze_subscriptions(subscriptions)
        self._send_json(response)


def run_server(host: str = "0.0.0.0", port: int = 8000) -> None:
    server = ThreadingHTTPServer((host, port), SubscriptionHandler)
    print(f"AboScope läuft auf http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run_server()
