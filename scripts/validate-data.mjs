import { readFileSync } from "node:fs";
import { validateData, adapt, regionalDay } from "../js/model.js";
const text = readFileSync(
  new URL("../data/shows.json", import.meta.url),
  "utf8",
);
const data = JSON.parse(text);
validateData(data);
const before = JSON.stringify(data),
  today = regionalDay();
data.shows.forEach((row) => adapt(row, today));
if (before !== JSON.stringify(data))
  throw Error("The view adapter modified source data.");
console.log(
  `Validated ${data.shows.length} unique concert IDs; source records retained without modification.`,
);
