(function () {
  if (document.querySelector(".site-header-main")) {
    return;
  }

  var LOGO_SRC =
    "https://img1.wsimg.com/isteam/ip/cc0bc11c-275a-4484-a3ca-d1f6e15226db/IMG_5372.jpeg/:/rs=w:400,h:200,m";

  var html =
    '<header class="site-header-main">' +
    '<div class="site-header-inner">' +
    '<div class="header-left">' +
    '<button class="menu-btn" type="button" aria-label="Open menu" data-menu-open>' +
    "<span></span><span></span><span></span>" +
    "</button>" +
    "</div>" +
    '<a class="header-logo" href="/" aria-label="Ryan\'s Home Solutions home">' +
    '<img src="' + LOGO_SRC + '" alt="Ryan\'s Home Solutions" width="200" height="100">' +
    "</a>" +
    '<div class="header-right">' +
    '<a class="header-cart-link" data-cart-link href="/cart">Cart (<span data-cart-count>0</span>)</a>' +
    "</div>" +
    "</div>" +
    "</header>" +
    '<div class="nav-drawer-backdrop" data-nav-backdrop></div>' +
    '<nav class="nav-drawer" data-nav-drawer aria-label="Site navigation">' +
    '<button class="nav-drawer-close" type="button" aria-label="Close menu" data-menu-close>&times;</button>' +
    '<a href="/">Home</a>' +
    '<a href="/services">Services</a>' +
    '<a href="/assembly/">Assembly</a>' +
    '<a href="/installation/">Installation</a>' +
    '<a href="/other-services/">Other Services</a>' +
    '<a data-cart-link href="/cart">Cart (<span data-cart-count>0</span>)</a>' +
    "</nav>";

  document.body.insertAdjacentHTML("afterbegin", html);
})();
