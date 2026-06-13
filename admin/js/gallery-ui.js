(function () {
  var loginView = document.getElementById("login-view");
  var appView = document.getElementById("app-view");
  var userLabel = document.getElementById("user-label");
  var listEl = document.getElementById("gallery-admin-list");
  var listStatus = document.getElementById("gallery-list-status");
  var uploadStatus = document.getElementById("gallery-upload-status");
  var uploadForm = document.getElementById("gallery-upload-form");
  var fileInput = document.getElementById("gallery-file");
  var captionInput = document.getElementById("gallery-caption");

  var images = [];

  function showApp() {
    var user = RHSAdmin.getUser();
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
    userLabel.textContent = user.name + " (" + user.role + ")";

    if (user.role !== "admin") {
      listStatus.textContent = "Only admin accounts can manage the gallery.";
      listStatus.className = "status error";
      uploadForm.classList.add("hidden");
      return;
    }

    loadGallery();
  }

  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || "");
        var comma = result.indexOf(",");
        resolve(comma === -1 ? result : result.slice(comma + 1));
      };
      reader.onerror = function () {
        reject(new Error("Could not read the selected file."));
      };
      reader.readAsDataURL(file);
    });
  }

  function prepareUploadFile(file) {
    if (!file || !String(file.type || "").match(/^image\//)) {
      return Promise.reject(new Error("Choose a JPG, PNG, WebP, or GIF photo."));
    }

    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();

      img.onload = function () {
        URL.revokeObjectURL(url);
        var maxWidth = 1600;
        var scale = Math.min(1, maxWidth / img.width);
        var width = Math.max(1, Math.round(img.width * scale));
        var height = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          function (blob) {
            if (!blob) {
              reject(new Error("Could not process the selected photo."));
              return;
            }
            resolve(
              new File([blob], (file.name || "gallery-photo").replace(/\.[^.]+$/, ".jpg"), {
                type: "image/jpeg"
              })
            );
          },
          "image/jpeg",
          0.85
        );
      };

      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Could not load the selected photo. Try JPG or PNG."));
      };

      img.src = url;
    });
  }

  function renderGallery() {
    if (!images.length) {
      listEl.innerHTML = "";
      listStatus.textContent = "No photos yet. Upload one above.";
      listStatus.className = "status";
      return;
    }

    listStatus.textContent = "";
    listStatus.className = "status";

    listEl.innerHTML = images
      .map(function (image, index) {
        var src = RHSAdmin.galleryImageUrl(image.imageUrl);
        return (
          '<li class="gallery-admin-item" data-id="' +
          image.id +
          '">' +
          '<img class="gallery-admin-thumb" src="' +
          src +
          '" alt="">' +
          '<div class="gallery-admin-details">' +
          '<label>Caption</label>' +
          '<input type="text" class="gallery-caption-input" data-id="' +
          image.id +
          '" value="' +
          escapeHtml(image.caption || "") +
          '" maxlength="200">' +
          '<div class="gallery-admin-actions">' +
          '<button type="button" class="btn-secondary gallery-move-up" data-id="' +
          image.id +
          '"' +
          (index === 0 ? " disabled" : "") +
          ">Move Up</button>" +
          '<button type="button" class="btn-secondary gallery-move-down" data-id="' +
          image.id +
          '"' +
          (index === images.length - 1 ? " disabled" : "") +
          ">Move Down</button>" +
          '<button type="button" class="btn-secondary gallery-save-caption" data-id="' +
          image.id +
          '">Save Caption</button>' +
          '<button type="button" class="btn-danger gallery-delete" data-id="' +
          image.id +
          '">Delete</button>' +
          "</div>" +
          "</div>" +
          "</li>"
        );
      })
      .join("");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadGallery() {
    listStatus.textContent = "Loading…";
    listStatus.className = "status";
    RHSAdmin.listGalleryImages()
      .then(function (res) {
        images = res.images || [];
        renderGallery();
      })
      .catch(function (err) {
        listStatus.textContent = err.message;
        listStatus.className = "status error";
      });
  }

  function saveOrder() {
    var order = images.map(function (image) {
      return image.id;
    });
    listStatus.textContent = "Saving order…";
    listStatus.className = "status";
    RHSAdmin.reorderGalleryImages(order)
      .then(function (res) {
        images = res.images || [];
        renderGallery();
        listStatus.textContent = "Order saved.";
        listStatus.className = "status success";
      })
      .catch(function (err) {
        listStatus.textContent = err.message;
        listStatus.className = "status error";
        loadGallery();
      });
  }

  function moveImage(id, direction) {
    var index = images.findIndex(function (image) {
      return image.id === id;
    });
    if (index === -1) return;
    var target = index + direction;
    if (target < 0 || target >= images.length) return;
    var moved = images.splice(index, 1)[0];
    images.splice(target, 0, moved);
    renderGallery();
    saveOrder();
  }

  uploadForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var file = fileInput.files && fileInput.files[0];
    if (!file) {
      uploadStatus.textContent = "Choose a photo to upload.";
      uploadStatus.className = "status error";
      return;
    }

    uploadStatus.textContent = "Uploading…";
    uploadStatus.className = "status";

    prepareUploadFile(file)
      .then(function (preparedFile) {
        return readFileAsBase64(preparedFile).then(function (dataBase64) {
          return RHSAdmin.uploadGalleryImage(
            captionInput.value.trim(),
            preparedFile.type,
            dataBase64
          );
        });
      })
      .then(function () {
        uploadStatus.textContent = "Photo uploaded.";
        uploadStatus.className = "status success";
        uploadForm.reset();
        loadGallery();
      })
      .catch(function (err) {
        uploadStatus.textContent = err.message;
        uploadStatus.className = "status error";
      });
  });

  listEl.addEventListener("click", function (e) {
    var upBtn = e.target.closest(".gallery-move-up");
    if (upBtn) {
      moveImage(Number(upBtn.getAttribute("data-id")), -1);
      return;
    }

    var downBtn = e.target.closest(".gallery-move-down");
    if (downBtn) {
      moveImage(Number(downBtn.getAttribute("data-id")), 1);
      return;
    }

    var saveBtn = e.target.closest(".gallery-save-caption");
    if (saveBtn) {
      var saveId = Number(saveBtn.getAttribute("data-id"));
      var input = listEl.querySelector('.gallery-caption-input[data-id="' + saveId + '"]');
      listStatus.textContent = "Saving caption…";
      listStatus.className = "status";
      RHSAdmin.updateGalleryCaption(saveId, input.value.trim())
        .then(function () {
          listStatus.textContent = "Caption saved.";
          listStatus.className = "status success";
          loadGallery();
        })
        .catch(function (err) {
          listStatus.textContent = err.message;
          listStatus.className = "status error";
        });
      return;
    }

    var deleteBtn = e.target.closest(".gallery-delete");
    if (deleteBtn) {
      if (!window.confirm("Delete this photo from the public gallery?")) {
        return;
      }
      var deleteId = Number(deleteBtn.getAttribute("data-id"));
      listStatus.textContent = "Deleting…";
      listStatus.className = "status";
      RHSAdmin.deleteGalleryImage(deleteId)
        .then(function () {
          listStatus.textContent = "Photo deleted.";
          listStatus.className = "status success";
          loadGallery();
        })
        .catch(function (err) {
          listStatus.textContent = err.message;
          listStatus.className = "status error";
        });
    }
  });

  document.getElementById("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
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

  if (RHSAdmin.getToken() && RHSAdmin.getUser()) {
    showApp();
  }
})();
