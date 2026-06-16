const helmet = require("helmet");

const staticCspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"],
  scriptSrcAttr: ["'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: [
    "'self'",
    "https://rhsvegas-api-c5y0.onrender.com",
    "https://api.rhsvegas.com",
    "http://localhost:3001"
  ],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  objectSrc: ["'none'"]
};

const adminCspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  imgSrc: ["'self'", "data:", "https:", "blob:"],
  connectSrc: ["'self'"],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  objectSrc: ["'none'"]
};

function applySecurityMiddleware(app) {
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );

  app.use("/admin", function (req, res, next) {
    helmet({
      contentSecurityPolicy: { directives: adminCspDirectives },
      crossOriginResourcePolicy: { policy: "same-site" }
    })(req, res, next);
  });
}

function staticSiteSecurityHeaders() {
  return [
    { path: "/*", name: "X-Frame-Options", value: "DENY" },
    { path: "/*", name: "X-Content-Type-Options", value: "nosniff" },
    { path: "/*", name: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      path: "/*",
      name: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()"
    },
    {
      path: "/*",
      name: "Content-Security-Policy",
      value: buildCspHeader(staticCspDirectives)
    }
  ];
}

function buildCspHeader(directives) {
  return Object.keys(directives)
    .map(function (key) {
      var name = key.replace(/[A-Z]/g, function (char) {
        return "-" + char.toLowerCase();
      });
      return name + " " + directives[key].join(" ");
    })
    .join("; ");
}

module.exports = { applySecurityMiddleware, staticSiteSecurityHeaders };
