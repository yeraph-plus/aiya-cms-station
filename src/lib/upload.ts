/**
 * Shared composer upload: posts the file to the same-origin proxy
 * (`/api/uploads/image/`) and resolves the cloaked `/media/` URL. Null on
 * any failure — network rejection included — so the callers' busy flags and
 * error states stay theirs (one composer surfaces an inline alert, another
 * a toast; this helper never decides).
 */
export async function uploadImage(file: File): Promise<string | null> {
  try {
    const form = new FormData();
    form.set('image', file);
    const response = await fetch('/api/uploads/image/', { method: 'POST', body: form });
    const json = (await response.json().catch(() => null)) as {
      ok?: boolean;
      url?: string;
    } | null;
    return json?.ok && json.url ? json.url : null;
  } catch {
    return null;
  }
}
