export function downloadBlob(blob, fileName) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => {
    URL.revokeObjectURL(href);
  }, 1000);
}

export async function blobFromDataUrl(dataUrl) {
  const response = await fetch(dataUrl);

  if (!response.ok) {
    throw new Error(`Datei konnte nicht erzeugt werden (${response.status}).`);
  }

  return response.blob();
}
