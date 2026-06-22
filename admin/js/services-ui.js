(function () {
  var loginView = document.getElementById("login-view");
  var appView = document.getElementById("app-view");
  var userLabel = document.getElementById("user-label");
  var form = document.getElementById("service-form");
  var formTitle = document.getElementById("service-form-title");
  var formStatus = document.getElementById("service-form-status");
  var listStatus = document.getElementById("services-list-status");
  var listEl = document.getElementById("services-admin-list");
  var saveBtn = document.getElementById("service-save-btn");
  var cancelBtn = document.getElementById("service-cancel-btn");
  var idInput = document.getElementById("service-id");
  var sectionInput = document.getElementById("service-section");
  var categoryInput = document.getElementById("service-category");
  var nameInput = document.getElementById("service-name");
  var cartNameInput = document.getElementById("service-cart-name");
  var priceInput = document.getElementById("service-price");
  var priceLabelInput = document.getElementById("service-price-label");
  var addToCartInput = document.getElementById("service-add-to-cart");

  var services = [];

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
    return "$" + service.price;
  }

  function showApp() {
    var user = RHSAdmin.getUser();
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
    userLabel.textContent = user.name + " (" + user.role + ")";

    if (user.role !== "admin") {
      form.classList.add("hidden");
      listStatus.textContent = "Only admin accounts can edit services.";
      listStatus.className = "status error";
      return;
    }

    loadServices();
  }

  function resetForm() {
    idInput.value = "";
    formTitle.textContent = "Add Service";
    saveBtn.textContent = "Add Service";
    cancelBtn.classList.add("hidden");
    form.reset();
    addToCartInput.checked = true;
    priceInput.value = "0";
    formStatus.textContent = "";
    formStatus.className = "status";
  }

  function fillForm(service) {
    idInput.value = String(service.id);
    formTitle.textContent = "Edit Service";
    saveBtn.textContent = "Save Changes";
    cancelBtn.classList.remove("hidden");
    sectionInput.value = service.section;
    categoryInput.value = service.category;
    nameInput.value = service.name;
    cartNameInput.value = service.cartName || "";
    priceInput.value = String(service.price);
    priceLabelInput.value = service.priceLabel || "";
    addToCartInput.checked = service.addToCart !== false;
    formStatus.textContent = "";
    formStatus.className = "status";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderServices() {
    if (!services.length) {
      listEl.innerHTML = "";
      listStatus.textContent = "No services yet. Add one above.";
      listStatus.className = "status";
      return;
    }

    listStatus.textContent = "";
    listStatus.className = "status";

    var currentSection = "";
    var html = "";

    services.forEach(function (service) {
      if (service.section !== currentSection) {
        currentSection = service.section;
        html += '<h3 class="services-admin-section">' + escapeHtml(currentSection) + "</h3>";
      }

      html +=
        '<div class="services-admin-item' +
        (service.active ? "" : " is-inactive") +
        '">' +
        '<div class="services-admin-main">' +
        '<strong>' +
        escapeHtml(service.name) +
        "</strong>" +
        '<span class="services-admin-meta">' +
        escapeHtml(service.category) +
        " · " +
        escapeHtml(formatPrice(service)) +
        (service.cartName ? " · cart: " + escapeHtml(service.cartName) : "") +
        (service.addToCart === false ? " · no Add button" : "") +
        (service.active ? "" : " · hidden") +
        "</span>" +
        "</div>" +
        '<div class="services-admin-actions">' +
        '<button type="button" class="btn-secondary service-edit-btn" data-id="' +
        service.id +
        '">Edit</button>';

      if (service.active) {
        html +=
          '<button type="button" class="btn-secondary service-delete-btn" data-id="' +
          service.id +
          '">Hide</button>';
      }

      html += "</div></div>";
    });

    listEl.innerHTML = html;
  }

  function loadServices() {
    listStatus.textContent = "Loading…";
    listStatus.className = "status";

    RHSAdmin.listServicesManage()
      .then(function (res) {
        services = res.services || [];
        renderServices();
      })
      .catch(function (err) {
        listStatus.textContent = err.message;
        listStatus.className = "status error";
      });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    formStatus.textContent = "";
    formStatus.className = "status";

    var payload = {
      section: sectionInput.value,
      category: categoryInput.value.trim(),
      name: nameInput.value.trim(),
      cartName: cartNameInput.value.trim(),
      price: Number(priceInput.value),
      priceLabel: priceLabelInput.value.trim(),
      addToCart: addToCartInput.checked
    };

    var serviceId = idInput.value ? Number(idInput.value) : null;
    var request = serviceId
      ? RHSAdmin.updateService(serviceId, payload)
      : RHSAdmin.createService(payload);

    saveBtn.disabled = true;
    request
      .then(function () {
        resetForm();
        loadServices();
        formStatus.textContent = serviceId ? "Service updated." : "Service added.";
        formStatus.className = "status";
      })
      .catch(function (err) {
        formStatus.textContent = err.message;
        formStatus.className = "status error";
      })
      .finally(function () {
        saveBtn.disabled = false;
      });
  });

  cancelBtn.addEventListener("click", resetForm);

  listEl.addEventListener("click", function (event) {
    var editBtn = event.target.closest(".service-edit-btn");
    if (editBtn) {
      var editId = Number(editBtn.getAttribute("data-id"));
      var service = services.find(function (item) {
        return item.id === editId;
      });
      if (service) {
        fillForm(service);
      }
      return;
    }

    var deleteBtn = event.target.closest(".service-delete-btn");
    if (!deleteBtn) {
      return;
    }

    var deleteId = Number(deleteBtn.getAttribute("data-id"));
    var target = services.find(function (item) {
      return item.id === deleteId;
    });
    if (!target) {
      return;
    }

    if (!window.confirm('Hide "' + target.name + '" from the public website?')) {
      return;
    }

    RHSAdmin.deleteService(deleteId)
      .then(function () {
        if (Number(idInput.value) === deleteId) {
          resetForm();
        }
        loadServices();
      })
      .catch(function (err) {
        listStatus.textContent = err.message;
        listStatus.className = "status error";
      });
  });

  document.getElementById("login-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var status = document.getElementById("login-status");
    status.textContent = "";
    RHSAdmin.login(document.getElementById("email").value, document.getElementById("password").value)
      .then(function (res) {
        RHSAdmin.setSession(res.token, res.user);
        showApp();
      })
      .catch(function (err) {
        status.textContent = err.message;
      });
  });

  document.getElementById("logout-btn").addEventListener("click", function () {
    RHSAdmin.clearSession();
    appView.classList.add("hidden");
    loginView.classList.remove("hidden");
  });

  RHSAdmin.restoreSession().then(function (user) {
    if (user) {
      showApp();
    }
  });
})();
