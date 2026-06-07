window.RHS_CONFIG = {
  // Booking API — localhost for dev; set production URL after Render deploy
  apiUrl: (function () {
    var host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:3001/api";
    }
    // Update if your Render API service has a different name
    return "https://rhsvegas-api-c5y0.onrender.com/api";
  })(),

  // Staff portal to manage availability
  adminUrl: (function () {
    var host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:3001/admin/";
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
