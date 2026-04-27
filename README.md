# MedCom

MedCom is a web-based healthcare communication support application designed to reduce language barriers between patients and healthcare staff. The system uses predefined multilingual medical phrases instead of unrestricted free-text translation in order to provide safer, more structured, and more predictable communication in healthcare environments.

The application is built with a Python Flask backend and a browser-based frontend using HTML, CSS, and JavaScript. Core content is stored locally in JSON files.

---

## Overview

MedCom supports multilingual healthcare communication by allowing a patient and a healthcare professional to view the same phrase in different languages at the same time. The system is intended for controlled environments and local use.

The current version includes:
- dual language selection
- categorized predefined phrase library
- phrase selection and structured translation display
- smart search with keyword-based suggestions
- voice input for smart search
- recent phrases history
- optional audio playback
- word lookup functionality
- administrative content management
- admin authentication with username and password
- add and delete functions for phrases and words
- translated category headings based on selected language
- local-first operation

---

## Technologies Used

- Python
- Flask
- HTML
- CSS
- JavaScript
- JSON

---

## Project Structure

MedCom/
│
├── app.py
├── requirements.txt
├── data/
│   ├── languages.json
│   ├── phrases.json
│   └── words.json
│
├── templates/
│   ├── index.html
│   ├── info.html
│   ├── admin.html
│   └── admin_login.html
│
└── static/
    ├── css/
    │   └── styles.css
    ├── js/
    │   └── app.js
    ├── audio/
    ├── robots.txt
    └── sitemap.xml

## How to start the offline version of the application

1. Open the project folder and open a terminal in the folder where app.py and requirements.txt are located.
2. Create your own virtual environment named venv, for Window: python -m venv .venv, for macOS/Linux: python3 -m venv .venv
3. Activate the virtual environment for Windows: venv\Scripts\activate, for macOS/Linux: source .venv/bin/activate
4. Install all the dependencies from requirements.txt: pip install -r requirements.txt
5. Run the application with; python app.py for Windows, or python3 app.py for macOS/Linux

## Public deployment version
1. The app can also be accessed through this link: https://medcom-33wi.onrender.com/
2. But it only works if internet is available. 
