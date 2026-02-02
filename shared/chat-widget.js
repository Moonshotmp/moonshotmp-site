/*
 * Moonshot Chat Widget (v2)
 * =========================
 * Floating AI assistant powered by RAG.
 * Loaded dynamically by footer.js on all public pages.
 */

(function () {
  // Don't load on admin/billing/partner pages
  const path = window.location.pathname;
  if (/^\/(admin|billing|partners)\//i.test(path)) return;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let isOpen = false;
  let isWaiting = false;
  let history = []; // { role: 'user'|'assistant', content: string }
  let savedScrollY = 0;

  // Persistence keys
  const STORAGE_KEY = "ms-chat-history";
  const STORAGE_OPEN_KEY = "ms-chat-open";

  function saveState() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) { /* quota exceeded — silently ignore */ }
  }

  function loadState() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) history = JSON.parse(raw);
    } catch (e) { history = []; }
  }
  let vpResizeRAF = null;
  const isMobile = () => window.innerWidth < 480;

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------

  const CHAT_API = "/.netlify/functions/chat";

  // Inject styles
  const style = document.createElement("style");
  style.textContent = `
    @keyframes ms-chat-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(178, 191, 190, 0.4); }
      50% { box-shadow: 0 0 0 10px rgba(178, 191, 190, 0); }
    }
    .ms-chat-pulse { animation: ms-chat-pulse 2s ease-in-out 3; }
    @keyframes ms-typing-dot {
      0%, 80%, 100% { opacity: 0.3; }
      40% { opacity: 1; }
    }
    .ms-typing-dot { animation: ms-typing-dot 1.4s infinite; }
    .ms-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .ms-typing-dot:nth-child(3) { animation-delay: 0.4s; }
    #ms-chat-panel { transition: opacity 0.2s, transform 0.2s; }
    #ms-chat-panel.ms-hidden { opacity: 0; transform: translateY(12px) scale(0.95); pointer-events: none; }
    .ms-source-pill {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 2px 8px;
      font-size: 11px;
      line-height: 1.4;
      color: rgba(178, 191, 190, 0.8);
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      text-decoration: none;
      transition: background 0.15s, color 0.15s;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ms-source-pill:hover {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.9);
    }
  `;
  document.head.appendChild(style);

  // Floating button
  const btn = document.createElement("button");
  btn.id = "ms-chat-btn";
  btn.setAttribute("aria-label", "Open chat");
  btn.className =
    "fixed bottom-5 right-5 z-[90] w-14 h-14 rounded-full bg-brand-slate border border-white/10 text-brand-light flex items-center justify-center shadow-lg hover:bg-brand-slate/80 transition cursor-pointer ms-chat-pulse";
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
  document.body.appendChild(btn);

  // Chat panel
  const panel = document.createElement("div");
  panel.id = "ms-chat-panel";
  panel.className =
    "fixed bottom-24 right-5 z-[90] w-[370px] max-w-[calc(100vw-2.5rem)] bg-brand-dark border border-white/10 rounded-lg shadow-2xl flex flex-col ms-hidden";
  panel.style.height = "min(520px, calc(100dvh - 8rem))";

  panel.innerHTML = `
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-green-400"></div>
        <span class="text-brand-light text-sm font-heading font-bold tracking-wide">Moonshot Assistant</span>
      </div>
      <button id="ms-chat-close" aria-label="Close chat" class="text-brand-gray hover:text-brand-light transition cursor-pointer">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>

    <!-- Messages -->
    <div id="ms-chat-messages" class="flex-1 overflow-y-auto px-4 py-3 space-y-3"></div>

    <!-- Input -->
    <div class="border-t border-white/10 px-3 py-3 shrink-0">
      <form id="ms-chat-form" class="flex gap-2">
        <input
          id="ms-chat-input"
          type="text"
          placeholder="Ask about our services..."
          autocomplete="off"
          class="flex-1 bg-brand-slate/50 border border-white/10 rounded-md px-3 py-2 text-sm text-brand-light placeholder-brand-gray/50 focus:outline-none focus:border-brand-gray/40"
        />
        <button
          type="submit"
          id="ms-chat-send"
          class="bg-brand-slate hover:bg-brand-slate/80 text-brand-light px-3 py-2 rounded-md transition cursor-pointer"
          aria-label="Send message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(panel);

  // Load any saved conversation from sessionStorage
  loadState();

  // Element refs
  const messagesEl = document.getElementById("ms-chat-messages");
  const formEl = document.getElementById("ms-chat-form");
  const inputEl = document.getElementById("ms-chat-input");
  const closeBtn = document.getElementById("ms-chat-close");

  // ---------------------------------------------------------------------------
  // Message rendering
  // ---------------------------------------------------------------------------

  function addMessage(role, text, sources) {
    const wrapper = document.createElement("div");
    wrapper.className =
      role === "user" ? "flex justify-end" : "flex justify-start";

    const container = document.createElement("div");
    container.className = "max-w-[85%]";

    const bubble = document.createElement("div");
    bubble.className =
      role === "user"
        ? "bg-brand-slate text-brand-light text-sm px-3 py-2 rounded-lg rounded-br-sm"
        : "bg-white/5 text-brand-light text-sm px-3 py-2 rounded-lg rounded-bl-sm";

    // Simple markdown-like rendering for assistant messages
    if (role === "assistant") {
      bubble.innerHTML = formatMessage(text);
    } else {
      bubble.textContent = text;
    }

    container.appendChild(bubble);

    // Render source pills below assistant messages
    if (role === "assistant" && sources && sources.length > 0) {
      const sourcesEl = document.createElement("div");
      sourcesEl.className = "flex flex-wrap gap-1 mt-1.5";

      for (const src of sources) {
        const pill = document.createElement("a");
        pill.href = "https://moonshotmp.com" + src.url;
        pill.target = "_blank";
        pill.rel = "noopener";
        pill.className = "ms-source-pill";
        pill.textContent = (src.title || src.url) + " \u2192";
        sourcesEl.appendChild(pill);
      }

      container.appendChild(sourcesEl);
    }

    wrapper.appendChild(container);
    messagesEl.appendChild(wrapper);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function formatMessage(text) {
    // Escape HTML first
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Links — [text](url)
    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener" class="underline hover:text-white">$1</a>'
    );
    // Line breaks
    html = html.replace(/\n/g, "<br>");
    return html;
  }

  function addTypingIndicator() {
    const wrapper = document.createElement("div");
    wrapper.className = "flex justify-start";
    wrapper.id = "ms-typing";

    const bubble = document.createElement("div");
    bubble.className =
      "bg-white/5 text-brand-gray text-sm px-4 py-3 rounded-lg rounded-bl-sm flex gap-1";
    bubble.innerHTML = `
      <span class="ms-typing-dot w-1.5 h-1.5 bg-brand-gray rounded-full inline-block"></span>
      <span class="ms-typing-dot w-1.5 h-1.5 bg-brand-gray rounded-full inline-block"></span>
      <span class="ms-typing-dot w-1.5 h-1.5 bg-brand-gray rounded-full inline-block"></span>
    `;

    wrapper.appendChild(bubble);
    messagesEl.appendChild(wrapper);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function removeTypingIndicator() {
    const el = document.getElementById("ms-typing");
    if (el) el.remove();
  }

  // Initial disclaimer message
  function showDisclaimer() {
    const wrapper = document.createElement("div");
    wrapper.className = "flex justify-start";

    const bubble = document.createElement("div");
    bubble.className =
      "max-w-[85%] bg-white/5 text-brand-gray text-xs px-3 py-2 rounded-lg rounded-bl-sm leading-relaxed";
    bubble.textContent =
      "I'm Moonshot's AI assistant. I can answer questions about our services, pricing, and programs. I'm not a medical provider \u2014 for personal health questions, please book a consultation.";

    wrapper.appendChild(bubble);
    messagesEl.appendChild(wrapper);
  }

  // ---------------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------------

  async function sendMessage(text) {
    if (isWaiting) return;
    isWaiting = true;

    addMessage("user", text);
    history.push({ role: "user", content: text });
    saveState();

    addTypingIndicator();
    inputEl.disabled = true;

    try {
      const resp = await fetch(CHAT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: history.slice(0, -1), // don't double-send current message
        }),
      });

      removeTypingIndicator();

      const data = await resp.json();

      if (!resp.ok) {
        addMessage(
          "assistant",
          data.reply || "Sorry, something went wrong. Please try again or contact us at 847-499-1266."
        );
        return;
      }

      const reply = data.reply || "Sorry, I couldn't generate a response.";
      const sources = data.sources || [];
      addMessage("assistant", reply, sources);
      history.push({ role: "assistant", content: reply });
      saveState();
    } catch (err) {
      removeTypingIndicator();
      addMessage(
        "assistant",
        "Sorry, I'm having trouble connecting. Please try again or call us at 847-499-1266."
      );
    } finally {
      isWaiting = false;
      inputEl.disabled = false;
      inputEl.focus();
    }
  }

  // ---------------------------------------------------------------------------
  // Mobile viewport / keyboard handling
  // ---------------------------------------------------------------------------

  // Block touch scroll on everything except the messages area
  function blockTouch(e) {
    if (messagesEl.contains(e.target)) return;
    e.preventDefault();
  }

  // Resize panel to match visual viewport (keyboard-aware)
  function syncViewportHeight() {
    if (vpResizeRAF) return;
    vpResizeRAF = requestAnimationFrame(() => {
      vpResizeRAF = null;
      if (!isMobile() || !isOpen) return;

      const vv = window.visualViewport;
      if (!vv) return;

      // Set panel height to visual viewport height and offset from top
      panel.style.height = vv.height + "px";
      panel.style.top = vv.offsetTop + "px";

      // Keep messages scrolled to bottom
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  function togglePanel() {
    isOpen = !isOpen;
    panel.classList.toggle("ms-hidden", !isOpen);
    btn.classList.remove("ms-chat-pulse");

    // Mobile: hide button, lock body scroll, block touch
    if (isMobile()) {
      btn.style.display = isOpen ? "none" : "";
      if (isOpen) {
        savedScrollY = window.scrollY;
        document.documentElement.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.top = -savedScrollY + "px";
        document.body.style.left = "0";
        document.body.style.right = "0";
        document.body.style.overflow = "hidden";
        document.addEventListener("touchmove", blockTouch, { passive: false });

        // Set initial height from visual viewport
        syncViewportHeight();
      } else {
        document.documentElement.style.overflow = "";
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.overflow = "";
        document.removeEventListener("touchmove", blockTouch);
        window.scrollTo(0, savedScrollY);
      }
    }

    if (isOpen) {
      if (typeof gtag === 'function') gtag('event', 'chat_open');
      // Show disclaimer + restore history on first open
      if (messagesEl.children.length === 0) {
        showDisclaimer();
        // Replay any saved messages from previous pages
        for (const msg of history) {
          addMessage(msg.role, msg.content);
        }
      }
      // Delay focus on mobile to avoid jarring keyboard pop
      if (!isMobile()) {
        inputEl.focus();
      }
    }
  }

  btn.addEventListener("click", togglePanel);
  closeBtn.addEventListener("click", togglePanel);

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = "";
    sendMessage(text);
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) togglePanel();
  });

  // iOS: reset viewport height after keyboard dismissal
  inputEl.addEventListener("blur", () => {
    if (!isMobile()) return;
    setTimeout(() => syncViewportHeight(), 150);
  });

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  function adjustLayout() {
    if (isMobile()) {
      panel.style.left = "0";
      panel.style.right = "0";
      panel.style.width = "auto";
      panel.style.bottom = "0";
      panel.style.top = "0";
      panel.style.borderRadius = "0";
      panel.style.maxHeight = "none";

      // Set height from visual viewport
      const vv = window.visualViewport;
      const h = vv ? vv.height : window.innerHeight;
      panel.style.height = h + "px";
    } else {
      panel.style.left = "";
      panel.style.right = "1.25rem";
      panel.style.width = "370px";
      panel.style.bottom = "6rem";
      panel.style.top = "";
      panel.style.borderRadius = "";
      panel.style.height = "min(520px, calc(100dvh - 8rem))";
      panel.style.maxHeight = "";
    }
  }

  adjustLayout();
  window.addEventListener("resize", adjustLayout);

  // Attach visualViewport listeners — this is the only reliable way
  // to track iOS Safari keyboard open/close
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncViewportHeight);
    window.visualViewport.addEventListener("scroll", syncViewportHeight);
  }

})();
