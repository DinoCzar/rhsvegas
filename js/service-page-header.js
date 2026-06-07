(function () {
  if (document.querySelector(".service-page-header")) {
    return;
  }

  var title = document.body.getAttribute("data-page-title") || "Services";

  document.body.insertAdjacentHTML(
    "afterbegin",
    '<div class="service-page-header">' +
      '<span class="service-page-header-title">' + title + "</span>" +
      '<a class="service-page-header-cart" data-cart-link href="/cart">Cart (<span data-cart-count>0</span>)</a>' +
      "</div>"
  );
})();
