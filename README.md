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

## How to start the offline version of the application

1. Download the zip file and extract the folder.
2. Open the folder and delete the .gitignore file and __pycache__ folder.
3. Open the MedCom (be sure that you opened MedCom and not MedCom-main) folder in VSCode.
4. Open a new terminal in the folder where app.py and requirements.txt are located.
5. Create your own virtual environment named venv:
- Windows: python -m venv venv
- macOS/Linux: python3 -m venv venv
6. Activate the virtual environment:
- Windows: venv\Scripts\activate
- macOS/Linux: source venv/bin/activate
7. Install all the dependencies: 
- pip install -r requirements.txt
8. Set your admin password for the session with this command;
Windows:
- $env:ADMIN_PASSWORD="YourStrongPassword123!"
macOS/Linux:
- export ADMIN_PASSWORD="YourStrongPassword123!"
9. Run the application with: 
- Windows python app.py
- macOS/Linux: python3 app.py
10. Open http://127.0.0.1:5000

OBS!
PLease note that the password that you set is only temporary for each session. If you want a persistent password you need to change it in the environment variables. More specifically line 36 in app.py:
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "YourStrongPassword123!")

## Public deployment version
1. The app can also be accessed through this link: https://medcom-33wi.onrender.com/
2. But it only works if internet is available. 


---

## Project Structure

```text id="6n4m9x"
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
