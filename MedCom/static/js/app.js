// Frontend logic for MedCom:
// handles language selection, phrase rendering, translation display,
// recent phrase history, smart search, word lookup, and optional audio playback.

(function () {
  const data = window.MEDCOM_DATA;
  const languages = data.languages || {};
  const phrases = Array.isArray(data.phrases) ? data.phrases : [];
  const words = Array.isArray(data.words) ? data.words : [];

  const patientLangSel = document.getElementById("patientLang");
  const staffLangSel = document.getElementById("staffLang");
  const categoriesEl = document.getElementById("categories");
  const patientTextEl = document.getElementById("patientText");
  const staffTextEl = document.getElementById("staffText");
  const playBtn = document.getElementById("playAudio");
  const audioPlayer = document.getElementById("audioPlayer");

  const smartSearch = document.getElementById("smartSearch");
  const suggestionsEl = document.getElementById("suggestions");

  const wordSearch = document.getElementById("wordSearch");
  const wordResults = document.getElementById("wordResults");

  const recentEl = document.getElementById("recent");
  const RECENT_KEY = "medcom_recent";

  const state = { patientLang: null, staffLang: null, selected: null };

  const langName = (c) => languages?.[c]?.name || c;
  const tFor = (obj, code) => obj?.translations?.[code] || "";

  const categoryLabels = {
    Greetings: {
      sv: "Hälsning/Frågor",
      en: "Greetings/Questions",
      fr: "Salutations/Questions",
      sq: "Përshëndetje/Pyetje",
      ar: "التحية/الأسئلة",
      ru: "Приветствия/Вопросы",
    },
    Head: { sv: "Huvud", en: "Head", fr: "Tête", sq: "Kokë", ar: "الرأس", ru: "Голова" },
    Brain: { sv: "Hjärna", en: "Brain", fr: "Cerveau", sq: "Truri", ar: "الدماغ", ru: "Мозг" },
    Eye: { sv: "Öga", en: "Eye", fr: "Œil", sq: "Syri", ar: "العين", ru: "Глаз" },
    Ears: { sv: "Öron", en: "Ears", fr: "Oreilles", sq: "Veshët", ar: "الأذنان", ru: "Уши" },
    Chest: { sv: "Bröst", en: "Chest", fr: "Poitrine", sq: "Gjoks", ar: "الصدر", ru: "Грудь" },
    Heart: { sv: "Hjärta", en: "Heart", fr: "Cœur", sq: "Zemra", ar: "القلب", ru: "Сердце" },
    Stomach: { sv: "Mage", en: "Stomach", fr: "Ventre", sq: "Bark", ar: "البطن", ru: "Живот" },
    Back: { sv: "Rygg", en: "Back", fr: "Dos", sq: "Shpinë", ar: "الظهر", ru: "Спина" },
    Arm: { sv: "Arm", en: "Arm", fr: "Bras", sq: "Krah", ar: "الذراع", ru: "Рука" },
    Hand: { sv: "Hand", en: "Hand", fr: "Main", sq: "Dorë", ar: "اليد", ru: "Кисть" },
    Leg: { sv: "Ben", en: "Leg", fr: "Jambe", sq: "Këmbë", ar: "الساق", ru: "Нога" },
    Other: { sv: "Övrigt", en: "Other", fr: "Autre", sq: "Të tjera", ar: "أخرى", ru: "Другое" },
  };

  const categoryName = (cat, code) => categoryLabels?.[cat]?.[code] || cat;

  // Populate the patient/staff language dropdowns
  // and connect them to the application state.
  function fillLanguages() {
    patientLangSel.innerHTML = "";
    staffLangSel.innerHTML = "";

    Object.keys(languages).forEach((code) => {
      const patientOption = document.createElement("option");
      patientOption.value = code;
      patientOption.textContent = `${langName(code)} (${code})`;
      patientLangSel.appendChild(patientOption);

      const staffOption = document.createElement("option");
      staffOption.value = code;
      staffOption.textContent = `${langName(code)} (${code})`;
      staffLangSel.appendChild(staffOption);
    });

    const codes = Object.keys(languages);
    state.patientLang = codes.includes("en") ? "en" : codes[0];
    state.staffLang = codes.includes("sv") ? "sv" : codes[0];
    patientLangSel.value = state.patientLang;
    staffLangSel.value = state.staffLang;

    patientLangSel.addEventListener("change", () => {
      state.patientLang = patientLangSel.value;
      renderAll();
    });

    staffLangSel.addEventListener("change", () => {
      state.staffLang = staffLangSel.value;
      renderAll();
    });
  }

  // Update the currently selected phrase,
  // show both translations, store it in recent history,
  // and reset audio playback.
  function setSelected(p) {
    state.selected = p;
    patientTextEl.textContent = tFor(p, state.patientLang) || p.id;
    staffTextEl.textContent = tFor(p, state.staffLang) || p.id;
    pushRecent(p.id);

    audioPlayer.classList.add("hidden");
    audioPlayer.pause();
    audioPlayer.removeAttribute("src");
  }

  // Render the phrase library in two parallel columns
  // so both patient and staff can initiate communication.
  function renderCategories() {
    categoriesEl.innerHTML = "";

    const groups = {};
    phrases.forEach((p) => {
      const category = p.category || "Other";
      (groups[category] = groups[category] || []).push(p);
    });

    const wrapper = document.createElement("div");
    wrapper.className = "dual-phrase-wrapper";

    const patientBox = document.createElement("div");
    patientBox.className = "phrase-side-box";
    const patientTitle = document.createElement("div");
    patientTitle.className = "side-main-heading";
    patientTitle.textContent = `Patient (${langName(state.patientLang)})`;
    patientBox.appendChild(patientTitle);

    Object.keys(groups)
      .sort()
      .forEach((cat) => {
        const section = document.createElement("div");
        section.className = "category-section";

        const title = document.createElement("div");
        title.className = "section-title centered";
        title.textContent = categoryName(cat, state.patientLang);

        const grid = document.createElement("div");
        grid.className = "phrase-grid centered-grid";

        groups[cat].forEach((p) => {
          const btn = document.createElement("button");
          btn.className = "phrase-btn";
          btn.textContent = tFor(p, state.patientLang) || p.id;
          btn.addEventListener("click", () => setSelected(p));
          grid.appendChild(btn);
        });

        section.appendChild(title);
        section.appendChild(grid);
        patientBox.appendChild(section);
      });

    const staffBox = document.createElement("div");
    staffBox.className = "phrase-side-box";
    const staffTitle = document.createElement("div");
    staffTitle.className = "side-main-heading";
    staffTitle.textContent = `Staff (${langName(state.staffLang)})`;
    staffBox.appendChild(staffTitle);

    Object.keys(groups)
      .sort()
      .forEach((cat) => {
        const section = document.createElement("div");
        section.className = "category-section";

        const title = document.createElement("div");
        title.className = "section-title centered";
        title.textContent = categoryName(cat, state.staffLang);

        const grid = document.createElement("div");
        grid.className = "phrase-grid centered-grid";

        groups[cat].forEach((p) => {
          const btn = document.createElement("button");
          btn.className = "phrase-btn";
          btn.textContent = tFor(p, state.staffLang) || p.id;
          btn.addEventListener("click", () => setSelected(p));
          grid.appendChild(btn);
        });

        section.appendChild(title);
        section.appendChild(grid);
        staffBox.appendChild(section);
      });

    wrapper.appendChild(patientBox);
    wrapper.appendChild(staffBox);
    categoriesEl.appendChild(wrapper);
  }

  // Play prerecorded audio for the selected phrase if available.
  // Otherwise, use the browser's text-to-speech as fallback.
  function playAudio() {
    if (!state.selected) return;
    const p = state.selected;
    const path = p?.audio?.[state.patientLang];

    if (path) {
      audioPlayer.src = `/static/${path}`;
      audioPlayer.classList.remove("hidden");
      audioPlayer.play().catch(() => {});
      return;
    }

    const text = tFor(p, state.patientLang);
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languages?.[state.patientLang]?.tts || state.patientLang;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  // Load recently selected phrase IDs from localStorage.
  function loadRecent() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      const ids = raw ? JSON.parse(raw) : [];
      return Array.isArray(ids) ? ids : [];
    } catch {
      return [];
    }
  }

  // Add a phrase to recent history, avoid duplicates,
  // and keep only the five most recent entries.
  function pushRecent(id) {
    const ids = loadRecent().filter((x) => x !== id);
    ids.unshift(id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, 5)));
    renderRecent();
  }

  // Render the recent phrase history as clickable chips.
  function renderRecent() {
    recentEl.innerHTML = "";
    const ids = loadRecent();
    if (!ids.length) {
      recentEl.textContent = "No recent phrases.";
      return;
    }

    ids.forEach((id) => {
      const p = phrases.find((x) => x.id === id);
      if (!p) return;
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.textContent = tFor(p, state.patientLang) || id;
      chip.addEventListener("click", () => setSelected(p));
      recentEl.appendChild(chip);
    });
  }

  function phraseMatches(p, q) {
    const query = q.trim().toLowerCase();
    if (!query) return false;

    const keywords = Array.isArray(p.keywords) ? p.keywords : [];
    if (keywords.some((k) => String(k).toLowerCase().includes(query))) return true;

    return Object.values(p.translations || {}).some((v) =>
      String(v).toLowerCase().includes(query)
    );
  }

  // Render keyword-based phrase suggestions from short free-text input.
  function renderSuggestions() {
    if (!smartSearch || !suggestionsEl) return;
    suggestionsEl.innerHTML = "";
    const q = smartSearch.value.trim();
    if (!q) return;

    phrases
      .filter((p) => phraseMatches(p, q))
      .slice(0, 8)
      .forEach((p) => {
        const chip = document.createElement("div");
        chip.className = "chip";
        chip.textContent = tFor(p, state.patientLang) || p.id;
        chip.addEventListener("click", () => setSelected(p));
        suggestionsEl.appendChild(chip);
      });
  }

  // Render the searchable multilingual word list.
  function renderWords() {
    if (!wordSearch || !wordResults) return;
    wordResults.innerHTML = "";
    const q = (wordSearch.value || "").trim().toLowerCase();

    const filtered = !q
      ? words.slice(0, 30)
      : words.filter((w) =>
          Object.values(w.translations || {}).some((v) =>
            String(v).toLowerCase().includes(q)
          )
        );

    if (!filtered.length) {
      wordResults.textContent = "No words found.";
      return;
    }

    filtered.slice(0, 50).forEach((w) => {
      const row = document.createElement("div");
      row.className = "word-row";
      row.innerHTML = `
        <div><strong>${tFor(w, state.patientLang) || w.id}</strong><br><small>${w.id}</small></div>
        <div><strong>${tFor(w, state.staffLang) || ""}</strong><br><small>${langName(state.staffLang)}</small></div>
      `;
      wordResults.appendChild(row);
    });
  }

  // Re-render the main UI based on current state and language selection.
  function renderAll() {
    document.documentElement.dir = languages?.[state.patientLang]?.direction || "ltr";
    renderCategories();
    renderRecent();
    renderSuggestions();
    renderWords();

    if (state.selected) setSelected(state.selected);
    else if (phrases.length) setSelected(phrases[0]);
  }

  fillLanguages();
  renderAll();

  playBtn?.addEventListener("click", playAudio);
  smartSearch?.addEventListener("input", renderSuggestions);
  wordSearch?.addEventListener("input", renderWords);
})();
