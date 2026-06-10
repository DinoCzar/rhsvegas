(function () {
  /** GoDaddy domain → Render. Update if your Render service names differ. */
  var PRODUCTION_SITE_HOSTS = ["rhsvegas.com", "www.rhsvegas.com"];
  var PRODUCTION_API_ORIGIN = "https://api.rhsvegas.com";
  var RENDER_API_ORIGIN = "https://rhsvegas-api-c5y0.onrender.com";

  function apiOrigin() {
    var host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:3001";
    }
    if (PRODUCTION_SITE_HOSTS.indexOf(host) !== -1) {
      return PRODUCTION_API_ORIGIN;
    }
    return RENDER_API_ORIGIN;
  }

  var origin = apiOrigin();

  window.RHS_CONFIG = {
    apiUrl: origin + "/api",
    adminUrl: origin + "/admin/",

    homeUrl: "/",
    cartUrl: "/cart",
    checkoutUrl: "/checkout",
    confirmationUrl: "/confirmation",
    servicesUrl: "/services",
    assemblyUrl: "/assembly",
    installationUrl: "/installation",
    otherServicesUrl: "/other-services",

    businessName: "Ryan's Home Solutions",
    timezoneLabel: "Pacific Time (Las Vegas)"
  };
})();
