(function () {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatPrice(service) {
    if (service.priceLabel) {
      return service.priceLabel;
    }
    if (service.price === 0) {
      return "Custom";
    }
    if (window.RHSCart) {
      return RHSCart.formatPrice(service.price);
    }
    return "$" + Number(service.price).toFixed(0);
  }

  function getCartName(service) {
    return service.cartName || service.name;
  }

  function renderItem(service) {
    var price = formatPrice(service);
    var cartName = getCartName(service);
    var addButton =
      service.addToCart === false
        ? '<span class="search-result-note">Contact for quote</span>'
        : '<button class="add-btn" type="button" data-name="' +
          escapeHtml(cartName) +
          '" data-price="' +
          escapeHtml(service.price) +
          '"' +
          (service.priceLabel ? ' data-price-label="' + escapeHtml(service.priceLabel) + '"' : "") +
          ">Add</button>";

    return (
      '<div class="item">' +
      "<span>" +
      escapeHtml(service.name) +
      "</span>" +
      '<span class="price">' +
      escapeHtml(price) +
      "</span>" +
      addButton +
      "</div>"
    );
  }

  function renderCategory(category, items) {
    return (
      '<div class="category">' +
      '<button class="dropdown-btn" type="button" onclick="toggleCategory(this)">' +
      "<span>" +
      escapeHtml(category) +
      "</span>" +
      '<span class="arrow">▼</span>' +
      "</button>" +
      '<div class="content">' +
      items.map(renderItem).join("") +
      "</div>" +
      "</div>"
    );
  }

  function groupServices(services) {
    var sections = [];
    var sectionMap = new Map();

    services.forEach(function (service) {
      if (!sectionMap.has(service.section)) {
        var section = { name: service.section, categories: [], categoryMap: new Map() };
        sectionMap.set(service.section, section);
        sections.push(section);
      }

      var sectionEntry = sectionMap.get(service.section);
      if (!sectionEntry.categoryMap.has(service.category)) {
        var category = { name: service.category, items: [] };
        sectionEntry.categoryMap.set(service.category, category);
        sectionEntry.categories.push(category);
      }

      sectionEntry.categoryMap.get(service.category).items.push(service);
    });

    return sections;
  }

  function renderAccordion(container, services, options) {
    var showSectionHeadings = options.showSectionHeadings;
    var grouped = groupServices(services);
    var html = "";

    grouped.forEach(function (section) {
      if (showSectionHeadings) {
        html += '<h2 class="service-section-heading">' + escapeHtml(section.name) + "</h2>";
      }

      section.categories.forEach(function (category) {
        html += renderCategory(category.name, category.items);
      });
    });

    container.innerHTML = html;

    container.addEventListener("click", function (event) {
      var button = event.target.closest(".add-btn[data-name]");
      if (!button || !window.addToCart) {
        return;
      }
      addToCart(
        button.getAttribute("data-name"),
        Number(button.getAttribute("data-price")),
        button.getAttribute("data-price-label") || undefined
      );
    });
  }

  function getApiUrl(section) {
    if (!window.RHS_CONFIG || !RHS_CONFIG.apiUrl) {
      throw new Error("Missing RHS_CONFIG.apiUrl.");
    }
    var url = RHS_CONFIG.apiUrl.replace(/\/$/, "") + "/services";
    if (section) {
      url += "?section=" + encodeURIComponent(section);
    }
    return url;
  }

  function loadServices() {
    var container = document.getElementById("services-accordion");
    if (!container) {
      return Promise.resolve();
    }

    var sectionFilter = container.getAttribute("data-section") || "";
    var errorEl = document.getElementById("services-load-error");

    return fetch(getApiUrl(sectionFilter))
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            throw new Error(data.error || "Could not load services.");
          }
          return data;
        });
      })
      .then(function (data) {
        var services = data.services || [];
        window.RHS_SERVICES = services;
        renderAccordion(container, services, {
          showSectionHeadings: !sectionFilter
        });
        document.dispatchEvent(new Event("rhs-services-ready"));
        if (errorEl) {
          errorEl.hidden = true;
        }
      })
      .catch(function (err) {
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent = err.message;
        }
        container.innerHTML = "";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadServices);
  } else {
    loadServices();
  }
})();
