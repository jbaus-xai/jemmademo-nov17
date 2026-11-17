(() => {
  const STORAGE_KEY = "meridian-favorites";
  const quotes = window.QUOTES;
  const quoteById = new Map(quotes.map((quote) => [quote.id, quote]));

  const quoteEl = document.getElementById("quote");
  const textEl = document.getElementById("quote-text");
  const authorEl = document.getElementById("quote-author");
  const emptyEl = document.getElementById("empty-state");
  const newBtn = document.getElementById("new-quote");
  const favoriteBtn = document.getElementById("favorite-quote");
  const copyBtn = document.getElementById("copy-quote");
  const shareBtn = document.getElementById("share-quote");
  const favoritesModeBtn = document.getElementById("favorites-mode");
  const favoritesCountEl = document.getElementById("favorites-count");
  const toastEl = document.getElementById("toast");

  let currentId = null;
  let favoritesMode = false;
  let animating = false;
  let toastTimer = null;

  function getFavorites() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((id) => quoteById.has(id));
    } catch {
      return [];
    }
  }

  function setFavorites(ids) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }

  function isFavorite(id) {
    return getFavorites().includes(id);
  }

  function toggleFavorite(id) {
    const favorites = getFavorites();
    const next = favorites.includes(id)
      ? favorites.filter((favId) => favId !== id)
      : [...favorites, id];
    setFavorites(next);
    syncFavoritesCount();
    syncFavoriteButton();

    if (favoritesMode) {
      enterPoolState(true);
    }
  }

  function getActivePool() {
    if (!favoritesMode) return quotes;
    return getFavorites()
      .map((id) => quoteById.get(id))
      .filter(Boolean);
  }

  function pickQuote(pool) {
    if (pool.length === 0) return null;
    if (pool.length === 1) return pool[0];

    let next = pool[Math.floor(Math.random() * pool.length)];
    while (next.id === currentId) {
      next = pool[Math.floor(Math.random() * pool.length)];
    }
    return next;
  }

  function formatQuote(quote) {
    return `"${quote.text}" — ${quote.author}`;
  }

  function syncFavoritesCount() {
    favoritesCountEl.textContent = String(getFavorites().length);
  }

  function syncFavoriteButton() {
    const active = Boolean(currentId && isFavorite(currentId));
    favoriteBtn.classList.toggle("is-active", active);
    favoriteBtn.setAttribute("aria-pressed", active ? "true" : "false");
    favoriteBtn.disabled = !currentId;
  }

  function syncActionAvailability(hasQuote) {
    newBtn.disabled = !hasQuote && favoritesMode;
    copyBtn.disabled = !hasQuote;
    shareBtn.disabled = !hasQuote;
    favoriteBtn.disabled = !hasQuote;
  }

  function showEmptyState() {
    currentId = null;
    quoteEl.hidden = true;
    emptyEl.hidden = false;
    syncFavoriteButton();
    syncActionAvailability(false);
  }

  function showQuotePanel() {
    quoteEl.hidden = false;
    emptyEl.hidden = true;
  }

  function renderQuote(quote, animate) {
    if (!quote) {
      showEmptyState();
      return;
    }

    showQuotePanel();
    currentId = quote.id;

    const apply = () => {
      textEl.textContent = quote.text;
      authorEl.textContent = `— ${quote.author}`;
      syncFavoriteButton();
      syncActionAvailability(true);
    };

    if (!animate) {
      apply();
      return;
    }

    animating = true;
    quoteEl.classList.remove("is-entering");
    quoteEl.classList.add("is-leaving");

    window.setTimeout(() => {
      apply();
      quoteEl.classList.remove("is-leaving");
      quoteEl.classList.add("is-entering");
      animating = false;
    }, 280);
  }

  function enterPoolState(animate) {
    const pool = getActivePool();

    if (pool.length === 0) {
      showEmptyState();
      return;
    }

    const stillValid = currentId && pool.some((quote) => quote.id === currentId);
    if (stillValid) {
      showQuotePanel();
      syncFavoriteButton();
      syncActionAvailability(true);
      return;
    }

    renderQuote(pickQuote(pool), animate);
  }

  function showToast(message) {
    toastEl.hidden = false;
    toastEl.textContent = message;
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastEl.hidden = true;
    }, 1800);
  }

  async function copyQuoteText(payload) {
    try {
      await navigator.clipboard.writeText(payload);
      showToast("Copied to clipboard");
    } catch {
      showToast("Couldn’t copy — try selecting the text");
    }
  }

  async function copyQuote() {
    if (!currentId) return;
    const quote = quoteById.get(currentId);
    if (!quote) return;
    await copyQuoteText(formatQuote(quote));
  }

  async function shareQuote() {
    if (!currentId) return;
    const quote = quoteById.get(currentId);
    if (!quote) return;

    const text = formatQuote(quote);
    const sharePayload = { title: "Meridian", text };
    const shareAvailable = typeof navigator.share === "function";
    let canShareResult = null;
    if (shareAvailable && typeof navigator.canShare === "function") {
      try {
        canShareResult = navigator.canShare(sharePayload);
      } catch (error) {
        canShareResult = `canShare threw: ${error && error.name}`;
      }
    }

    // #region agent log
    {
      const payload = {
        sessionId: "58a681",
        runId: "pre-fix",
        hypothesisId: "A-B-D",
        location: "app.js:shareQuote:entry",
        message: "Share button clicked — environment check",
        data: {
          shareAvailable,
          canShareResult,
          isSecureContext: window.isSecureContext,
          protocol: window.location.protocol,
          href: window.location.href,
          hasCanShare: typeof navigator.canShare === "function",
          userAgent: navigator.userAgent,
        },
        timestamp: Date.now(),
      };
      const body = JSON.stringify(payload);
      try {
        navigator.sendBeacon(
          "http://127.0.0.1:7931/ingest/fb05fcdd-bfc4-4be3-b614-9b5d0938abfd",
          new Blob([body], { type: "application/json" })
        );
      } catch (_) {}
      fetch("http://127.0.0.1:7931/ingest/fb05fcdd-bfc4-4be3-b614-9b5d0938abfd", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "58a681",
        },
        body,
        mode: "cors",
      }).catch(() => {});
    }
    // #endregion

    if (shareAvailable) {
      try {
        await navigator.share(sharePayload);
        // #region agent log
        fetch(
          "http://127.0.0.1:7931/ingest/fb05fcdd-bfc4-4be3-b614-9b5d0938abfd",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "58a681",
            },
            body: JSON.stringify({
              sessionId: "58a681",
              runId: "pre-fix",
              hypothesisId: "E",
              location: "app.js:shareQuote:success",
              message: "navigator.share resolved successfully",
              data: { currentId },
              timestamp: Date.now(),
            }),
          }
        ).catch(() => {});
        // #endregion
        return;
      } catch (error) {
        // #region agent log
        fetch(
          "http://127.0.0.1:7931/ingest/fb05fcdd-bfc4-4be3-b614-9b5d0938abfd",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "58a681",
            },
            body: JSON.stringify({
              sessionId: "58a681",
              runId: "pre-fix",
              hypothesisId: "C",
              location: "app.js:shareQuote:catch",
              message: "navigator.share threw",
              data: {
                name: error && error.name,
                message: error && error.message,
                currentId,
              },
              timestamp: Date.now(),
            }),
          }
        ).catch(() => {});
        // #endregion
        if (error && error.name === "AbortError") return;
      }
    }

    // #region agent log
    fetch("http://127.0.0.1:7931/ingest/fb05fcdd-bfc4-4be3-b614-9b5d0938abfd", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "58a681",
      },
      body: JSON.stringify({
        sessionId: "58a681",
        runId: "pre-fix",
        hypothesisId: "A-C",
        location: "app.js:shareQuote:fallback",
        message: "Falling back to clipboard copy",
        data: { shareAvailable, currentId },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    await copyQuoteText(text);
  }

  function setFavoritesMode(next) {
    favoritesMode = next;
    favoritesModeBtn.classList.toggle("is-active", favoritesMode);
    favoritesModeBtn.setAttribute(
      "aria-pressed",
      favoritesMode ? "true" : "false"
    );
    enterPoolState(true);
  }

  newBtn.addEventListener("click", () => {
    if (animating || newBtn.disabled) return;
    const next = pickQuote(getActivePool());
    if (!next) {
      showEmptyState();
      return;
    }
    renderQuote(next, true);
  });

  favoriteBtn.addEventListener("click", () => {
    if (!currentId || favoriteBtn.disabled) return;
    toggleFavorite(currentId);
  });

  copyBtn.addEventListener("click", () => {
    copyQuote();
  });

  shareBtn.addEventListener("click", () => {
    shareQuote();
  });

  favoritesModeBtn.addEventListener("click", () => {
    setFavoritesMode(!favoritesMode);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === " " && event.target === document.body) {
      event.preventDefault();
      if (animating || newBtn.disabled) return;
      const next = pickQuote(getActivePool());
      if (next) renderQuote(next, true);
    }
  });

  syncFavoritesCount();
  renderQuote(pickQuote(getActivePool()), false);
  quoteEl.classList.add("is-entering");

  // #region agent log
  {
    const probe = {
      sessionId: "58a681",
      runId: "pre-fix",
      hypothesisId: "A-B",
      location: "app.js:startup",
      message: "Share API availability on page load",
      data: {
        shareAvailable: typeof navigator.share === "function",
        hasCanShare: typeof navigator.canShare === "function",
        isSecureContext: window.isSecureContext,
        protocol: window.location.protocol,
        href: window.location.href,
        userAgent: navigator.userAgent,
      },
      timestamp: Date.now(),
    };
    const body = JSON.stringify(probe);
    try {
      navigator.sendBeacon(
        "http://127.0.0.1:7931/ingest/fb05fcdd-bfc4-4be3-b614-9b5d0938abfd",
        new Blob([body], { type: "application/json" })
      );
    } catch (_) {}
    fetch("http://127.0.0.1:7931/ingest/fb05fcdd-bfc4-4be3-b614-9b5d0938abfd", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "58a681",
      },
      body,
    }).catch(() => {});
  }
  // #endregion
})();
