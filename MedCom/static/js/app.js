// Frontend logic for MedCom
// Handles language selection, phrase rendering, translation display,
// recent phrase history, smart search, word lookup, optional audio playback,
// and voice input for smart search.

(function () {
  const data = globalThis.MEDCOM_DATA;
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

  // Voice search UI elements
  const startVoiceSearchBtn = document.getElementById("startVoiceSearch");
  const stopVoiceSearchBtn = document.getElementById("stopVoiceSearch");
  const voiceStatusEl = document.getElementById("voiceStatus");

  const state = {
    patientLang: null,
    staffLang: null,
    selected: null,
    recognition: null,
    isListening: false,
  };

  const langName = (c) => languages?.[c]?.name || c;
  const tFor = (obj, code) => obj?.translations?.[code] || "";

  const categoryLabels = {
    Greetings: { sv: "Hälsning/Frågor", en: "Greetings/Questions", fr: "Salutations/Questions", sq: "Përshëndetje/Pyetje", ar: "التحية/الأسئلة", ru: "Приветствия/Вопросы" },
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

  // --- UI helper functions ---

  // Sets the voice search status message
  function setVoiceStatus(message) {
    if (!voiceStatusEl) return;
    voiceStatusEl.textContent = message;
  }

  // Returns the correct locale for speech recognition
  function speechLocaleForSearch() {
    return languages?.[state.patientLang]?.tts || state.patientLang || "en-US";
  }

  // Sorts category keys alphabetically
  function sortedCategoryKeys(groups, locale) {
    return Object.keys(groups).sort((a, b) => a.localeCompare(b, locale));
  }

  // Creates a clickable phrase button
  function createPhraseButton(text, phrase) {
    const btn = document.createElement("button");
    btn.className = "phrase-btn";
    btn.textContent = text;
    btn.addEventListener("click", () => setSelected(phrase));
    return btn;
  }

  // Creates a collapsible section for a category
  function createCategorySection(titleText, phrasesInCategory, languageCode, isOpen = false) {
    const section = document.createElement("div");
    section.className = "category-section collapsible-section";

    const toggle = document.createElement("button");
    toggle.className = "category-toggle";
    toggle.type = "button";
    toggle.textContent = titleText;

    const content = document.createElement("div");
    content.className = "category-content";
    if (!isOpen) content.classList.add("hidden");

    const grid = document.createElement("div");
    grid.className = "phrase-grid centered-grid";

    phrasesInCategory.forEach(p => grid.appendChild(createPhraseButton(tFor(p, languageCode) || p.id, p)));

    toggle.addEventListener("click", () => content.classList.toggle("hidden"));

    content.appendChild(grid);
    section.appendChild(toggle);
    section.appendChild(content);

    return section;
  }

  // Creates a side box for patient or staff phrases
  function createPhraseSideBox(roleTitle, languageCode, groups) {
    const box = document.createElement("div");
    box.className = "phrase-side-box";

    const heading = document.createElement("div");
    heading.className = "side-main-heading";
    heading.textContent = `${roleTitle} (${langName(languageCode)})`;
    box.appendChild(heading);

    sortedCategoryKeys(groups, languageCode).forEach((cat, index) => {
      box.appendChild(createCategorySection(categoryName(cat, languageCode), groups[cat], languageCode, index === 0));
    });

    return box;
  }

  // --- Core functions ---

  // Populate the language selectors for patient and staff
  function fillLanguages() {
    patientLangSel.innerHTML = "";
    staffLangSel.innerHTML = "";

    Object.keys(languages).forEach(code => {
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
      updateRecognitionLanguage();
      renderAll();
    });

    staffLangSel.addEventListener("change", () => {
      state.staffLang = staffLangSel.value;
      renderAll();
    });
  }

  // Updates the currently selected phrase and recent history
  function setSelected(p) {
    state.selected = p;
    patientTextEl.textContent = tFor(p, state.patientLang) || p.id;
    staffTextEl.textContent = tFor(p, state.staffLang) || p.id;
    pushRecent(p.id);

    audioPlayer.classList.add("hidden");
    audioPlayer.pause();
    audioPlayer.removeAttribute("src");
  }

  // Render all phrase categories as collapsible panels
  function renderCategories() {
    categoriesEl.innerHTML = "";

    const groups = {};
    phrases.forEach(p => {
      const cat = p.category || "Other";
      (groups[cat] = groups[cat] || []).push(p);
    });

    const wrapper = document.createElement("div");
    wrapper.className = "dual-phrase-wrapper";

    wrapper.appendChild(createPhraseSideBox("Patient", state.patientLang, groups));
    wrapper.appendChild(createPhraseSideBox("Staff", state.staffLang, groups));

    categoriesEl.appendChild(wrapper);
  }

  // Play prerecorded audio or TTS for selected phrase
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

  // Load recent phrases from localStorage
  function loadRecent() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      const ids = raw ? JSON.parse(raw) : [];
      return Array.isArray(ids) ? ids : [];
    } catch {
      return [];
    }
  }

  // Add a phrase to recent history
  function pushRecent(id) {
    const ids = loadRecent().filter(x => x !== id);
    ids.unshift(id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, 5)));
    renderRecent();
  }

  // Render recent phrases
  function renderRecent() {
    recentEl.innerHTML = "";
    const ids = loadRecent();
    if (!ids.length) { recentEl.textContent = "No recent phrases."; return; }
    ids.forEach(id => {
      const p = phrases.find(x => x.id === id);
      if (!p) return;
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.textContent = tFor(p, state.patientLang) || id;
      chip.addEventListener("click", () => setSelected(p));
      recentEl.appendChild(chip);
    });
  }

  // Check if phrase matches a query
  function phraseMatches(p, q) {
    const query = q.trim().toLowerCase();
    if (!query) return false;
    const keywords = Array.isArray(p.keywords) ? p.keywords : [];
    return keywords.some(k => k.toLowerCase().includes(query)) ||
      Object.values(p.translations || {}).some(v => String(v).toLowerCase().includes(query));
  }

  // Render suggested phrases for smart search
  function renderSuggestions() {
    if (!smartSearch || !suggestionsEl) return;
    suggestionsEl.innerHTML = "";
    const q = smartSearch.value.trim();
    if (!q) return;

    phrases.filter(p => phraseMatches(p, q)).slice(0, 8).forEach(p => {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.textContent = tFor(p, state.patientLang) || p.id;
      chip.addEventListener("click", () => setSelected(p));
      suggestionsEl.appendChild(chip);
    });
  }

  // Render multilingual word list
  function renderWords() {
    if (!wordSearch || !wordResults) return;
    wordResults.innerHTML = "";
    const q = (wordSearch.value || "").trim().toLowerCase();
    const filtered = !q ? words.slice(0, 30) :
      words.filter(w => Object.values(w.translations || {}).some(v => String(v).toLowerCase().includes(q)));
    if (!filtered.length) { wordResults.textContent = "No words found."; return; }
    filtered.slice(0, 50).forEach(w => {
      const row = document.createElement("div");
      row.className = "word-row";
      row.innerHTML = `<div><strong>${tFor(w,state.patientLang)||w.id}</strong><br><small>${w.id}</small></div>
                       <div><strong>${tFor(w,state.staffLang)||""}</strong><br><small>${langName(state.staffLang)}</small></div>`;
      wordResults.appendChild(row);
    });
  }

  // Initialize voice search functionality
  function initVoiceSearch() {
    const SpeechRecognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus("Voice search is not supported in this browser.");
      if(startVoiceSearchBtn) startVoiceSearchBtn.disabled=true;
      if(stopVoiceSearchBtn) stopVoiceSearchBtn.disabled=true;
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = speechLocaleForSearch();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      state.isListening = true;
      setVoiceStatus("Listening...");
      if (startVoiceSearchBtn) startVoiceSearchBtn.disabled = true;
      if (stopVoiceSearchBtn) stopVoiceSearchBtn.disabled = false;
    };

    recognition.onresult = (event) => {
      const transcript = event?.results?.[0]?.[0]?.transcript?.trim() || "";
      if (!transcript || !smartSearch) return;
      smartSearch.value = transcript;
      renderSuggestions();
      setVoiceStatus(`Heard: ${transcript}`);
    };

    recognition.onerror = (event) => {
      const message = event?.error ? `Voice search error: ${event.error}` : "Voice search failed.";
      setVoiceStatus(message);
    };

    recognition.onend = () => {
      state.isListening = false;
      if (startVoiceSearchBtn) startVoiceSearchBtn.disabled = false;
      if (stopVoiceSearchBtn) stopVoiceSearchBtn.disabled = true;
      if (!(voiceStatusEl?.textContent || "").startsWith("Heard:")) setVoiceStatus("Voice search stopped.");
    };

    state.recognition = recognition;

    if (startVoiceSearchBtn) {
      startVoiceSearchBtn.addEventListener("click", () => {
        if (!state.recognition || state.isListening) return;
        state.recognition.lang = speechLocaleForSearch();
        setVoiceStatus("Starting voice search...");
        state.recognition.start();
      });
    }

    if (stopVoiceSearchBtn) {
      stopVoiceSearchBtn.addEventListener("click", () => {
        if (!state.recognition || !state.isListening) return;
        state.recognition.stop();
        stopVoiceSearchBtn.disabled = true;
      });
    }

    setVoiceStatus("Voice search is ready.");
  }

  // Update recognition language dynamically
  function updateRecognitionLanguage() {
    if (!state.recognition) return;
    state.recognition.lang = speechLocaleForSearch();
  }

  // Render the full UI based on current state and language
  function renderAll() {
    document.documentElement.dir = languages?.[state.patientLang]?.direction || "ltr";
    renderCategories(); renderRecent(); renderSuggestions(); renderWords();
    if(state.selected){setSelected(state.selected); return;}
    if(phrases.length) setSelected(phrases[0]);
  }

  // --- Initialize app ---
  fillLanguages();
  initVoiceSearch();
  renderAll();

  playBtn?.addEventListener("click", playAudio);
  smartSearch?.addEventListener("input", renderSuggestions);
  wordSearch?.addEventListener("input", renderWords);

})();
