const BOOLEAN_TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return BOOLEAN_TRUE_VALUES.has(value.trim().toLowerCase());
  }

  return fallback;
}

function normalizeUrl(value, trimTrailingSlash = false) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimTrailingSlash ? trimmed.replace(/\/+$/, "") : trimmed;
}

function buildKeycloakLogoutUrl(opendesk) {
  if (!opendesk.keycloakIssuerUrl) {
    return "";
  }

  const logoutUrl = new URL(
    `${opendesk.keycloakIssuerUrl}/protocol/openid-connect/logout`
  );

  if (opendesk.oidcClientId) {
    logoutUrl.searchParams.set("client_id", opendesk.oidcClientId);
  }

  if (opendesk.postLogoutRedirectUrl) {
    logoutUrl.searchParams.set(
      "post_logout_redirect_uri",
      opendesk.postLogoutRedirectUrl
    );
  }

  return logoutUrl.toString();
}

function buildProxyLogoutUrl(opendesk) {
  const logoutUrl = new URL("/oauth2/sign_out", window.location.origin);
  const redirectTarget =
    buildKeycloakLogoutUrl(opendesk) ||
    opendesk.postLogoutRedirectUrl ||
    opendesk.portalUrl;

  if (redirectTarget) {
    logoutUrl.searchParams.set("rd", redirectTarget);
  }

  return logoutUrl.toString();
}

function getWindowConfig() {
  if (typeof window === "undefined") {
    return {};
  }

  return window.__ORGANIGRAM_CONFIG__ || {};
}

const rawConfig = getWindowConfig();
const opendesk = rawConfig.opendesk || {};

const runtimeConfig = {
  opendesk: {
    enabled: parseBoolean(opendesk.enabled, false),
    portalUrl: normalizeUrl(opendesk.portalUrl, false),
    icsUrl: normalizeUrl(opendesk.icsUrl, true),
    keycloakIssuerUrl: normalizeUrl(opendesk.keycloakIssuerUrl, true),
    oidcClientId: typeof opendesk.oidcClientId === "string" ? opendesk.oidcClientId.trim() : "",
    postLogoutRedirectUrl: normalizeUrl(opendesk.postLogoutRedirectUrl, false),
    navigationLanguage:
      typeof opendesk.navigationLanguage === "string" &&
      opendesk.navigationLanguage.trim()
        ? opendesk.navigationLanguage.trim()
        : "de-DE",
    suiteLabel:
      typeof opendesk.suiteLabel === "string" && opendesk.suiteLabel.trim()
        ? opendesk.suiteLabel.trim()
        : "openDesk",
    nextcloudUrl: normalizeUrl(opendesk.nextcloudUrl, true),
    nextcloudFolder:
      typeof opendesk.nextcloudFolder === "string" &&
      opendesk.nextcloudFolder.trim()
        ? opendesk.nextcloudFolder.trim()
        : "Organigramme",
  },
};

runtimeConfig.opendesk.keycloakLogoutUrl = buildKeycloakLogoutUrl(
  runtimeConfig.opendesk
);
runtimeConfig.opendesk.proxyLogoutUrl = buildProxyLogoutUrl(
  runtimeConfig.opendesk
);

export default runtimeConfig;
