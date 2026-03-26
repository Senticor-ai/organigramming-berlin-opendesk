const express = require("express");
const path = require("path");
const { XMLParser } = require("fast-xml-parser");

const app = express();
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

const PORT = Number.parseInt(process.env.PORT || "8080", 10);
const PUBLIC_DIR = path.resolve(__dirname, "../public");
const INDEX_FILE = path.join(PUBLIC_DIR, "index.html");

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
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

function buildRuntimeConfig() {
  const opendesk = {
    enabled: parseBoolean(process.env.ORGANIGRAM_OPENDESK_ENABLED, false),
    portalUrl: normalizeUrl(process.env.ORGANIGRAM_OPENDESK_PORTAL_URL),
    icsUrl: normalizeUrl(process.env.ORGANIGRAM_OPENDESK_ICS_URL, true),
    keycloakIssuerUrl: normalizeUrl(
      process.env.ORGANIGRAM_OPENDESK_KEYCLOAK_ISSUER_URL,
      true
    ),
    oidcClientId: (process.env.ORGANIGRAM_OPENDESK_OIDC_CLIENT_ID || "organigram").trim(),
    postLogoutRedirectUrl: normalizeUrl(
      process.env.ORGANIGRAM_OPENDESK_POST_LOGOUT_REDIRECT_URL
    ),
    navigationLanguage:
      (process.env.ORGANIGRAM_OPENDESK_NAVIGATION_LANGUAGE || "de-DE").trim() ||
      "de-DE",
    suiteLabel:
      (process.env.ORGANIGRAM_OPENDESK_SUITE_LABEL || "openDesk").trim() ||
      "openDesk",
    nextcloudUrl: normalizeUrl(process.env.ORGANIGRAM_OPENDESK_NEXTCLOUD_URL, true),
    nextcloudFolder:
      (process.env.ORGANIGRAM_OPENDESK_NEXTCLOUD_FOLDER || "Organigramme").trim() ||
      "Organigramme",
    nextcloudPrincipalClaim:
      (
        process.env.ORGANIGRAM_OPENDESK_NEXTCLOUD_PRINCIPAL_CLAIM ||
        "opendesk_useruuid"
      ).trim() || "opendesk_useruuid",
  };

  return { opendesk };
}

const runtimeConfig = buildRuntimeConfig();

function encodeRuntimeConfig(config) {
  return `window.__ORGANIGRAM_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`;
}

function getHeader(req, name) {
  const value = req.headers[name];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value || "";
}

function decodeJwt(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const segments = token.split(".");
  if (segments.length < 2) {
    return null;
  }

  try {
    const payload = segments[1];
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    return JSON.parse(Buffer.from(padded, "base64url").toString("utf8"));
  } catch (error) {
    return null;
  }
}

function getRequestUser(req) {
  const accessToken =
    getHeader(req, "x-forwarded-access-token") ||
    getHeader(req, "x-auth-request-access-token");
  const claims = decodeJwt(accessToken);

  const uid =
    claims?.preferred_username ||
    getHeader(req, "x-forwarded-preferred-username") ||
    getHeader(req, "x-forwarded-user") ||
    "";

  const email =
    claims?.email ||
    getHeader(req, "x-forwarded-email") ||
    "";

  const displayName =
    claims?.name ||
    [claims?.given_name, claims?.family_name].filter(Boolean).join(" ") ||
    email ||
    uid;

  const nextcloudPrincipalClaim =
    runtimeConfig.opendesk.nextcloudPrincipalClaim || "";
  const nextcloudPrincipal =
    (nextcloudPrincipalClaim && claims?.[nextcloudPrincipalClaim]) || "";

  return {
    uid,
    email,
    displayName,
    nextcloudPrincipal,
    accessToken,
    claims,
  };
}

function requireOpenDesk(req, res, next) {
  if (!runtimeConfig.opendesk.enabled) {
    res.status(404).json({ error: "openDesk integration is disabled" });
    return;
  }

  next();
}

function requireUser(req, res, next) {
  const user = getRequestUser(req);

  if (!user.uid) {
    res.status(401).json({ error: "Unable to determine the signed-in user" });
    return;
  }

  req.user = user;
  next();
}

function requireAccessToken(req, res, next) {
  if (!req.user?.accessToken) {
    res
      .status(502)
      .json({ error: "Missing user access token from oauth2-proxy headers" });
    return;
  }

  next();
}

function buildNavigationUrl(language) {
  const baseUrl = normalizeUrl(
    process.env.ORGANIGRAM_OPENDESK_PORTAL_SERVER_URL ||
      "http://ums-portal-server.opendesk.svc.cluster.local/portal",
    true
  );

  const url = new URL(`${baseUrl}/navigation.json`);
  url.searchParams.set(
    "language",
    typeof language === "string" && language.trim()
      ? language.trim()
      : runtimeConfig.opendesk.navigationLanguage
  );
  return url.toString();
}

function getCentralNavigationSharedSecret() {
  return (
    process.env.ORGANIGRAM_OPENDESK_CENTRAL_NAVIGATION_SHARED_SECRET || ""
  ).trim();
}

async function fetchNavigation(req) {
  const sharedSecret = getCentralNavigationSharedSecret();
  if (!sharedSecret) {
    throw new Error("Central Navigation shared secret is not configured");
  }

  const username = req.user.uid;
  const credentials = Buffer.from(`${username}:${sharedSecret}`).toString("base64");

  const response = await fetch(buildNavigationUrl(req.query.language), {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Central Navigation API returned ${response.status}: ${text.slice(0, 200)}`
    );
  }

  return response.json();
}

function sanitizeFileName(fileName) {
  const baseName = String(fileName || "")
    .trim()
    .replace(/\.json$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!baseName) {
    return "organigramm.json";
  }

  return `${baseName}.json`;
}

function getNextcloudRootUrl(principal) {
  const nextcloudUrl =
    normalizeUrl(process.env.ORGANIGRAM_OPENDESK_NEXTCLOUD_API_URL, true) ||
    runtimeConfig.opendesk.nextcloudUrl;
  if (!nextcloudUrl) {
    throw new Error("Nextcloud URL is not configured");
  }

  return `${nextcloudUrl}/remote.php/dav/files/${encodeURIComponent(principal)}`;
}

function getNextcloudFolderPath() {
  return runtimeConfig.opendesk.nextcloudFolder.replace(/^\/+|\/+$/g, "");
}

function getNextcloudPrincipal(user) {
  const claimName = runtimeConfig.opendesk.nextcloudPrincipalClaim;
  if (claimName && user.nextcloudPrincipal) {
    return user.nextcloudPrincipal;
  }

  if (!claimName && user.uid) {
    return user.uid;
  }

  throw new Error(
    claimName
      ? `Missing Nextcloud principal claim "${claimName}" in the access token`
      : "Missing Nextcloud principal for the signed-in user"
  );
}

function buildNextcloudFolderUrl(user) {
  const root = getNextcloudRootUrl(getNextcloudPrincipal(user));
  const folderPath = getNextcloudFolderPath();
  return folderPath ? `${root}/${encodeURIComponent(folderPath)}` : root;
}

function buildNextcloudDocumentUrl(user, fileName) {
  return `${buildNextcloudFolderUrl(user)}/${encodeURIComponent(fileName)}`;
}

async function ensureNextcloudFolder(user) {
  const folderUrl = buildNextcloudFolderUrl(user);
  const response = await fetch(folderUrl, {
    method: "MKCOL",
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
    },
  });

  if ([200, 201, 301, 405].includes(response.status)) {
    return;
  }

  const body = await response.text();
  throw new Error(
    `Nextcloud MKCOL failed with ${response.status}: ${body.slice(0, 200)}`
  );
}

function normalizeResponseList(multistatus) {
  const response = multistatus?.["d:multistatus"]?.["d:response"] ||
    multistatus?.multistatus?.response ||
    [];

  return Array.isArray(response) ? response : [response];
}

function extractPropstat(responseEntry) {
  const propstat = responseEntry?.["d:propstat"] || responseEntry?.propstat;
  const list = Array.isArray(propstat) ? propstat : [propstat].filter(Boolean);
  return list.find((entry) => {
    const status = entry?.["d:status"] || entry?.status || "";
    return typeof status === "string" && status.includes("200");
  });
}

function parseNextcloudDocumentList(xmlBody, folderName) {
  const parsed = parser.parse(xmlBody);
  const responses = normalizeResponseList(parsed);

  return responses
    .map((entry) => {
      const href = entry?.["d:href"] || entry?.href || "";
      const propstat = extractPropstat(entry);
      const prop = propstat?.["d:prop"] || propstat?.prop || {};
      const resourceType = prop?.["d:resourcetype"] || prop?.resourcetype || {};
      const isCollection = Boolean(
        resourceType?.["d:collection"] || resourceType?.collection
      );
      const displayName =
        prop?.["d:displayname"] || prop?.displayname || "";
      const fileName = decodeURIComponent(href.split("/").filter(Boolean).pop() || "");

      return {
        href,
        fileName,
        displayName,
        isCollection,
        lastModified:
          prop?.["d:getlastmodified"] || prop?.getlastmodified || null,
        size: Number.parseInt(
          prop?.["d:getcontentlength"] || prop?.getcontentlength || "0",
          10
        ),
      };
    })
    .filter((entry) => entry.fileName && !entry.isCollection)
    .filter((entry) => entry.fileName.toLowerCase().endsWith(".json"))
    .filter((entry) => entry.fileName !== folderName);
}

async function listNextcloudDocuments(user) {
  await ensureNextcloudFolder(user);

  const folderName = getNextcloudFolderPath();
  const response = await fetch(buildNextcloudFolderUrl(user), {
    method: "PROPFIND",
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      Depth: "1",
      "Content-Type": "application/xml; charset=utf-8",
    },
    body: `<?xml version="1.0"?>
      <d:propfind xmlns:d="DAV:">
        <d:prop>
          <d:displayname/>
          <d:getlastmodified/>
          <d:getcontentlength/>
          <d:resourcetype/>
        </d:prop>
      </d:propfind>`,
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Nextcloud PROPFIND failed with ${response.status}: ${body.slice(0, 200)}`
    );
  }

  return parseNextcloudDocumentList(body, folderName);
}

async function loadNextcloudDocument(user, fileName) {
  const response = await fetch(buildNextcloudDocumentUrl(user, fileName), {
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      Accept: "application/json",
    },
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Nextcloud GET failed with ${response.status}: ${body.slice(0, 200)}`
    );
  }

  return JSON.parse(body);
}

async function saveNextcloudDocument(user, fileName, payload) {
  await ensureNextcloudFolder(user);

  const response = await fetch(buildNextcloudDocumentUrl(user, fileName), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload, null, 2),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Nextcloud PUT failed with ${response.status}: ${body.slice(0, 200)}`
    );
  }

  return {
    fileName,
    nextcloudFolder: getNextcloudFolderPath(),
    nextcloudUrl: runtimeConfig.opendesk.nextcloudUrl,
  };
}

app.disable("x-powered-by");
app.use(express.json({ limit: "10mb" }));

app.get("/healthz", (_req, res) => {
  res.type("text/plain").send("ok\n");
});

app.get("/runtime-config.js", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.type("application/javascript").send(encodeRuntimeConfig(runtimeConfig));
});

app.get("/api/opendesk/context", requireOpenDesk, requireUser, (req, res) => {
  res.json({
    user: {
      uid: req.user.uid,
      email: req.user.email,
      displayName: req.user.displayName,
    },
    opendesk: {
      portalUrl: runtimeConfig.opendesk.portalUrl,
      suiteLabel: runtimeConfig.opendesk.suiteLabel,
      nextcloudUrl: runtimeConfig.opendesk.nextcloudUrl,
      nextcloudFolder: runtimeConfig.opendesk.nextcloudFolder,
    },
  });
});

app.get("/api/opendesk/navigation", requireOpenDesk, requireUser, async (req, res) => {
  try {
    const navigation = await fetchNavigation(req);
    res.json(navigation);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get(
  "/api/opendesk/nextcloud/documents",
  requireOpenDesk,
  requireUser,
  requireAccessToken,
  async (req, res) => {
    try {
      const documents = await listNextcloudDocuments(req.user);
      res.json({
        folder: runtimeConfig.opendesk.nextcloudFolder,
        documents,
      });
    } catch (error) {
      res.status(502).json({ error: error.message });
    }
  }
);

app.get(
  "/api/opendesk/nextcloud/documents/:fileName",
  requireOpenDesk,
  requireUser,
  requireAccessToken,
  async (req, res) => {
    try {
      const data = await loadNextcloudDocument(
        req.user,
        sanitizeFileName(req.params.fileName)
      );
      res.json(data);
    } catch (error) {
      res.status(502).json({ error: error.message });
    }
  }
);

app.put(
  "/api/opendesk/nextcloud/documents/:fileName",
  requireOpenDesk,
  requireUser,
  requireAccessToken,
  async (req, res) => {
    try {
      const result = await saveNextcloudDocument(
        req.user,
        sanitizeFileName(req.params.fileName),
        req.body
      );
      res.json(result);
    } catch (error) {
      res.status(502).json({ error: error.message });
    }
  }
);

app.use(
  "/static",
  express.static(path.join(PUBLIC_DIR, "static"), {
    immutable: true,
    maxAge: "7d",
  })
);
app.use(express.static(PUBLIC_DIR));

app.get("*", (_req, res) => {
  res.sendFile(INDEX_FILE);
});

app.listen(PORT, () => {
  console.log(`organigram server listening on ${PORT}`);
});
