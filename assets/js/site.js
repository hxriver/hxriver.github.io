/* ==========================================================================
   Site interactions
   --------------------------------------------------------------------------
   Vanilla JS, no dependencies. Loaded after the theme bundle so it can
   override the theme's jQuery smooth-scroll behaviour for in-page anchors.
   ========================================================================== */

(function () {
  "use strict";

  var root = document.documentElement;
  var headerInner = document.getElementById("sp-header-inner");
  var nav = document.getElementById("sp-nav");
  var menuToggle = document.getElementById("sp-menu-toggle");
  var themeToggle = document.getElementById("sp-theme-toggle");
  var toTop = document.getElementById("sp-to-top");

  /* --------------------------------------------------------------------
     Light / dark theme
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
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  }

  /* --------------------------------------------------------------------
     Mobile navigation
     -------------------------------------------------------------------- */

  function closeMenu() {
    if (!headerInner) return;
    headerInner.classList.remove("is-open");
    if (menuToggle) {
      menuToggle.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  }

  if (menuToggle && headerInner) {
    menuToggle.addEventListener("click", function () {
      var open = headerInner.classList.toggle("is-open");
      menuToggle.classList.toggle("is-open", open);
      menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  document.addEventListener("click", function (e) {
    if (!headerInner) return;
    if (headerInner.contains(e.target)) return;
    closeMenu();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 720) closeMenu();
  });

  /* --------------------------------------------------------------------
     News "Show all" toggle
     -------------------------------------------------------------------- */

  [].slice.call(document.querySelectorAll(".sp-news-toggle")).forEach(function (btn) {
    btn.addEventListener("click", function () {
      var list = document.querySelector(btn.getAttribute("data-target"));
      if (!list) return;
      var collapsed = list.classList.toggle("is-collapsed");
      list.classList.toggle("is-expanded", !collapsed);
      btn.textContent = collapsed ? "Show all" : "Show less";
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });
  });

  /* --------------------------------------------------------------------
     In-page smooth scrolling
     Handled in the capture phase so the theme's jQuery smooth-scroll
     plugin (bound on the bubble phase) never double-animates.
     -------------------------------------------------------------------- */

  function headerOffset() {
    var header = document.getElementById("sp-header");
    return (header ? header.offsetHeight : 64) + 16;
  }

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

      // Only same-page anchors scroll; anything else is a normal link.
      if (link.pathname && link.pathname !== window.location.pathname) return;

      var target = null;
      try {
        target = document.querySelector(hash);
      } catch (err) {
        target = null;
      }
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();

      var top = target.getBoundingClientRect().top + window.pageYOffset - headerOffset();
      window.scrollTo({ top: top, behavior: "smooth" });

      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", hash);
      }

      closeMenu();
    },
    true
  );

  /* --------------------------------------------------------------------
     Back to top
     -------------------------------------------------------------------- */

  if (toTop) {
    toTop.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  var ticking = false;

  function update() {
    ticking = false;
    var scrollTop = window.pageYOffset || root.scrollTop;
    if (toTop) {
      toTop.classList.toggle("is-visible", scrollTop > 240);
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  update();
})();
