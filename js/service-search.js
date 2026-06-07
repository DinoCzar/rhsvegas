(function () {
  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getItemLabel(item) {
    var nameEl = item.querySelector("span:first-child");
    return nameEl ? nameEl.textContent : item.textContent;
  }

  function formatPrice(service) {
    if (service.priceLabel) {
      return service.priceLabel;
    }
    if (window.RHSCart) {
      return RHSCart.formatPrice(service.price);
    }
    if (service.price === 0) {
      return "Custom";
    }
    return "$" + Number(service.price).toFixed(0);
  }

  function getCartName(service) {
    return service.cartName || service.name;
  }

  function canAddToCart(service) {
    return service.addToCart !== false;
  }

  function serviceMatchesQuery(service, query) {
    if (!query) {
      return true;
    }

    var haystack = normalize([
      service.name,
      service.category,
      service.section,
      getCartName(service)
    ].join(" "));

    return haystack.indexOf(query) !== -1;
  }

  function searchCatalog(query) {
    var catalog = window.RHS_SERVICES || [];
    var q = normalize(query);
    if (!q) {
      return [];
    }

    return catalog.filter(function (service) {
      return serviceMatchesQuery(service, q);
    });
  }

  function ensureResultsContainer() {
    var existing = document.querySelector(".service-search-results");
    if (existing) {
      return existing;
    }

    var wrap = document.querySelector(".service-search-wrap");
    if (!wrap) {
      return null;
    }

    var container = document.createElement("div");
    container.className = "service-search-results";
    container.hidden = true;
    wrap.insertAdjacentElement("afterend", container);
    return container;
  }

  function renderGlobalResults(query) {
    var resultsEl = ensureResultsContainer();
    var emptyMsg = document.querySelector(".service-search-no-results");
    var grid = document.querySelector(".service-grid");
    var q = normalize(query);
    var matches = searchCatalog(query);

    if (!resultsEl) {
      return matches.length > 0;
    }

    if (!q) {
      resultsEl.hidden = true;
      resultsEl.innerHTML = "";
      if (grid) {
        grid.classList.remove("search-hidden");
      }
      if (emptyMsg) {
        emptyMsg.hidden = true;
      }
      return true;
    }

    if (grid) {
      grid.classList.add("search-hidden");
    }

    if (!matches.length) {
      resultsEl.hidden = true;
      resultsEl.innerHTML = "";
      if (emptyMsg) {
        emptyMsg.hidden = false;
      }
      return false;
    }

    resultsEl.hidden = false;
    if (emptyMsg) {
      emptyMsg.hidden = true;
    }

    resultsEl.innerHTML = matches.map(function (service) {
      var price = formatPrice(service);
      var addButton = canAddToCart(service)
        ? '<button class="add-btn" type="button" data-name="' + escapeHtml(getCartName(service)) + '" data-price="' + escapeHtml(service.price) + '"' +
          (service.priceLabel ? ' data-price-label="' + escapeHtml(service.priceLabel) + '"' : "") +
          ">Add</button>"
        : '<span class="search-result-note">Contact for quote</span>';

      return (
        '<div class="search-result-item">' +
        '<div class="search-result-main">' +
        '<span class="search-result-section">' + escapeHtml(service.section) + "</span>" +
        '<span class="search-result-name">' + escapeHtml(service.name) + "</span>" +
        '<span class="search-result-category">' + escapeHtml(service.category) + "</span>" +
        "</div>" +
        '<span class="price">' + escapeHtml(price) + "</span>" +
        addButton +
        "</div>"
      );
    }).join("");

    return true;
  }

  function filterAccordion(query) {
    var container = document.querySelector(".accordion-container");
    var emptyMsg = document.querySelector(".service-search-no-results");
    if (!container) {
      return;
    }

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
        if (content) {
          content.style.display = "";
        }
        if (btn) {
          btn.classList.remove("active");
        }
        return;
      }

      if (visibleItems > 0 || categoryMatch) {
        category.classList.remove("search-hidden");
        anyVisible = true;
        if (content) {
          content.style.display = "block";
        }
        if (btn) {
          btn.classList.add("active");
        }
        if (categoryMatch) {
          category.querySelectorAll(".item").forEach(function (item) {
            item.classList.remove("search-hidden");
          });
        }
      } else {
        category.classList.add("search-hidden");
        if (content) {
          content.style.display = "none";
        }
        if (btn) {
          btn.classList.remove("active");
        }
      }
    });

    if (emptyMsg) {
      emptyMsg.hidden = !q || anyVisible;
    }
  }

  function filterServiceTiles(query) {
    var grid = document.querySelector(".service-grid");
    if (!grid) {
      return;
    }

    if (normalize(query)) {
      grid.classList.add("search-hidden");
    } else {
      grid.classList.remove("search-hidden");
    }
  }

  function onSearchInput(event) {
    var query = event.target.value;

    if (document.querySelector(".service-grid")) {
      renderGlobalResults(query);
      filterServiceTiles(query);
      return;
    }

    if (document.querySelector(".accordion-container")) {
      filterAccordion(query);
    }
  }

  function onResultsClick(event) {
    var button = event.target.closest(".add-btn[data-name]");
    if (!button || !window.addToCart) {
      return;
    }

    var priceLabel = button.getAttribute("data-price-label");
    addToCart(
      button.getAttribute("data-name"),
      Number(button.getAttribute("data-price")),
      priceLabel || undefined
    );
  }

  function init() {
    var input = document.querySelector(".service-search-input");
    if (!input) {
      return;
    }

    if (document.querySelector(".service-grid")) {
      var resultsEl = ensureResultsContainer();
      if (resultsEl) {
        resultsEl.addEventListener("click", onResultsClick);
      }
    }

    input.addEventListener("input", onSearchInput);
    input.addEventListener("search", onSearchInput);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
