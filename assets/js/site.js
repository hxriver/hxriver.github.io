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
    if (isDeck()) return currentIndex();

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

  /* Keep the footer navigation in sync with the panel that is on screen */
  if (deck) {
    var ticking = false;

    function syncActive() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
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
