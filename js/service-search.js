(function () {
  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function getItemLabel(item) {
    var nameEl = item.querySelector("span:first-child");
    return nameEl ? nameEl.textContent : item.textContent;
  }

  function filterAccordion(query) {
    var container = document.querySelector(".accordion-container");
    var emptyMsg = document.querySelector(".service-search-no-results");
    if (!container) return;

    var categories = container.querySelectorAll(".category");
    var anyVisible = false;
    var q = normalize(query);

    categories.forEach(function (category) {
      var btn = category.querySelector(".dropdown-btn");
      var content = category.querySelector(".content");
      var categoryLabel = btn ? btn.querySelector("span:first-child").textContent : "";
      var categoryMatch = q && normalize(categoryLabel).indexOf(q) !== -1;
      var visibleItems = 0;

      category.querySelectorAll(".item").forEach(function (item) {
        var label = getItemLabel(item);
        var match = !q || normalize(label).indexOf(q) !== -1 || categoryMatch;

        if (match) {
          item.classList.remove("search-hidden");
          visibleItems += 1;
          anyVisible = true;
        } else {
          item.classList.add("search-hidden");
        }
      });

      if (!q) {
        category.classList.remove("search-hidden");
        category.querySelectorAll(".item").forEach(function (item) {
          item.classList.remove("search-hidden");
        });
        if (content) content.style.display = "";
        if (btn) btn.classList.remove("active");
        return;
      }

      if (visibleItems > 0 || categoryMatch) {
        category.classList.remove("search-hidden");
        anyVisible = true;
        if (content) content.style.display = "block";
        if (btn) btn.classList.add("active");
        if (categoryMatch) {
          category.querySelectorAll(".item").forEach(function (item) {
            item.classList.remove("search-hidden");
          });
        }
      } else {
        category.classList.add("search-hidden");
        if (content) content.style.display = "none";
        if (btn) btn.classList.remove("active");
      }
    });

    if (emptyMsg) {
      emptyMsg.hidden = !q || anyVisible;
    }
  }

  function filterServiceTiles(query) {
    var grid = document.querySelector(".service-grid");
    var emptyMsg = document.querySelector(".service-search-no-results");
    if (!grid) return;

    var q = normalize(query);
    var anyVisible = false;

    grid.querySelectorAll(".service-tile").forEach(function (tile) {
      var label = tile.querySelector("span");
      var text = label ? label.textContent : tile.textContent;
      var match = !q || normalize(text).indexOf(q) !== -1;

      if (match) {
        tile.classList.remove("search-hidden");
        anyVisible = true;
      } else {
        tile.classList.add("search-hidden");
      }
    });

    if (emptyMsg) {
      emptyMsg.hidden = !q || anyVisible;
    }
  }

  function onSearchInput(event) {
    var query = event.target.value;
    if (document.querySelector(".accordion-container")) {
      filterAccordion(query);
    }
    if (document.querySelector(".service-grid")) {
      filterServiceTiles(query);
    }
  }

  function init() {
    var input = document.querySelector(".service-search-input");
    if (!input) return;
    input.addEventListener("input", onSearchInput);
    input.addEventListener("search", onSearchInput);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
