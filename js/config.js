window.RHS_CONFIG = {
  apiUrl: (function () {
    var host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:3001/api";
    }
    if (host === "rhsvegas.com" || host === "www.rhsvegas.com") {
      return "https://api.rhsvegas.com/api";
    }
    return "https://rhsvegas-api-c5y0.onrender.com/api";
  })(),

  adminUrl: (function () {
    var host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:3001/admin/";
    }
    if (host === "rhsvegas.com" || host === "www.rhsvegas.com") {
      return "https://api.rhsvegas.com/admin/";
    }
    return "https://rhsvegas-api-c5y0.onrender.com/admin/";
  })(),

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
