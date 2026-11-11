import test from "node:test";
import assert from "node:assert/strict";
import { PersonalStore, PREFIX, validateImport } from "../js/personal-store.js";
class MemoryStorage {
  map = new Map();
  get length() {
    return this.map.size;
  }
  key(i) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k) {
    return this.map.get(k) ?? null;
  }
  setItem(k, v) {
    this.map.set(k, v);
  }
  removeItem(k) {
    this.map.delete(k);
  }
}
test("independent Favorite/Going flags, reload and clearing only our namespace", () => {
  const disk = new MemoryStorage();
  disk.setItem("other-app", "keep");
  const store = new PersonalStore(disk),
    raw = { id: "a", artist: "Artist", unknown_field: { keep: true } };
  store.setFlag("a", "favorite", true, raw);
  store.setFlag("a", "going", true, raw);
  assert.deepEqual(store.flags("a"), { favorite: true, going: true });
  assert.equal(store.entries().length, 1);
  store.setFlag("a", "favorite", false);
  assert.deepEqual(store.flags("a"), { favorite: false, going: true });
  assert.equal(new PersonalStore(disk).flags("a").going, true);
  store.clear("favorite");
  assert.equal(store.flags("a").going, true);
  store.clear("all");
  assert.equal(store.entries().length, 0);
  assert.equal(disk.getItem("other-app"), "keep");
});
test("denied storage remains usable in session and export retains snapshots", () => {
  const disk = {
    get length() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  };
  const store = new PersonalStore(disk);
  store.setFlag("a", "going", true, { id: "a", artist: "Artist" });
  assert(store.failed);
  assert.equal(store.export().shows[0].snapshot.artist, "Artist");
});
test("merge does not erase true flags; replace is explicit; future versions rejected", () => {
  const store = new PersonalStore(new MemoryStorage());
  store.setFlag("a", "going", true, { id: "a" });
  const data = {
    format: "music-like-shows-personal",
    schema_version: 1,
    shows: [{ id: "a", favorite: true, going: false, snapshot: { id: "a" } }],
  };
  store.importFile(data);
  assert.deepEqual(store.flags("a"), { going: true, favorite: true });
  store.importFile(data, true);
  assert.deepEqual(store.flags("a"), { going: false, favorite: true });
  assert.throws(() => validateImport({ ...data, schema_version: 2 }));
});
test("other-tab changes and removals do not overwrite the other flag", () => {
  const disk = new MemoryStorage(),
    s = new PersonalStore(disk);
  s.setFlag("a", "going", true, { id: "a" });
  disk.setItem(PREFIX + "event:a:favorite", JSON.stringify({ value: true }));
  s.receive(PREFIX + "event:a:favorite", JSON.stringify({ value: true }));
  assert(s.flags("a").favorite);
  disk.setItem(PREFIX + "event:a:favorite", JSON.stringify({ value: false }));
  s.receive(PREFIX + "event:a:favorite", JSON.stringify({ value: false }));
  assert(s.flags("a").going);
  assert(!s.flags("a").favorite);
});
test("corrupt saved JSON does not crash valid choices", () => {
  const disk = new MemoryStorage();
  disk.setItem(PREFIX + "event:a:favorite", "{bad");
  const s = new PersonalStore(disk);
  s.setFlag("b", "going", true, { id: "b" });
  assert.equal(s.entries().length, 1);
  assert(s.corrupt);
});
