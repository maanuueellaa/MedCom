from __future__ import annotations

import hmac
import json
import os
from typing import Any, Dict

from flask import (
    Flask,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
    send_from_directory,
)

# Backend entry point for MedCom.
# Loads local JSON data, serves the UI, and handles admin actions.
app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Admin credentials should be overridden in production via environment variables.
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "ChangeMe123!")


def read_json(filename: str) -> Any:
    """Read a JSON file from the data directory."""
    path = os.path.join(DATA_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(filename: str, data: Any) -> None:
    """Write data to a JSON file in the data directory."""
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_data() -> Dict[str, Any]:
    """Load all data needed by the frontend and admin pages."""
    return {
        "languages": read_json("languages.json"),
        "phrases": read_json("phrases.json"),
        "words": read_json("words.json"),
    }


def is_admin_logged_in() -> bool:
    """Check whether the admin session is unlocked."""
    return bool(session.get("admin_logged_in", False))


@app.get("/")
def index():
    """Render the homepage with languages, phrases, and words."""
    data = load_data()
    return render_template("index.html", **data)


@app.route("/admin-login", methods=["GET", "POST"])
def admin_login():
    """Authenticate the admin user before allowing content management."""
    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        password = (request.form.get("password") or "").strip()

        username_ok = hmac.compare_digest(username, ADMIN_USERNAME)
        password_ok = hmac.compare_digest(password, ADMIN_PASSWORD)

        if username_ok and password_ok:
            session["admin_logged_in"] = True
            flash("Admin access granted.", "ok")
            return redirect(url_for("admin"))

        flash("Invalid username or password.", "error")

    return render_template("admin_login.html")


@app.get("/admin-logout")
def admin_logout():
    """End the admin session."""
    session.pop("admin_logged_in", None)
    flash("You have been logged out.", "ok")
    return redirect(url_for("index"))


@app.get("/admin")
def admin():
    """Render the admin page if the user is authenticated."""
    if not is_admin_logged_in():
        return redirect(url_for("admin_login"))
    data = load_data()
    return render_template("admin.html", **data)


@app.post("/admin/add_phrase")
def add_phrase():
    """Add a new phrase after validating input."""
    if not is_admin_logged_in():
        flash("Unauthorized access.", "error")
        return redirect(url_for("admin_login"))

    data = load_data()
    phrases = data["phrases"]
    languages = data["languages"]

    phrase_id = (request.form.get("id") or "").strip()
    category = (request.form.get("category") or "").strip()
    keywords_raw = (request.form.get("keywords") or "").strip()

    if not phrase_id or not category:
        flash("Phrase ID and category are required.", "error")
        return redirect(url_for("admin"))

    if any(p.get("id") == phrase_id for p in phrases):
        flash("Phrase ID already exists.", "error")
        return redirect(url_for("admin"))

    translations: Dict[str, str] = {}
    audio: Dict[str, str] = {}

    for code in languages.keys():
        translation = (request.form.get(f"t_{code}") or "").strip()
        audio_path = (request.form.get(f"a_{code}") or "").strip()
        if translation:
            translations[code] = translation
        if audio_path:
            audio[code] = audio_path

    if not translations:
        flash("Add at least one translation.", "error")
        return redirect(url_for("admin"))

    keywords = [k.strip().lower() for k in keywords_raw.split(",") if k.strip()]

    phrases.append(
        {
            "id": phrase_id,
            "category": category,
            "translations": translations,
            "audio": audio,
            "keywords": keywords,
        }
    )

    write_json("phrases.json", phrases)
    flash("Phrase added.", "ok")
    return redirect(url_for("admin"))


@app.post("/admin/delete_phrase")
def delete_phrase():
    """Delete an existing phrase by ID."""
    if not is_admin_logged_in():
        flash("Unauthorized access.", "error")
        return redirect(url_for("admin_login"))

    data = load_data()
    phrases = data["phrases"]
    phrase_id = (request.form.get("id") or "").strip()

    updated_phrases = [p for p in phrases if p.get("id") != phrase_id]
    if len(updated_phrases) == len(phrases):
        flash("Phrase not found.", "error")
        return redirect(url_for("admin"))

    write_json("phrases.json", updated_phrases)
    flash("Phrase deleted.", "ok")
    return redirect(url_for("admin"))


@app.post("/admin/add_word")
def add_word():
    """Add a new word after validating input."""
    if not is_admin_logged_in():
        flash("Unauthorized access.", "error")
        return redirect(url_for("admin_login"))

    data = load_data()
    words = data["words"]
    languages = data["languages"]

    word_id = (request.form.get("id") or "").strip()
    if not word_id:
        flash("Word ID is required.", "error")
        return redirect(url_for("admin"))

    if any(w.get("id") == word_id for w in words):
        flash("Word ID already exists.", "error")
        return redirect(url_for("admin"))

    translations: Dict[str, str] = {}
    for code in languages.keys():
        translation = (request.form.get(f"t_{code}") or "").strip()
        if translation:
            translations[code] = translation

    if not translations:
        flash("Add at least one translation.", "error")
        return redirect(url_for("admin"))

    words.append({"id": word_id, "translations": translations})
    write_json("words.json", words)
    flash("Word added.", "ok")
    return redirect(url_for("admin"))


@app.post("/admin/delete_word")
def delete_word():
    """Delete an existing word by ID."""
    if not is_admin_logged_in():
        flash("Unauthorized access.", "error")
        return redirect(url_for("admin_login"))

    data = load_data()
    words = data["words"]
    word_id = (request.form.get("id") or "").strip()

    updated_words = [w for w in words if w.get("id") != word_id]
    if len(updated_words) == len(words):
        flash("Word not found.", "error")
        return redirect(url_for("admin"))

    write_json("words.json", updated_words)
    flash("Word deleted.", "ok")
    return redirect(url_for("admin"))


@app.get("/api/data")
def api_data():
    """Expose the current application data as JSON."""
    return jsonify(load_data())


@app.get("/robots.txt")
def robots():
    """Serve robots.txt from the static directory."""
    return send_from_directory(STATIC_DIR, "robots.txt")


@app.get("/sitemap.xml")
def sitemap():
    """Serve sitemap.xml from the static directory."""
    return send_from_directory(STATIC_DIR, "sitemap.xml")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)