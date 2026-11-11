import { dateLabel, priceLabel, PICKS } from "./model.js?v=1.0.0";
export const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = String(text);
  return n;
};
const action = (id, kind, label, cls = "action") => {
  const b = el("button", cls, label);
  b.type = "button";
  b.dataset.action = kind;
  b.dataset.id = id;
  return b;
};
export function personalActions(show, flags) {
  const row = el("div", "card-actions");
  for (const flag of ["favorite", "going"]) {
    const selected = flags[flag],
      label =
        flag === "favorite"
          ? selected
            ? "Favorited"
            : "Favorite"
          : selected
            ? "Going ✓"
            : "Going";
    const b = action(show.id, flag, "", "action " + flag);
    const symbol = el(
      "span",
      "symbol",
      flag === "favorite" ? (selected ? "♥" : "♡") : "✓",
    );
    symbol.setAttribute("aria-hidden", "true");
    b.append(symbol, el("span", "", label));
    b.setAttribute("aria-pressed", String(selected));
    b.setAttribute(
      "aria-label",
      `${selected ? "Remove" : "Mark"} ${flag === "favorite" ? "favorite" : "Going"}: ${show.artist}, ${dateLabel(show.day)}`,
    );
    row.append(b);
  }
  return row;
}
export function ticketLink(show) {
  if (!show.link) return null;
  const label =
    show.linkType === "tickets"
      ? "Tickets"
      : show.linkType === "article"
        ? "Read coverage"
        : "Event details";
  const a = el("a", "ticket-link", label);
  a.href = show.link;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.setAttribute("aria-label", `${label}: ${show.artist} (opens a new tab)`);
  return a;
}
export function card(
  show,
  flags,
  { unavailable = false, personalBadges = true } = {},
) {
  const article = el("article", "concert");
  article.dataset.event = show.id;
  const tile = el("div", "date-tile");
  tile.setAttribute("aria-hidden", "true");
  if (show.day) {
    const d = new Date(show.day + "T12:00Z");
    tile.append(
      el(
        "span",
        "month",
        d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      ),
      el("span", "day", d.getUTCDate()),
      el(
        "span",
        "weekday",
        d.toLocaleString("en-US", { weekday: "short", timeZone: "UTC" }),
      ),
    );
  } else tile.append(el("span", "month", "DATE"), el("span", "day", "?"));
  const main = el("div", "concert-main"),
    top = el("div", "card-top"),
    title = el("div");
  const heading = el("h3", "card-title"),
    titleButton = action(
      show.id,
      "details",
      show.artist + " ›",
      "concert-title-button",
    );
  titleButton.setAttribute("aria-haspopup", "dialog");
  titleButton.setAttribute("aria-controls", "show-dialog");
  titleButton.setAttribute("aria-label", "Details: " + show.artist);
  heading.append(titleButton);
  title.append(heading);
  title.append(el("p", "venue-line", show.venue + " · " + show.city));
  const date = el(
    "p",
    "when-line",
    `${show.day ? dateLabel(show.day) : show.raw.date_text || "Date to be announced"} · ${show.time}`,
  );
  title.append(date);
  top.append(
    title,
    el(
      "p",
      "price" + (show.cents === null ? " price-unknown" : ""),
      priceLabel(show),
    ),
  );
  main.append(top);
  const badges = el("div", "badges");
  if (show.tier)
    badges.append(el("span", "badge pick-" + show.tier, PICKS[show.tier]));
  if (show.curatorFavorite)
    badges.append(el("span", "badge curator", "Curator favorite"));
  if (unavailable) badges.append(el("span", "badge", "Last saved listing"));
  if (personalBadges && flags.going)
    badges.append(el("span", "badge personal", "You’re going"));
  if (show.status)
    badges.append(
      el("span", "badge", show.status[0].toUpperCase() + show.status.slice(1)),
    );
  if (show.availability) badges.append(el("span", "badge", show.availability));
  if (badges.childNodes.length) main.append(badges);
  const actions = personalActions(show, flags);
  if (!unavailable) {
    const link = ticketLink(show);
    if (link) actions.append(link);
  }
  article.append(tile, main, actions);
  return article;
}
export function detail(show, flags, unavailable = false, snapshot = null) {
  const content = el("div");
  const title = el("h2", "", show.artist);
  title.id = "show-title";
  content.append(title);
  content.append(
    el(
      "p",
      "",
      show.day
        ? dateLabel(show.day, true)
        : show.raw.date_text || "Date to be announced",
    ),
  );
  content.append(
    el("p", "", show.time + " ET · " + show.venue + ", " + show.city),
  );
  content.append(el("p", "details-price", priceLabel(show)));
  if (unavailable)
    content.append(
      el(
        "p",
        "status-line",
        "Last saved information. This listing is no longer in the current guide.",
      ),
    );
  else
    content.append(
      el(
        "p",
        "source-line",
        "Listed price; confirm fees, times and availability with the source.",
      ),
    );
  if (show.tier)
    content.append(
      el("p", "", PICKS[show.tier] + " — a recommendation from the curator."),
    );
  if (show.curatorFavorite)
    content.append(
      el("p", "", "Curator favorite — separate from your own Favorites."),
    );
  if (show.found)
    content.append(
      el(
        "p",
        "source-line",
        "Added " +
          dateLabel(show.found) +
          ". This is not a ticket-verification date.",
      ),
    );
  if (snapshot) {
    const changes = [];
    if (snapshot.price_pp !== show.raw.price_pp) changes.push("listed price");
    if (snapshot.date_iso !== show.raw.date_iso) changes.push("date");
    if (changes.length)
      content.append(
        el(
          "p",
          "status-line",
          "Changed since you first saved: " + changes.join(" and ") + ".",
        ),
      );
  }
  const actions = personalActions(show, flags);
  if (!unavailable) {
    const link = ticketLink(show);
    if (link) {
      actions.append(link);
      content.append(
        el("p", "source-line", "Source: " + new URL(show.link).hostname),
      );
    } else
      content.append(
        el("p", "source-line", "No usable source link is listed."),
      );
  }
  actions.append(action(show.id, "share", "Share show", "action"));
  content.append(actions);
  return content;
}
