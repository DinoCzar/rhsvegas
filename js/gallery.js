(function () {
  function getApiBase() {
    if (window.RHS_CONFIG && window.RHS_CONFIG.apiUrl) {
      return window.RHS_CONFIG.apiUrl.replace(/\/$/, "");
    }
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:3001/api";
    }
    return "https://rhsvegas-api.onrender.com/api";
  }

  function galleryImageUrl(imagePath) {
    var apiBase = getApiBase();
    var origin = apiBase.replace(/\/api$/, "");
    if (imagePath.indexOf("http") === 0) {
      return imagePath;
    }
    return origin + imagePath;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderGallery(images) {
    var grid = document.getElementById("gallery-grid");
    var emptyMsg = document.getElementById("gallery-empty");
    if (!grid) {
      return;
    }

    if (!images.length) {
      grid.innerHTML = "";
      if (emptyMsg) {
        emptyMsg.hidden = false;
      }
      return;
    }

    if (emptyMsg) {
      emptyMsg.hidden = true;
    }

    grid.innerHTML = images
      .map(function (image) {
        var caption = image.caption || "Project photo";
        return (
          '<figure class="gallery-item">' +
          '<img src="' +
          escapeHtml(galleryImageUrl(image.imageUrl)) +
          '" alt="' +
          escapeHtml(caption) +
          '" loading="lazy">' +
          "<figcaption>" +
          escapeHtml(caption) +
          "</figcaption>" +
          "</figure>"
        );
      })
      .join("");
  }

  function init() {
    var status = document.getElementById("gallery-status");
    fetch(getApiBase() + "/gallery")
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            throw new Error(data.error || "Could not load gallery.");
          }
          return data;
        });
      })
      .then(function (data) {
        renderGallery(data.images || []);
      })
      .catch(function (err) {
        if (status) {
          status.textContent = err.message;
          status.hidden = false;
        }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
