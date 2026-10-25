/**
 * User Data folder helpers (find-or-create folders, uploads) and file name / download utilities.
 */

const FP = () => foundry.applications.apps.FilePicker.implementation;

/** `${source}:${path}` → Promise of a folder already ensured during this session. */
const readyDirs = new Map();

const cleanPath = (path) => String(path ?? "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

const decode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** Does the folder exist? browse() throws for a missing local folder; the returned target is URL-encoded. */
async function dirExists(source, path) {
  try {
    const res = await FP().browse(source, path);
    return res?.target == null || cleanPath(decode(res.target)) === path;
  } catch {
    return false;
  }
}

// ported from gatos-chat-tools images.js ensureFolder + archive.js ensureDirectory
/**
 * Make sure a (nested) folder exists, creating each missing level. Remembered per session, and
 * concurrent calls for the same folder share one request. Throws when the folder cannot be created.
 * @param {string} path                      e.g. "worlds/my-world/chat-archives"
 * @param {{source?: string}} [options]      FilePicker source, default "data".
 * @returns {Promise<string>} The normalised path.
 */
export function ensureDataDir(path, { source = "data" } = {}) {
  const dir = cleanPath(path);
  if (!dir) return Promise.resolve(dir);
  const key = `${source}:${dir}`;
  let pending = readyDirs.get(key);
  if (!pending) {
    pending = (async () => {
      let sub = "";
      for (const part of dir.split("/").filter(Boolean)) {
        sub = sub ? `${sub}/${part}` : part;
        if (await dirExists(source, sub)) continue;
        try {
          await FP().createDirectory(source, sub, {});
        } catch (err) {
          // Created meanwhile (EEXIST) is fine; anything else is a real failure.
          if (!(await dirExists(source, sub))) throw err;
        }
      }
      return dir;
    })();
    readyDirs.set(key, pending);
    pending.catch(() => readyDirs.delete(key));
  }
  return pending;
}

// ported from gatos-chat-tools images.js uploadFile / archive.js uploadJson
/**
 * Upload a File into a Data folder (created when missing), without the core notification.
 * Overwrites a file of the same name. Throws when the server does not return a path.
 * @param {string} dir
 * @param {File} file
 * @param {{source?: string, notify?: boolean}} [options]
 * @returns {Promise<string>} The stored path.
 */
export async function uploadToData(dir, file, { source = "data", notify = false } = {}) {
  const target = await ensureDataDir(dir, { source });
  const res = await FP().upload(source, target, file, {}, { notify });
  if (!res?.path) throw new Error(res?.message || `upload of ${file?.name ?? "file"} failed`);
  return res.path;
}

// ported from gatos-chat-tools archive.js uploadJson
/**
 * Upload an object as `<dir>/<name>` JSON (overwriting). Returns the stored path.
 * @param {string} dir
 * @param {string} name
 * @param {any} obj
 * @param {{source?: string}} [options]
 * @returns {Promise<string>}
 */
export function uploadJson(dir, name, obj, { source = "data" } = {}) {
  const file = new File([JSON.stringify(obj)], name, { type: "application/json" });
  return uploadToData(dir, file, { source });
}

// ported from gatos-chat-tools export.js download / archive.js downloadArchiveJson, gatos-visual-novel player-editor.js downloadBlob
/**
 * Save data as a local download. Objects (other than Blobs) are written as JSON.
 * @param {string|Blob|object} data
 * @param {{type?: string, name?: string}} [options]
 */
export function download(data, { type = "application/json", name = "download.json" } = {}) {
  if (data != null && typeof data === "object" && !(data instanceof Blob)) data = JSON.stringify(data);
  if (typeof data === "string" && foundry.utils.saveDataToFile) return foundry.utils.saveDataToFile(data, type, name);
  const blob = data instanceof Blob ? data : new Blob([data ?? ""], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ported from gatos-chat-tools export.js safeFilename + archive.js safeName (unified)
/**
 * A string made safe as a file name: reserved characters become "_", whitespace collapses, length is capped.
 * @param {string} s
 * @param {string} [dflt="file"]             Used when nothing is left.
 * @param {{max?: number}} [options]
 * @returns {string}
 */
export function safeFilename(s, dflt = "file", { max = 80 } = {}) {
  const out = String(s ?? "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
  return out || dflt;
}

// ported from gatos-chat-tools export.js fileNameOf, gatos-visual-novel player-editor.js fileNameOf
/**
 * The decoded last path segment of a URL or path, without query or hash. "" for empty input and data: URIs.
 * @param {string} url
 * @returns {string}
 */
export function fileNameOf(url) {
  const s = String(url ?? "");
  if (!s || /^data:/i.test(s)) return "";
  const last = s.split(/[?#]/)[0].split("/").pop() || "";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

// ported from gatos-chat-tools archive.js loadArchive (`?v=${entry.createdAt}`)
/**
 * Append a cache-busting query parameter (`v`) so a re-uploaded file with the same path is fetched again.
 * @param {string} url
 * @param {string|number} [token=Date.now()]
 * @returns {string}
 */
export function cacheBust(url, token = Date.now()) {
  if (!url) return url;
  const [base, hash = ""] = String(url).split("#");
  return `${base}${base.includes("?") ? "&" : "?"}v=${encodeURIComponent(token)}${hash ? `#${hash}` : ""}`;
}
