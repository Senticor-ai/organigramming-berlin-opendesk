async function parseJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      payload = null;
    }
  }

  if (!response.ok) {
    const message = payload?.error || fallbackMessage;
    throw new Error(message);
  }

  return payload;
}

export async function fetchOpenDeskContext() {
  const response = await fetch("/api/opendesk/context", {
    credentials: "same-origin",
  });

  return parseJsonResponse(response, "Kontext konnte nicht geladen werden.");
}

export async function fetchOpenDeskNavigation(language) {
  const url = new URL("/api/opendesk/navigation", window.location.origin);
  if (language) {
    url.searchParams.set("language", language);
  }

  const response = await fetch(url.toString(), {
    credentials: "same-origin",
  });

  return parseJsonResponse(
    response,
    "Die zentrale Navigation konnte nicht geladen werden."
  );
}

export async function listNextcloudDocuments() {
  const response = await fetch("/api/opendesk/nextcloud/documents", {
    credentials: "same-origin",
  });

  return parseJsonResponse(
    response,
    "Die Nextcloud-Dokumente konnten nicht geladen werden."
  );
}

export async function loadNextcloudDocument(fileName) {
  const response = await fetch(
    `/api/opendesk/nextcloud/documents/${encodeURIComponent(fileName)}`,
    {
      credentials: "same-origin",
    }
  );

  return parseJsonResponse(
    response,
    "Das Dokument konnte nicht aus Nextcloud geladen werden."
  );
}

export async function saveNextcloudDocument(fileName, payload) {
  const response = await fetch(
    `/api/opendesk/nextcloud/documents/${encodeURIComponent(fileName)}`,
    {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  return parseJsonResponse(
    response,
    "Das Dokument konnte nicht in Nextcloud gespeichert werden."
  );
}
