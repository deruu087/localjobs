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
    <div class="chat-input-area" id="chat-input-area" style="display:none;"></div>
  `;

  document.body.appendChild(popup);
  document.body.appendChild(bubble);
  document.body.appendChild(win);

  const messagesEl = document.getElementById("chat-messages");
  const inputArea = document.getElementById("chat-input-area");

  // ── PROACTIVE POPUP LOGIC ─────────────────────────────────────────────────
  const dismissPopup = () => popup.classList.remove("visible");

  // Show after 4 seconds if chat hasn't been opened
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
  bubble.addEventListener("click", () => {
    isOpen = !isOpen;
    win.classList.toggle("open", isOpen);
    bubble.classList.toggle("hidden", isOpen);
    dismissPopup();
    if (isOpen && currentStep === 0 && messagesEl.children.length === 0) {
      setTimeout(() => runStep(0), 300);
    }
  });

  document.getElementById("chat-close-btn").addEventListener("click", () => {
    isOpen = false;
    win.classList.remove("open");
    bubble.classList.remove("hidden");
  });

  // ── HELPERS ───────────────────────────────────────────────────────────────
  function scrollBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
    messagesEl.lastElementChild?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }

  function addBotMsg(text, delay = 0) {
    return new Promise((resolve) => {
      // Show typing
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
    await addBotMsg(step.botMessage, 200);

    inputArea.style.display = "none";
    inputArea.innerHTML = "";

    if (step.type === "options") {
      showOptions(step.options);
    } else if (step.type === "upload") {
      showUpload();
    } else {
      showTextInput(step.type, step.placeholder);
    }
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
    const input = document.createElement("input");
    input.type = type;
    input.placeholder = placeholder || "";

    const btn = document.createElement("button");
    btn.className = "chat-send-btn";
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;

    const submit = () => {
      const val = input.value.trim();
      if (!val) return;
      addUserMsg(val);
      answers[STEPS[currentStep].id] = val;
      inputArea.style.display = "none";
      inputArea.innerHTML = "";
      currentStep++;
      runStep(currentStep);
    };

    btn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });

    inputArea.appendChild(input);
    inputArea.appendChild(btn);
    inputArea.style.display = "flex";
    input.focus();
  }

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
        const cont = document.getElementById("upload-continue");
        cont.textContent = `Continue with ${uploadedFiles.length} file${uploadedFiles.length > 1 ? "s" : ""}`;
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
    await addBotMsg(`Perfect, thanks **${answers.name}**! 🎉\n\nWe'll be in touch ${CONFIG.replyTime}. Keep an eye on your phone!`, 200);

    // Show success
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

    // Send to backend
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
