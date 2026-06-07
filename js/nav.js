(function () {
  function initNav() {
    var menuBtn = document.querySelector("[data-menu-open]");
    var drawer = document.querySelector("[data-nav-drawer]");
    var backdrop = document.querySelector("[data-nav-backdrop]");
    var closeBtn = document.querySelector("[data-menu-close]");

    if (!menuBtn || !drawer || !backdrop) return;

    function openNav() {
      drawer.classList.add("open");
      backdrop.classList.add("open");
      document.body.style.overflow = "hidden";
    }

    function closeNav() {
      drawer.classList.remove("open");
      backdrop.classList.remove("open");
      document.body.style.overflow = "";
    }

    menuBtn.addEventListener("click", openNav);
    if (closeBtn) closeBtn.addEventListener("click", closeNav);
    backdrop.addEventListener("click", closeNav);

    drawer.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeNav);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNav);
  } else {
    initNav();
  }
})();
