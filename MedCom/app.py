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
# Loads local JSON data, serves the user/admin pages,
# and handles authenticated content management.
app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Reusable file names and shared messages.
# Using constants reduces duplication and improves maintainability.
LANGUAGES_FILE = "languages.json"
PHRASES_FILE = "phrases.json"
WORDS_FILE = "words.json"
UNAUTHORIZED_ACCESS_MESSAGE = "Unauthorized access."

# Admin credentials should be provided through environment variables.
# The password is intentionally not hardcoded in the source code.
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

if not ADMIN_PASSWORD:
    raise RuntimeError("ADMIN_PASSWORD environment variable is required.")


# Read a JSON file from the data directory
# and return its parsed contents.
def read_json(filename: str) -> Any:
    path = os.path.join(DATA_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# Write structured data back to a JSON file
# using UTF-8 and readable indentation.
def write_json(filename: str, data: Any) -> None:
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# Load all application data needed by the UI and admin pages.
def load_data() -> Dict[str, Any]:
    return {
        "languages": read_json(LANGUAGES_FILE),
        "phrases": read_json(PHRASES_FILE),
        "words": read_json(WORDS_FILE),
    }


# Check whether the current session has unlocked admin access.
def is_admin_logged_in() -> bool:
    return bool(session.get("admin_logged_in", False))


# Render the main homepage with languages, phrases, and words.
@app.get("/")
def index():
    data = load_data()
    return render_template("index.html", **data)


# Render the separate information page.
# This page contains system description,
# usage instructions, and project background.
@app.get("/info")
def info():
    return render_template("info.html")


# Handle admin login through username and password.
@app.route("/admin-login", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        password = (request.form.get("password") or "").strip()

        # Compare credentials safely to reduce timing-based leakage.
        username_ok = hmac.compare_digest(username, ADMIN_USERNAME)
        password_ok = hmac.compare_digest(password, ADMIN_PASSWORD)

        if username_ok and password_ok:
            session["admin_logged_in"] = True
            flash("Admin access granted.", "ok")
            return redirect(url_for("admin"))

        flash("Invalid username or password.", "error")

    return render_template("admin_login.html")


# End the admin session and return to the homepage.
@app.get("/admin-logout")
def admin_logout():
    session.pop("admin_logged_in", None)
    flash("You have been logged out.", "ok")
    return redirect(url_for("index"))


# Render the admin page if the current session is authenticated.
@app.get("/admin")
def admin():
    if not is_admin_logged_in():
        return redirect(url_for("admin_login"))

    data = load_data()
    return render_template("admin.html", **data)


# Add a new phrase after validating required fields,
# uniqueness of the phrase ID, and the existence of at least one translation.
@app.post("/admin/add_phrase")
def add_phrase():
    if not is_admin_logged_in():
        flash(UNAUTHORIZED_ACCESS_MESSAGE, "error")
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

    # Collect translations and optional audio paths
    # for all supported languages.
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

    # Normalize keyword input into a lowercase list.
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

    write_json(PHRASES_FILE, phrases)
    flash("Phrase added.", "ok")
    return redirect(url_for("admin"))


# Delete an existing phrase by ID.
@app.post("/admin/delete_phrase")
def delete_phrase():
    if not is_admin_logged_in():
        flash(UNAUTHORIZED_ACCESS_MESSAGE, "error")
        return redirect(url_for("admin_login"))

    data = load_data()
    phrases = data["phrases"]
    phrase_id = (request.form.get("id") or "").strip()

    updated_phrases = [p for p in phrases if p.get("id") != phrase_id]

    if len(updated_phrases) == len(phrases):
        flash("Phrase not found.", "error")
        return redirect(url_for("admin"))

    write_json(PHRASES_FILE, updated_phrases)
    flash("Phrase deleted.", "ok")
    return redirect(url_for("admin"))


# Add a new word after validating required fields,
# uniqueness of the word ID, and the existence of at least one translation.
@app.post("/admin/add_word")
def add_word():
    if not is_admin_logged_in():
        flash(UNAUTHORIZED_ACCESS_MESSAGE, "error")
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

    # Collect multilingual translations for the new word entry.
    for code in languages.keys():
        translation = (request.form.get(f"t_{code}") or "").strip()
        if translation:
            translations[code] = translation

    if not translations:
        flash("Add at least one translation.", "error")
        return redirect(url_for("admin"))

    words.append({"id": word_id, "translations": translations})
    write_json(WORDS_FILE, words)
    flash("Word added.", "ok")
    return redirect(url_for("admin"))


# Delete an existing word by ID.
@app.post("/admin/delete_word")
def delete_word():
    if not is_admin_logged_in():
        flash(UNAUTHORIZED_ACCESS_MESSAGE, "error")
        return redirect(url_for("admin_login"))

    data = load_data()
    words = data["words"]
    word_id = (request.form.get("id") or "").strip()

    updated_words = [w for w in words if w.get("id") != word_id]

    if len(updated_words) == len(words):
        flash("Word not found.", "error")
        return redirect(url_for("admin"))

    write_json(WORDS_FILE, updated_words)
    flash("Word deleted.", "ok")
    return redirect(url_for("admin"))


# Expose current application data as JSON.
# Useful for frontend data loading and debugging.
@app.get("/api/data")
def api_data():
    return jsonify(load_data())


# Serve robots.txt from the static directory.
@app.get("/robots.txt")
def robots():
    return send_from_directory(STATIC_DIR, "robots.txt")


# Serve sitemap.xml from the static directory.
@app.get("/sitemap.xml")
def sitemap():
    return send_from_directory(STATIC_DIR, "sitemap.xml")


# Run the application with an environment-controlled host.
# The safer default is localhost for local development,
# while deployment environments can override it with FLASK_HOST.
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    host = os.environ.get("FLASK_HOST", "127.0.0.1")
    app.run(host=host, port=port, debug=debug)
