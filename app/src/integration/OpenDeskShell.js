import React, { useEffect, useState } from "react";

import {
  fetchOpenDeskContext,
  fetchOpenDeskNavigation,
} from "./opendeskApi";
import runtimeConfig from "./runtimeConfig";

import "./OpenDeskShell.scss";

const normalizeNavigationItems = (payload) => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload.entries)) {
    return payload.entries;
  }

  if (Array.isArray(payload.categories)) {
    return payload.categories.flatMap((category) =>
      Array.isArray(category.entries) ? category.entries : []
    );
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
};

const normalizeLinkTarget = (target) => {
  if (!target) {
    return undefined;
  }

  if (target === "newwindow" || target.startsWith("tab_")) {
    return "_blank";
  }

  return target;
};

const normalizeLookupValue = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const findNavigationItem = (items, matcher) =>
  items.find((item) => {
    const identifier = normalizeLookupValue(item?.identifier);
    const displayName = normalizeLookupValue(item?.display_name);
    const link = normalizeLookupValue(item?.link);
    return matcher({ identifier, displayName, link });
  }) || null;

const getFilesHref = (items, fallbackUrl) => {
  const filesItem = findNavigationItem(
    items,
    ({ identifier, displayName, link }) =>
      identifier.includes("files") ||
      displayName === "dateien" ||
      link.includes("/apps/files")
  );

  if (filesItem?.link) {
    return filesItem.link;
  }

  if (fallbackUrl) {
    return `${fallbackUrl}/apps/files/`;
  }

  return "";
};

const getInitials = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return "OD";
  }

  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "OD";
  }

  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
};

const OpenDeskShell = ({ children }) => {
  const { opendesk } = runtimeConfig;
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [navigationItems, setNavigationItems] = useState([]);
  const [navigationState, setNavigationState] = useState("idle");
  const [context, setContext] = useState(null);

  useEffect(() => {
    if (!opendesk.enabled) {
      return undefined;
    }

    let cancelled = false;

    fetchOpenDeskContext()
      .then((data) => {
        if (!cancelled) {
          setContext(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContext(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [opendesk.enabled]);

  useEffect(() => {
    if (!opendesk.enabled) {
      return undefined;
    }

    let cancelled = false;
    let attempts = 0;
    let retryTimer;

    const loadNavigation = async () => {
      if (cancelled || attempts >= 3) {
        return;
      }

      attempts += 1;
      setNavigationState("loading");

      try {
        const payload = await fetchOpenDeskNavigation(
          opendesk.navigationLanguage
        );
        const items = normalizeNavigationItems(payload);

        if (!cancelled) {
          setNavigationItems(items);
          setNavigationState("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setNavigationState("error");

          if (attempts < 3) {
            retryTimer = window.setTimeout(loadNavigation, 1200);
          }
        }
      }
    };

    const timer = window.setTimeout(loadNavigation, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [
    opendesk.enabled,
    opendesk.navigationLanguage,
  ]);

  if (!opendesk.enabled) {
    return children;
  }

  const filesHref = getFilesHref(navigationItems, opendesk.nextcloudUrl);
  const userDisplayName = context?.user?.displayName || "";
  const userEmail = context?.user?.email || "";
  const userInitials = getInitials(userDisplayName || userEmail);

  return (
    <div className="opendesk-shell">
      <header className="opendesk-shell__header">
        <div className="opendesk-shell__brand">
          <button
            type="button"
            className="opendesk-shell__waffle"
            onClick={() => setNavigationOpen((current) => !current)}
            aria-label="Anwendungen anzeigen"
            aria-expanded={navigationOpen}
          >
            {[...Array(9)].map((_, index) => (
              <span key={`waffle-dot-${index}`} />
            ))}
          </button>
          <div className="opendesk-shell__brand-mark" aria-hidden="true">
            {[...Array(4)].map((_, index) => (
              <span key={`brand-dot-${index}`} />
            ))}
          </div>
          <div className="opendesk-shell__titles">
            <span className="opendesk-shell__suite-label">{opendesk.suiteLabel}</span>
            <span className="opendesk-shell__title">Organigramme</span>
          </div>
        </div>

        <div className="opendesk-shell__actions">
          {filesHref && (
            <a className="opendesk-shell__action-link" href={filesHref}>
              Dateien
            </a>
          )}
          {opendesk.portalUrl && (
            <a
              className="opendesk-shell__action-link"
              href={opendesk.portalUrl}
            >
              Portal
            </a>
          )}
          {(userDisplayName || userEmail) && (
            <div className="opendesk-shell__identity">
              <span className="opendesk-shell__identity-avatar" aria-hidden="true">
                {userInitials}
              </span>
              <span className="opendesk-shell__identity-copy">
                {userDisplayName && (
                  <span className="opendesk-shell__identity-name">
                    {userDisplayName}
                  </span>
                )}
                {userEmail && (
                  <span className="opendesk-shell__identity-email">{userEmail}</span>
                )}
              </span>
            </div>
          )}
          <a
            className="opendesk-shell__action-link opendesk-shell__action-link--logout"
            href={opendesk.proxyLogoutUrl}
          >
            Abmelden
          </a>
        </div>
      </header>

      <div className="opendesk-shell__content">{children}</div>

      <div
        className={`opendesk-shell__switcher${
          navigationOpen ? " is-open" : ""
        }`}
      >
        <div className="opendesk-shell__switcher-header">
          <h2>Anwendungen</h2>
          <button
            type="button"
            className="opendesk-shell__close"
            onClick={() => setNavigationOpen(false)}
            aria-label="Anwendungsmenü schließen"
          >
            ×
          </button>
        </div>

        {navigationState === "loading" && navigationItems.length === 0 && (
          <p className="opendesk-shell__status">
            Anwendungen werden geladen.
          </p>
        )}

        {navigationState === "error" && navigationItems.length === 0 && (
          <p className="opendesk-shell__status">
            Die zentrale Navigation konnte nicht geladen werden.
          </p>
        )}

        <div className="opendesk-shell__grid">
          {opendesk.portalUrl && (
            <a className="opendesk-shell__tile" href={opendesk.portalUrl}>
              <span className="opendesk-shell__tile-fallback">⌂</span>
              <span className="opendesk-shell__tile-label">Portal</span>
            </a>
          )}

          {navigationItems.map((item) => (
            <a
              key={`${item.identifier || item.display_name}-${item.link}`}
              className="opendesk-shell__tile"
              href={item.link}
              target={normalizeLinkTarget(item.target)}
              rel={
                normalizeLinkTarget(item.target) === "_blank"
                  ? "noreferrer"
                  : undefined
              }
            >
              {item.icon_url ? (
                <img
                  className="opendesk-shell__tile-icon"
                  src={item.icon_url}
                  alt=""
                />
              ) : (
                <span className="opendesk-shell__tile-fallback">⋯</span>
              )}
              <span className="opendesk-shell__tile-label">
                {item.display_name}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OpenDeskShell;
