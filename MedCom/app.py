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

# Backend entry point for MedCom
# Loads JSON data, serves the UI/admin pages, handles authentication and ID auto-generation
app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Reusable constants for files and messages
LANGUAGES_FILE = "languages.json"
PHRASES_FILE = "phrases.json"
WORDS_FILE = "words.json"
UNAUTHORIZED_ACCESS_MESSAGE = "Unauthorized access."

# Admin credentials set via environment variables
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")
if not ADMIN_PASSWORD:
    raise RuntimeError("ADMIN_PASSWORD environment variable is required.")


# --- File I/O functions ---

# Read a JSON file from the data directory
def read_json(filename: str) -> Any:
    path = os.path.join(DATA_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# Write structured data to a JSON file
def write_json(filename: str, data: Any) -> None:
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# Load all data needed by frontend/admin pages
def load_data() -> Dict[str, Any]:
    return {
        "languages": read_json(LANGUAGES_FILE),
        "phrases": read_json(PHRASES_FILE),
        "words": read_json(WORDS_FILE),
    }


# --- Session / authentication functions ---

# Check if the current session has admin access
def is_admin_logged_in() -> bool:
    return bool(session.get("admin_logged_in", False))

# Generate the next available ID for phrases or words
def get_next_id(items: list, prefix: str) -> str:
    existing_ids = [i.get("id", "") for i in items]
    numbers = [int(i[len(prefix):]) for i in existing_ids if i.startswith(prefix) and i[len(prefix):].isdigit()]
    next_num = max(numbers, default=0) + 1
    return f"{prefix}{next_num}"


# --- Routes ---

# Render the main homepage with phrases, words, and languages
@app.get("/")
def index():
    data = load_data()
    return render_template("index.html", **data)

# Render the info page containing system description
@app.get("/info")
def info():
    return render_template("info.html")

# Handle admin login
@app.route("/admin-login", methods=["GET", "POST"])
def admin_login():
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

# Log out admin and clear session
@app.get("/admin-logout")
def admin_logout():
    session.pop("admin_logged_in", None)
    flash("You have been logged out.", "ok")
    return redirect(url_for("index"))

# Render admin page with phrase and word management
@app.get("/admin")
def admin():
    if not is_admin_logged_in():
        return redirect(url_for("admin_login"))
    data = load_data()
    return render_template("admin.html", **data)

# Add a new phrase
@app.post("/admin/add_phrase")
def add_phrase():
    if not is_admin_logged_in():
        flash(UNAUTHORIZED_ACCESS_MESSAGE, "error")
        return redirect(url_for("admin_login"))

    data = load_data()
    phrases = data["phrases"]
    languages = data["languages"]

    # Automatically generate phrase ID if not provided
    phrase_id = (request.form.get("id") or "").strip() or get_next_id(phrases, "P")
    category = (request.form.get("category") or "").strip()
    keywords_raw = (request.form.get("keywords") or "").strip()

    if not category:
        flash("Category is required.", "error")
        return redirect(url_for("admin"))

    if any(p.get("id") == phrase_id for p in phrases):
        flash("Phrase ID already exists.", "error")
        return redirect(url_for("admin"))

    translations: Dict[str, str] = {}
    audio: Dict[str, str] = {}

    # Collect translations and audio paths
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
        {"id": phrase_id, "category": category, "translations": translations, "audio": audio, "keywords": keywords}
    )
    write_json(PHRASES_FILE, phrases)
    flash("Phrase added.", "ok")
    return redirect(url_for("admin"))

# Delete a phrase by ID
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

# Add a new word
@app.post("/admin/add_word")
def add_word():
    if not is_admin_logged_in():
        flash(UNAUTHORIZED_ACCESS_MESSAGE, "error")
        return redirect(url_for("admin_login"))

    data = load_data()
    words = data["words"]
    languages = data["languages"]

    # Automatically generate word ID if not provided
    word_id = (request.form.get("id") or "").strip() or get_next_id(words, "W")
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
    write_json(WORDS_FILE, words)
    flash("Word added.", "ok")
    return redirect(url_for("admin"))

# Delete a word by ID
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

# API endpoint for frontend data
@app.get("/api/data")
def api_data():
    return jsonify(load_data())

# Serve robots.txt file
@app.get("/robots.txt")
def robots():
    return send_from_directory(STATIC_DIR, "robots.txt")

# Serve sitemap.xml file
@app.get("/sitemap.xml")
def sitemap():
    return send_from_directory(STATIC_DIR, "sitemap.xml")

# Run the app locally or via deployment host
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    host = os.environ.get("FLASK_HOST", "127.0.0.1")
    app.run(host=host, port=port, debug=debug)
