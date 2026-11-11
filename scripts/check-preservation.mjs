// Run before a UI-only merge: node scripts/check-preservation.mjs <baseline-commit>
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const baseline = process.argv[2];
if (!baseline || !/^[0-9a-f]{7,40}$/.test(baseline))
  throw Error("Supply the reviewed baseline commit SHA.");
const original = execFileSync("git", ["show", baseline + ":data/shows.json"]),
  current = readFileSync(new URL("../data/shows.json", import.meta.url));
if (!original.equals(current))
  throw Error(
    "Concert data differs from the baseline. Reconcile any legitimate Muse update separately; never overwrite it with stale data.",
  );
console.log(
  "Byte-identical concert data. SHA-256: " +
    createHash("sha256").update(current).digest("hex"),
);
