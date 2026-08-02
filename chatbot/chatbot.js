(() => {
  // ── CONFIG (set per client) ──────────────────────────────────────────────
  const CONFIG = {
    businessName: "ProRoof UK",
    replyTime: "ASAP",
    backendUrl: "/api/send",
  };

  // ── CHAT FLOW ────────────────────────────────────────────────────────────
  const STEPS = [
    {
      id: "job_type",
      botMessage: "Hi there! 👋 I'm here to help you get a **free quote**.\n\nWhat type of work do you need?",
      type: "options",
      options: ["🏠 Roof Repair", "🔨 New Roof", "🌧️ Guttering", "🔍 Inspection / Survey", "❓ Other"],
    },
    {
      id: "description",
      botMessage: "Got it! Can you briefly describe the issue or job?",
      type: "text",
      placeholder: "e.g. several tiles missing after the storm...",
    },
    {
      id: "photos",
      botMessage: "Thanks! 📸 Please upload any photos or videos — it helps us give you a more accurate quote.",
      type: "upload",
    },
    {
      id: "name",
      botMessage: "Almost done! What's your name?",
      type: "text",
      placeholder: "Your full name",
    },
    {
      id: "phone",
      botMessage: "And your phone number? We'll call or WhatsApp you.",
      type: "tel",
      placeholder: "07700 900000",
    },
    {
      id: "postcode",
      botMessage: "Last one — what's your postcode?",
      type: "text",
      placeholder: "e.g. SW1A 1AA",
    },
  ];

  // ── STATE ────────────────────────────────────────────────────────────────
  let currentStep = 0;
  let answers = {};
  let uploadedFiles = [];
  let isOpen = false;

  // ── BUILD DOM ────────────────────────────────────────────────────────────
  const bubble = document.createElement("div");
  bubble.id = "chat-bubble";
  bubble.innerHTML = `
    <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
  `;

  // ── PROACTIVE POPUP ──────────────────────────────────────────────────────
  const popup = document.createElement("div");
  popup.id = "chat-popup";
  popup.innerHTML = `
    <div class="popup-bubble" id="popup-cta">
      <span class="popup-close" id="popup-close">✕</span>
      <p>👋 Need a <strong>free quote</strong>?<br>Send photos — we reply in under an hour.</p>
    </div>
  `;

  const win = document.createElement("div");
  win.id = "chat-window";
  win.innerHTML = `
    <div class="chat-header">
      <div class="chat-header-avatar">🏠</div>
      <div class="chat-header-info">
        <h3>${CONFIG.businessName}</h3>
        <p><span class="online-dot"></span>Typically replies ${CONFIG.replyTime}</p>
      </div>
      <span class="chat-close" id="chat-close-btn">✕</span>
    </div>
    <div class="chat-messages" id="chat-messages"></div>
    <div class="chat-input-area" id="chat-input-area" style="display:none;">
      <input id="chat-text-input" type="text" placeholder="" autocomplete="off" />
      <button class="chat-send-btn" id="chat-send-btn">
        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </div>
  `;

  document.body.appendChild(popup);
  document.body.appendChild(bubble);
  document.body.appendChild(win);

  const messagesEl   = document.getElementById("chat-messages");
  const inputArea    = document.getElementById("chat-input-area");
  const textInput    = document.getElementById("chat-text-input");
  const sendBtn      = document.getElementById("chat-send-btn");

  // ── PROACTIVE POPUP LOGIC ─────────────────────────────────────────────────
  const dismissPopup = () => popup.classList.remove("visible");

  setTimeout(() => {
    if (!isOpen) popup.classList.add("visible");
  }, 1500);

  document.getElementById("popup-close").addEventListener("click", (e) => {
    e.stopPropagation();
    dismissPopup();
  });

  document.getElementById("popup-cta").addEventListener("click", () => {
    dismissPopup();
    bubble.click();
  });

  // ── OPEN / CLOSE ─────────────────────────────────────────────────────────
  const isMobile = () => window.innerWidth <= 420;

  function openChat() {
    isOpen = true;
    win.classList.add("open");
    bubble.classList.add("hidden");
    dismissPopup();
    if (isMobile()) document.body.classList.add("chat-open");
    if (currentStep === 0 && messagesEl.children.length === 0) {
      setTimeout(() => runStep(0), 300);
    }
  }

  function closeChat() {
    isOpen = false;
    win.classList.remove("open");
    bubble.classList.remove("hidden");
    document.body.classList.remove("chat-open");
    win.style.height = '';
    win.style.top = '';
    textInput.blur();
  }

  bubble.addEventListener("click", () => {
    isOpen ? closeChat() : openChat();
    dismissPopup();
  });

  document.getElementById("chat-close-btn").addEventListener("click", closeChat);

  // Resize chat window when keyboard opens on mobile
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (isMobile() && isOpen) {
        win.style.height = window.visualViewport.height + 'px';
        win.style.top = window.visualViewport.offsetTop + 'px';
        setTimeout(scrollBottom, 100);
      }
    });
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────
  function scrollBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
    messagesEl.lastElementChild?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }

  function addBotMsg(text, delay = 0) {
    return new Promise((resolve) => {
      const typing = document.createElement("div");
      typing.className = "msg bot typing";
      typing.innerHTML = `<div class="msg-bubble"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`;
      messagesEl.appendChild(typing);
      scrollBottom();

      setTimeout(() => {
        typing.remove();
        const msg = document.createElement("div");
        msg.className = "msg bot";
        msg.innerHTML = `<div class="msg-bubble">${formatText(text)}</div>`;
        messagesEl.appendChild(msg);
        scrollBottom();
        resolve();
      }, delay + 800);
    });
  }

  function addUserMsg(text) {
    const msg = document.createElement("div");
    msg.className = "msg user";
    msg.innerHTML = `<div class="msg-bubble">${escapeHtml(text)}</div>`;
    messagesEl.appendChild(msg);
    scrollBottom();
  }

  function formatText(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  // ── STEP RUNNER ───────────────────────────────────────────────────────────
  async function runStep(index) {
    if (index >= STEPS.length) {
      await submitLead();
      return;
    }

    const step = STEPS[index];

    // Hide input while bot is typing (keeps keyboard open if already focused)
    setInputDisabled(true);

    await addBotMsg(step.botMessage, 200);

    if (step.type === "options") {
      inputArea.style.display = "none";
      textInput.blur();
      showOptions(step.options);
    } else if (step.type === "upload") {
      inputArea.style.display = "none";
      textInput.blur();
      showUpload();
    } else {
      showTextInput(step.type, step.placeholder);
    }
  }

  function setInputDisabled(disabled) {
    textInput.disabled = disabled;
    sendBtn.disabled = disabled;
    sendBtn.style.opacity = disabled ? "0.4" : "1";
  }

  // ── OPTIONS ───────────────────────────────────────────────────────────────
  function showOptions(options) {
    const wrap = document.createElement("div");
    wrap.className = "chat-options";
    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "chat-option-btn";
      btn.textContent = opt;
      btn.addEventListener("click", () => {
        wrap.remove();
        addUserMsg(opt);
        answers[STEPS[currentStep].id] = opt;
        currentStep++;
        runStep(currentStep);
      });
      wrap.appendChild(btn);
    });
    messagesEl.appendChild(wrap);
    scrollBottom();
  }

  // ── TEXT INPUT ────────────────────────────────────────────────────────────
  function showTextInput(type, placeholder) {
    textInput.type = type;
    textInput.placeholder = placeholder || "";
    textInput.value = "";
    inputArea.style.display = "flex";
    setInputDisabled(false);
    textInput.focus();
  }

  function submitText() {
    const val = textInput.value.trim();
    if (!val || textInput.disabled) return;
    addUserMsg(val);
    answers[STEPS[currentStep].id] = val;
    textInput.value = "";
    currentStep++;
    runStep(currentStep);
  }

  sendBtn.addEventListener("click", submitText);
  textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitText();
  });

  // ── FILE UPLOAD ───────────────────────────────────────────────────────────
  function showUpload() {
    const wrap = document.createElement("div");
    wrap.className = "upload-area";
    wrap.innerHTML = `
      <span class="upload-icon">📷</span>
      <p>Tap to upload <strong>photos or videos</strong><br><small>JPG, PNG, MP4 — up to 10 files</small></p>
      <div class="upload-preview" id="upload-preview"></div>
      <input type="file" id="file-input" multiple accept="image/*,video/*">
    `;

    const skipWrap = document.createElement("div");
    skipWrap.className = "upload-skip";
    skipWrap.innerHTML = `<button id="skip-upload">Skip this step</button>`;

    messagesEl.appendChild(wrap);
    messagesEl.appendChild(skipWrap);
    scrollBottom();

    const fileInput = document.getElementById("file-input");
    const preview = document.getElementById("upload-preview");

    wrap.addEventListener("click", (e) => {
      if (e.target.closest("#upload-preview")) return;
      fileInput.click();
    });

    fileInput.addEventListener("change", () => {
      uploadedFiles = Array.from(fileInput.files).slice(0, 10);
      preview.innerHTML = "";
      uploadedFiles.forEach((file) => {
        const item = document.createElement("div");
        item.className = "upload-preview-item";
        if (file.type.startsWith("image/")) {
          const img = document.createElement("img");
          img.src = URL.createObjectURL(file);
          item.appendChild(img);
        } else {
          item.innerHTML = `<div class="file-icon">🎥</div>`;
        }
        preview.appendChild(item);
      });

      if (uploadedFiles.length > 0 && !document.getElementById("upload-continue")) {
        const cont = document.createElement("button");
        cont.id = "upload-continue";
        cont.className = "upload-continue";
        cont.textContent = `Continue with ${uploadedFiles.length} file${uploadedFiles.length > 1 ? "s" : ""}`;
        cont.addEventListener("click", proceedFromUpload);
        skipWrap.before(cont);
      } else if (document.getElementById("upload-continue")) {
        document.getElementById("upload-continue").textContent =
          `Continue with ${uploadedFiles.length} file${uploadedFiles.length > 1 ? "s" : ""}`;
      }
    });

    document.getElementById("skip-upload").addEventListener("click", proceedFromUpload);

    function proceedFromUpload() {
      wrap.remove();
      skipWrap.remove();
      const cont = document.getElementById("upload-continue");
      if (cont) cont.remove();

      const label = uploadedFiles.length > 0
        ? `📎 ${uploadedFiles.length} file${uploadedFiles.length > 1 ? "s" : ""} uploaded`
        : "No photos — that's fine!";
      addUserMsg(label);
      answers.photos_count = uploadedFiles.length;
      currentStep++;
      runStep(currentStep);
    }
  }

  // ── SUBMIT ────────────────────────────────────────────────────────────────
  async function submitLead() {
    inputArea.style.display = "none";
    textInput.blur();

    await addBotMsg(`Perfect, thanks **${answers.name}**! 🎉\n\nWe'll be in touch ${CONFIG.replyTime}. Keep an eye on your phone!`, 200);

    setTimeout(() => {
      const success = document.createElement("div");
      success.className = "success-msg";
      success.innerHTML = `
        <span class="success-icon">✅</span>
        <h4>Quote request sent!</h4>
        <p>We've received your details and will call or WhatsApp you shortly.</p>
      `;
      messagesEl.appendChild(success);
      scrollBottom();
    }, 1400);

    const formData = new FormData();
    Object.entries(answers).forEach(([k, v]) => formData.append(k, v));
    uploadedFiles.forEach((file) => formData.append("files[]", file));

    try {
      await fetch(CONFIG.backendUrl, { method: "POST", body: formData });
    } catch (e) {
      console.warn("Lead submission failed:", e);
    }
  }
})();
