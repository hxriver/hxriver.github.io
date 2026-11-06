/* ==========================================================================
   Site interactions
   --------------------------------------------------------------------------
   Vanilla JS, no dependencies. Loaded after the theme bundle so it can
   override the theme's jQuery smooth-scroll behaviour for in-page anchors.

   Handles four things:
     1. light / dark theme
     2. deck <-> scroll layout switch on the panel homepage
     3. panel navigation (arrows, footer nav, keyboard) in deck mode
     4. the news "show all" toggle
   ========================================================================== */

(function () {
  "use strict";

  var root = document.documentElement;
  var themeToggle = document.getElementById("hz-theme-switch");
  var layoutToggle = document.getElementById("hz-layout-switch");
  var deck = document.querySelector(".hz-deck");
  var arrowPrev = document.getElementById("hz-arrow-prev");
  var arrowNext = document.getElementById("hz-arrow-next");
  var footerLinks = [].slice.call(document.querySelectorAll(".hz-footer-nav a[data-hz-section]"));

  /* Wheel / swipe -> page turn tuning */
  var WHEEL_THRESHOLD = 60; /* px of accumulated vertical travel for one turn */
  var WHEEL_COOLDOWN = 420; /* ms during which further input is ignored */
  var SWIPE_THRESHOLD = 48; /* px of vertical touch travel for one turn */

  var wheelAccumulator = 0;
  var wheelLockedUntil = 0;
  var touchStart = null;
  var touchDelta = 0;

  /* The panel we are animating towards. While a page turn is in flight the
     deck sits between two panels, so the geometric position is ambiguous —
     this keeps the footer highlight and the keyboard arrows on the panel the
     reader is actually heading to. */
  var targetIndex = null;
  var settleTimer = null;

  /* --------------------------------------------------------------------
     1. Light / dark theme
     -------------------------------------------------------------------- */

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    }
  }

  applyTheme(root.getAttribute("data-theme") || "light");

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem("theme", next);
      } catch (e) {}
    });
  }

  /* --------------------------------------------------------------------
     2 + 3. Deck layout and panel navigation
     -------------------------------------------------------------------- */

  function isDeck() {
    return root.getAttribute("data-layout") === "deck" && !!deck;
  }

  function panels() {
    if (!deck) return [];
    return [].slice.call(deck.querySelectorAll(".hz-panel"));
  }

  function panelById(id) {
    if (!id) return null;
    return document.getElementById(id);
  }

  function topbarOffset() {
    var bar = document.querySelector(".hz-topbar");
    return (bar ? bar.offsetHeight : 64) + 16;
  }

  function currentIndex() {
    if (!deck) return 0;
    var width = deck.clientWidth || 1;
    return Math.max(0, Math.min(panels().length - 1, Math.round(deck.scrollLeft / width)));
  }

  /* The panel the reader is currently looking at.

     In deck mode that is the panel filling the viewport; in scroll mode it is
     the last panel whose top has passed under the fixed top bar. */
  function activeIndex() {
    var list = panels();
    if (!list.length) return 0;
    if (isDeck()) {
      /* While a page turn is animating the deck sits between two panels, so
         the geometric position is ambiguous — trust the destination. */
      if (targetIndex !== null) return targetIndex;
      return currentIndex();
    }

    var probe = window.pageYOffset + topbarOffset() + 8;
    var index = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].getBoundingClientRect().top + window.pageYOffset <= probe) {
        index = i;
      }
    }
    return index;
  }

  function scrollDeckTo(panel, behavior) {
    if (!deck || !panel) return;
    var deckRect = deck.getBoundingClientRect();
    var panelRect = panel.getBoundingClientRect();
    var left = deck.scrollLeft + (panelRect.left - deckRect.left);
    if (typeof deck.scrollTo === "function") {
      deck.scrollTo({ left: left, behavior: behavior || "smooth" });
    } else {
      deck.scrollLeft = left;
    }
  }

  function setActive(index) {
    var list = panels();
    if (!list.length) return;
    var active = list[Math.max(0, Math.min(list.length - 1, index))];

    footerLinks.forEach(function (link) {
      var isCurrent = link.getAttribute("data-hz-section") === active.id;
      if (isCurrent) {
        link.setAttribute("aria-current", "true");
      } else {
        link.setAttribute("aria-current", "false");
      }
    });

    if (arrowPrev) arrowPrev.hidden = index <= 0;
    if (arrowNext) arrowNext.hidden = index >= list.length - 1;
  }

  function goToPanel(index, behavior) {
    var list = panels();
    if (!list.length) return;
    var clamped = Math.max(0, Math.min(list.length - 1, index));
    targetIndex = clamped;
    scrollDeckTo(list[clamped], behavior);
    setActive(clamped);
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", "#" + list[clamped].id);
    }
  }

  function setLayout(mode) {
    /* Remember where the reader is *before* the layout changes, so switching
       back to deck mode returns to the same panel. */
    var activeId = currentId();
    targetIndex = null;

    root.setAttribute("data-layout", mode);
    try {
      localStorage.setItem("homepage-layout", mode);
    } catch (e) {}

    if (layoutToggle) {
      var deckMode = mode === "deck";
      layoutToggle.setAttribute("aria-pressed", deckMode ? "false" : "true");
      layoutToggle.setAttribute("aria-label", deckMode ? "Switch to vertical scroll mode" : "Switch to deck mode");
      layoutToggle.title = deckMode ? "Switch to vertical scroll mode" : "Switch to deck mode";
    }

    if (mode === "deck") {
      var panel = panelById(activeId);
      if (panel) {
        window.requestAnimationFrame(function () {
          scrollDeckTo(panel, "auto");
        });
      }
    }
    setActive(indexOf(activeId));
  }

  function indexOf(id) {
    var list = panels();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return i;
    }
    return 0;
  }

  function currentId() {
    var list = panels();
    if (!list.length) return null;
    return list[activeIndex()].id;
  }

  if (layoutToggle) {
    layoutToggle.addEventListener("click", function () {
      setLayout(root.getAttribute("data-layout") === "deck" ? "scroll" : "deck");
    });
  }

  if (arrowPrev) {
    arrowPrev.addEventListener("click", function () {
      goToPanel(activeIndex() - 1);
    });
  }

  if (arrowNext) {
    arrowNext.addEventListener("click", function () {
      goToPanel(activeIndex() + 1);
    });
  }

  /* Footer navigation and in-page anchors.

     Handled in the capture phase so the theme's jQuery smooth-scroll plugin
     (bound on the bubble phase) never double-animates. */
  document.addEventListener(
    "click",
    function (e) {
      var node = e.target;
      while (node && node.nodeType !== 1) {
        node = node.parentNode;
      }
      if (!node || !node.closest) return;

      var link = node.closest('a[href^="#"]');
      if (!link) return;

      var hash = link.getAttribute("href");
      if (!hash || hash === "#") return;

      if (link.pathname && link.pathname !== window.location.pathname) return;

      var id = hash.slice(1);
      var target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();

      if (isDeck() && target.classList.contains("hz-panel")) {
        goToPanel(indexOf(id));
      } else {
        var top = target.getBoundingClientRect().top + window.pageYOffset - topbarOffset();
        window.scrollTo({ top: top, behavior: "smooth" });
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, "", hash);
        }
      }
    },
    true
  );

  /* Keyboard navigation in deck mode */
  document.addEventListener("keydown", function (e) {
    if (!isDeck()) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      goToPanel(activeIndex() + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goToPanel(activeIndex() - 1);
    }
  });

  /* --------------------------------------------------------------------
     2b. Wheel / swipe paging
     --------------------------------------------------------------------
     In deck mode the page itself does not scroll: the panels sit side by
     side inside a horizontally snapping container. A vertical wheel or
     swipe therefore has to be translated into a page turn.

     The rule is "scroll the content first, turn the page when the content
     is exhausted": if the panel under the pointer still has room to scroll
     in the direction of the gesture, the gesture scrolls it and the page
     stays put. Only once the panel has reached its edge does the gesture
     flip to the next panel. Without that rule the long panels
     (Publications, News) would be unreachable in deck mode. */

  /* The panel that is under the pointer, or the one on screen as a fallback. */
  function panelAtPoint(x, y) {
    var list = panels();
    if (!list.length) return null;
    if (typeof x !== "number" || typeof y !== "number") {
      return list[activeIndex()];
    }
    var el = document.elementFromPoint(x, y);
    while (el && el !== document.body) {
      if (el.classList && el.classList.contains("hz-panel")) return el;
      el = el.parentElement;
    }
    return list[activeIndex()];
  }

  /* Can this element still scroll further in the given direction?
     `direction` is -1 for up / back, +1 for down / forward. */
  function canScroll(el, direction) {
    if (!el) return false;
    var overflow = el.scrollHeight - el.clientHeight;
    if (overflow <= 1) return false;
    if (direction > 0) {
      return el.scrollTop < overflow - 1;
    }
    return el.scrollTop > 1;
  }

  /* The scrollable ancestor of the element under the pointer — the panel
     itself, or a nested scroller inside it. */
  function scrollableUnder(x, y) {
    var el = document.elementFromPoint(x, y);
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.scrollHeight - el.clientHeight > 1) {
        var overflowY = window.getComputedStyle(el).overflowY;
        if (overflowY === "auto" || overflowY === "scroll") return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function turnPage(direction) {
    var list = panels();
    if (!list.length) return;
    var next = activeIndex() + direction;
    if (next < 0 || next >= list.length) return;
    goToPanel(next);
  }

  if (deck) {
    /* Wheel: accumulate deltaY until it crosses the threshold, then turn
       exactly one page. The cooldown stops a single flick from skipping
       several panels in a row.

       The listener sits on the window rather than on the deck so that a
       gesture over the fixed top bar or footer still turns the page. */
    window.addEventListener(
      "wheel",
      function (e) {
        if (!isDeck()) return;
        if (e.ctrlKey) return; /* pinch-zoom */

        var dy = e.deltaY;
        if (!dy) return;

        var dx = e.deltaX || 0;

        /* A gesture that is mostly horizontal belongs to the deck's own
           snap scrolling — leave it to the browser. */
        if (Math.abs(dx) > Math.abs(dy)) {
          wheelAccumulator = 0;
          return;
        }

        var direction = dy > 0 ? 1 : -1;
        var scroller = scrollableUnder(e.clientX, e.clientY);

        /* Let the panel's own content scroll while it still can. */
        if (canScroll(scroller, direction)) {
          wheelAccumulator = 0;
          return;
        }

        /* The content is exhausted, so the gesture means "next panel".
           Stop the browser from scrolling the document underneath. */
        e.preventDefault();

        var now = Date.now();
        if (now < wheelLockedUntil) return;

        wheelAccumulator += dy;
        if (Math.abs(wheelAccumulator) < WHEEL_THRESHOLD) return;

        wheelAccumulator = 0;
        wheelLockedUntil = now + WHEEL_COOLDOWN;
        turnPage(direction);
      },
      { passive: false }
    );

    /* Touch: a vertical swipe turns the page. A horizontal swipe is left to
       the browser so the deck keeps its native snap scrolling. */
    window.addEventListener(
      "touchstart",
      function (e) {
        if (!isDeck()) return;
        if (e.touches.length !== 1) {
          touchStart = null;
          return;
        }
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        touchDelta = 0;
      },
      { passive: true }
    );

    window.addEventListener(
      "touchmove",
      function (e) {
        if (!isDeck() || !touchStart || e.touches.length !== 1) return;
        touchDelta = e.touches[0].clientY - touchStart.y;
      },
      { passive: true }
    );

    window.addEventListener(
      "touchend",
      function (e) {
        if (!isDeck() || !touchStart) return;
        var dy = touchDelta;
        var dx = e.changedTouches.length
          ? e.changedTouches[0].clientX - touchStart.x
          : 0;
        touchStart = null;
        touchDelta = 0;

        /* Ignore gestures that are mostly horizontal — the deck snaps on its
           own for those. */
        if (Math.abs(dx) > Math.abs(dy)) return;
        if (Math.abs(dy) < SWIPE_THRESHOLD) return;

        turnPage(dy < 0 ? 1 : -1);
      },
      { passive: true }
    );
  }

  /* Keep the footer navigation in sync with the panel that is on screen */
  if (deck) {
    var ticking = false;

    function syncActive() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        /* Once the deck has come to rest, the geometric position is
           authoritative again. */
        if (targetIndex !== null && currentIndex() === targetIndex) {
          targetIndex = null;
        }
        setActive(activeIndex());
      });
    }

    deck.addEventListener("scroll", syncActive, { passive: true });
    window.addEventListener("scroll", syncActive, { passive: true });

    window.addEventListener("resize", function () {
      if (isDeck()) {
        var panel = panelById(currentId());
        if (panel) scrollDeckTo(panel, "auto");
      }
    });

    /* Restore the panel referenced by the URL hash on first load */
    window.addEventListener("load", function () {
      var id = (window.location.hash || "").slice(1);
      var panel = panelById(id);
      if (panel && isDeck()) {
        scrollDeckTo(panel, "auto");
        setActive(indexOf(id));
      } else {
        setActive(activeIndex());
      }
    });

    setActive(activeIndex());
  }

  /* --------------------------------------------------------------------
     4. News "show all" toggle
     -------------------------------------------------------------------- */

  [].slice.call(document.querySelectorAll("[data-hz-news-toggle]")).forEach(function (btn) {
    btn.addEventListener("click", function () {
      var list = btn.parentNode.querySelector(".hz-news-list");
      if (!list) return;
      var collapsed = list.classList.toggle("is-collapsed");
      btn.textContent = collapsed ? "Show all" : "Show less";
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });
  });
})();
