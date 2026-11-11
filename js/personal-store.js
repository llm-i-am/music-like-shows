export const PREFIX = "music-like-shows:v1:";
const flagNames = ["favorite", "going"];
export class PersonalStore {
  constructor(storage, onChange = () => {}) {
    this.storage = storage;
    this.onChange = onChange;
    this.session = new Map();
    this.failed = false;
    this.corrupt = false;
    this.load();
  }
  load() {
    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key?.startsWith(PREFIX))
          this.session.set(key, this.storage.getItem(key));
      }
    } catch {
      this.failed = true;
    }
  }
  get(key, fallback = null) {
    try {
      const str = this.session.get(PREFIX + key);
      return str === undefined ? fallback : JSON.parse(str);
    } catch {
      this.corrupt = true;
      return fallback;
    }
  }
  put(key, value) {
    const full = PREFIX + key,
      text = JSON.stringify(value);
    this.session.set(full, text);
    try {
      this.storage.setItem(full, text);
    } catch {
      this.failed = true;
    }
    this.onChange();
  }
  setting(key, fallback) {
    return this.get("setting:" + key, fallback);
  }
  receive(key, value) {
    if (key?.startsWith(PREFIX)) {
      // A queued event can predate a local click; the current persisted value wins.
      try { value = this.storage.getItem(key); } catch {}
      if (value === null) this.session.delete(key);
      else this.session.set(key, value);
      this.onChange();
    }
  }
  flags(id) {
    const value = (flag) =>
      this.get("event:" + encodeURIComponent(id) + ":" + flag)?.value === true;
    return { favorite: value("favorite"), going: value("going") };
  }
  setFlag(id, flag, value, raw) {
    if (!flagNames.includes(flag)) return;
    if (raw) this.put("snapshot:" + encodeURIComponent(id), raw);
    this.put("event:" + encodeURIComponent(id) + ":" + flag, {
      value: !!value,
      updatedAt: new Date().toISOString(),
      writeId: globalThis.crypto?.randomUUID?.() || String(Math.random()),
    });
  }
  entries() {
    const ids = new Set();
    for (const key of this.session.keys()) {
      if (key.startsWith(PREFIX + "event:")) {
        const rest = key.slice((PREFIX + "event:").length);
        try {
          ids.add(decodeURIComponent(rest.slice(0, rest.lastIndexOf(":"))));
        } catch {
          this.corrupt = true;
        }
      }
    }
    return [...ids]
      .map((id) => ({
        id,
        ...this.flags(id),
        snapshot: this.get("snapshot:" + encodeURIComponent(id)),
      }))
      .filter((x) => x.favorite || x.going);
  }
  export() {
    return {
      format: "music-like-shows-personal",
      schema_version: 1,
      exported_at: new Date().toISOString(),
      shows: this.entries(),
      settings: {
        theme: this.setting("theme", "system"),
        reduceGlass: this.setting("reduceGlass", false),
      },
      ...(this.corrupt
        ? { recovery_raw_records: Object.fromEntries(this.session) }
        : {}),
    };
  }
  clear(kind = "all") {
    for (const item of this.entries())
      for (const flag of flagNames)
        if (kind === "all" || kind === flag) this.setFlag(item.id, flag, false);
    if (kind === "all")
      for (const key of [...this.session.keys()])
        if (key.startsWith(PREFIX + "snapshot:")) {
          this.session.delete(key);
          try {
            this.storage.removeItem(key);
          } catch {
            this.failed = true;
          }
        }
    this.onChange();
  }
  importFile(payload, replace = false) {
    const data = validateImport(payload);
    if (replace) this.clear("all");
    for (const item of data.shows) {
      const current = this.flags(item.id);
      for (const flag of flagNames)
        if (item[flag] === true && !current[flag])
          this.setFlag(item.id, flag, true, item.snapshot);
    }
    return data.shows.length;
  }
}
export function validateImport(data) {
  if (
    !data ||
    data.format !== "music-like-shows-personal" ||
    data.schema_version !== 1 ||
    !Array.isArray(data.shows) ||
    data.shows.length > 5000
  )
    throw new Error("Choose a supported Music Like Shows export (version 1).");
  const ids = new Set();
  for (const item of data.shows) {
    if (
      !item ||
      typeof item.id !== "string" ||
      !item.id ||
      item.id.length > 128 ||
      ids.has(item.id) ||
      typeof item.favorite !== "boolean" ||
      typeof item.going !== "boolean"
    )
      throw new Error("The export contains invalid or duplicate choices.");
    ids.add(item.id);
    if (
      item.snapshot !== undefined &&
      item.snapshot !== null &&
      (typeof item.snapshot !== "object" ||
        Array.isArray(item.snapshot) ||
        item.snapshot.id !== item.id)
    )
      throw new Error("An event snapshot does not match its ID.");
  }
  return data;
}
