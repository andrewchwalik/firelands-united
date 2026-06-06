document.addEventListener("DOMContentLoaded", () => {
  // ----- Shared sponsors include -----
  // Single source of truth: /partials/sponsors.html
  async function loadSharedSponsors() {
    const footers = document.querySelectorAll("footer.site-footer");
    if (footers.length === 0) return;
    try {
      const response = await fetch("/partials/sponsors.html", { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed to load shared sponsors (${response.status})`);
      const markup = await response.text();
      footers.forEach((footer) => {
        const previous = footer.previousElementSibling;
        if (previous && previous.classList.contains("sponsor-section")) {
          previous.remove();
        }
        footer.insertAdjacentHTML("beforebegin", markup);
      });
    } catch (error) {
      console.error("Error loading shared sponsors:", error);
    }
  }

  async function loadSharedNewsletter() {
    const footers = document.querySelectorAll("footer.site-footer");
    if (footers.length === 0) return;
    try {
      const response = await fetch("/partials/newsletter.html", { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed to load shared newsletter (${response.status})`);
      const markup = await response.text();
      document.querySelectorAll(".newsletter-section").forEach((section) => section.remove());
      footers.forEach((footer) => {
        const sponsorSection = footer.previousElementSibling;
        if (sponsorSection && sponsorSection.classList.contains("sponsor-section")) {
          sponsorSection.insertAdjacentHTML("afterend", markup);
        } else {
          footer.insertAdjacentHTML("beforebegin", markup);
        }
      });
    } catch (error) {
      console.error("Error loading shared newsletter:", error);
    }
  }

  // ----- Shared footer include -----
  // Single source of truth: /partials/footer.html
  // Any footer update should be made there.
  async function loadSharedFooter() {
    const footers = document.querySelectorAll("footer.site-footer");
    if (footers.length === 0) return;
    try {
      const response = await fetch("/partials/footer.html", { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed to load shared footer (${response.status})`);
      const markup = await response.text();
      footers.forEach((footer) => {
        footer.innerHTML = markup;
      });
    } catch (error) {
      console.error("Error loading shared footer:", error);
    }
  }

  (async function initSharedPageSections() {
    await loadSharedSponsors();
    await loadSharedNewsletter();
    await loadSharedFooter();
  })();

  // Ensure nav merch links have an inner label for layered jersey styling.
  document.querySelectorAll("a.nav-merch").forEach((link) => {
    if (link.querySelector(".nav-merch-label")) return;
    const labelText = (link.textContent || "Merch").trim() || "Merch";
    link.textContent = "";
    const label = document.createElement("span");
    label.className = "nav-merch-label";
    label.textContent = labelText;
    link.appendChild(label);
  });

  const SCHEDULE_PAGE_SOURCES = [
    { url: "/mens-schedule/", teamLabel: "Men's First Team" },
    { url: "/womens-schedule/", teamLabel: "Women's First Team" },
  ];

  const MONTH_INDEX = {
    jan: "01",
    january: "01",
    feb: "02",
    february: "02",
    mar: "03",
    march: "03",
    apr: "04",
    april: "04",
    may: "05",
    jun: "06",
    june: "06",
    jul: "07",
    july: "07",
    aug: "08",
    august: "08",
    sep: "09",
    sept: "09",
    september: "09",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12",
  };

  function parseScheduleDateTime(dateText, timeText) {
    const cleanedDate = (dateText || "").replace(/^[A-Za-z]+,\s*/, "").trim();
    const dateMatch = cleanedDate.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
    const timeMatch = (timeText || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!dateMatch || !timeMatch) return null;

    const [, monthName, day, year] = dateMatch;
    const month = MONTH_INDEX[monthName.toLowerCase()];
    if (!month) return null;

    let hours = Number(timeMatch[1]);
    const minutes = timeMatch[2];
    const meridiem = timeMatch[3].toUpperCase();
    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;

    const hourString = String(hours).padStart(2, "0");
    return new Date(`${year}-${month}-${String(day).padStart(2, "0")}T${hourString}:${minutes}:00-04:00`);
  }

  function parseScheduleCard(card, teamLabel) {
    const teams = card.querySelectorAll(".schedule-team");
    if (teams.length < 2) return null;

    const leftTeam = teams[0];
    const rightTeam = teams[1];
    const typeText = card.querySelector(".schedule-match-type")?.textContent?.trim() || "Match";
    const timeText = card.querySelector(".schedule-time")?.textContent?.trim() || "";
    const dateText = card.querySelector(".schedule-date")?.textContent?.trim() || "";
    const statusText = card.querySelector(".schedule-status")?.textContent?.trim() || "";
    const locationText = card.querySelector(".schedule-location")?.textContent?.trim() || "";
    const kickoff = parseScheduleDateTime(dateText, timeText);
    if (!kickoff) return null;

    const statusParts = statusText.split("·").map((part) => part.trim()).filter(Boolean);
    const venueName = statusParts[1] || (locationText && locationText !== "Venue TBA" ? locationText : "Venue TBA");

    return {
      teamLabel,
      kickoff,
      typeText,
      timeText,
      dateText,
      statusText,
      venueName,
      locationText,
      modeText: card.classList.contains("away-match") ? "Away Match" : "Home Match",
      leftTeam: {
        name: leftTeam.querySelector(".schedule-team-name")?.textContent?.trim() || "",
        logo: leftTeam.querySelector(".schedule-team-logo")?.getAttribute("src") || "",
      },
      rightTeam: {
        name: rightTeam.querySelector(".schedule-team-name")?.textContent?.trim() || "",
        logo: rightTeam.querySelector(".schedule-team-logo")?.getAttribute("src") || "",
      },
    };
  }

  function updateHomeUpcomingMatch(match) {
    const section = document.querySelector(".home-next-match-section");
    if (!section || !match) return;

    const teams = section.querySelectorAll(".home-next-match-team");
    const leftLogo = teams[0]?.querySelector(".home-next-match-logo");
    const leftName = teams[0]?.querySelector("h3");
    const rightLogo = teams[1]?.querySelector(".home-next-match-logo");
    const rightName = teams[1]?.querySelector("h3");
    const type = section.querySelector(".home-next-match-type");
    const detail = section.querySelector(".home-next-match-detail");
    const location = section.querySelector(".home-next-match-location");
    const directions = section.querySelector(".home-next-match-directions");
    const countdown = section.querySelector(".home-next-match-countdown");

    if (leftLogo) {
      leftLogo.src = match.leftTeam.logo;
      leftLogo.alt = `${match.leftTeam.name} badge`;
    }
    if (leftName) leftName.textContent = match.leftTeam.name;
    if (rightLogo) {
      rightLogo.src = match.rightTeam.logo;
      rightLogo.alt = `${match.rightTeam.name} badge`;
    }
    if (rightName) rightName.textContent = match.rightTeam.name;
    if (type) type.textContent = `${match.teamLabel} · ${match.typeText}`;
    if (detail) detail.textContent = `${match.dateText} · ${match.timeText}`;
    if (location) {
      location.textContent =
        match.locationText === "Venue TBA"
          ? "Venue details to be confirmed"
          : `${match.venueName} · ${match.locationText}`;
    }
    if (directions) {
      const destination = match.locationText === "Venue TBA" ? match.venueName : match.locationText;
      directions.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
    }
    if (countdown) {
      countdown.dataset.matchDatetime = match.kickoff.toISOString();
      countdown.textContent = "0D : 00H : 00M : 00S";
    }
  }

  async function syncHomeUpcomingMatchFromSchedules() {
    const section = document.querySelector(".home-next-match-section");
    if (!section) return;

    try {
      const responses = await Promise.all(
        SCHEDULE_PAGE_SOURCES.map(async (source) => {
          const response = await fetch(source.url, { cache: "no-store" });
          if (!response.ok) throw new Error(`Failed to load ${source.url} (${response.status})`);
          const markup = await response.text();
          const doc = new DOMParser().parseFromString(markup, "text/html");
          const matches = Array.from(doc.querySelectorAll(".schedule-card"))
            .map((card) => parseScheduleCard(card, source.teamLabel))
            .filter(Boolean);
          return matches;
        })
      );

      const allMatches = responses.flat().sort((a, b) => a.kickoff - b.kickoff);
      const now = Date.now();
      const currentOrUpcoming = allMatches.find((match) => match.kickoff.getTime() >= now - 3 * 60 * 60 * 1000);
      if (currentOrUpcoming) {
        updateHomeUpcomingMatch(currentOrUpcoming);
      }
    } catch (error) {
      console.error("Error syncing upcoming match from schedule pages:", error);
    }
  }

  function startHomeNextMatchCountdown() {
    const countdownEls = document.querySelectorAll(".home-next-match-countdown[data-match-datetime]");
    if (countdownEls.length === 0) return;

    const formatCountdown = (distanceMs) => {
      const totalSeconds = Math.max(0, Math.floor(distanceMs / 1000));
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return `${days}D : ${String(hours).padStart(2, "0")}H : ${String(minutes).padStart(2, "0")}M : ${String(seconds).padStart(2, "0")}S`;
    };

    const tick = () => {
      const now = Date.now();

      countdownEls.forEach((el) => {
        const matchTime = new Date(el.dataset.matchDatetime).getTime();
        if (Number.isNaN(matchTime)) return;

        const distance = matchTime - now;
        el.textContent = distance <= 0 ? "LIVE NOW" : formatCountdown(distance);
      });
    };

    tick();
    window.setInterval(tick, 1000);
  }

  startHomeNextMatchCountdown();
  syncHomeUpcomingMatchFromSchedules();

  function initSchedulePastResults() {
    const scheduleCards = document.querySelectorAll(".schedule-card[data-result-text]");
    if (scheduleCards.length === 0) return;

    const now = Date.now();

    scheduleCards.forEach((card) => {
      const timeEl = card.querySelector(".schedule-time");
      const dateText = card.querySelector(".schedule-date")?.textContent?.trim() || "";
      const scheduledTime = timeEl?.dataset.scheduledTime || timeEl?.textContent?.trim() || "";
      const resultText = card.dataset.resultText?.trim();
      if (!timeEl || !resultText) return;

      const kickoff = parseScheduleDateTime(dateText, scheduledTime);
      if (!kickoff) return;

      if (kickoff.getTime() <= now) {
        timeEl.dataset.scheduledTime = scheduledTime;
        timeEl.textContent = resultText;
        timeEl.classList.add("is-result");
        card.classList.add("is-complete");
      }
    });
  }

  function initScheduleActionButtons() {
    const scheduleCards = document.querySelectorAll(".schedule-card[data-directions-query]");
    if (scheduleCards.length === 0) return;

    const liveUrl = "https://www.youtube.com/@FirelandsUnited/streams";
    const merchUrl = "https://ykxwgu-j1.myshopify.com";

    scheduleCards.forEach((card) => {
      if (card.querySelector(".schedule-actions")) return;

      const directionsQuery = (card.dataset.directionsQuery || "").trim();
      const actions = document.createElement("div");
      actions.className = "schedule-actions";

      const directionsButton = document.createElement("a");
      directionsButton.className = "schedule-action-button directions-button";
      directionsButton.textContent = "Get Directions";
      directionsButton.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(directionsQuery)}`;
      directionsButton.target = "_blank";
      directionsButton.rel = "noopener noreferrer";

      const liveButton = document.createElement("a");
      liveButton.className = "schedule-action-button live-button";
      liveButton.textContent = "Watch the Stream";
      liveButton.href = liveUrl;
      liveButton.target = "_blank";
      liveButton.rel = "noopener noreferrer";

      const merchButton = document.createElement("a");
      merchButton.className = "schedule-action-button merch-button";
      merchButton.textContent = "Get Merch";
      merchButton.href = merchUrl;
      merchButton.target = "_blank";
      merchButton.rel = "noopener noreferrer";

      actions.append(directionsButton, liveButton, merchButton);
      card.appendChild(actions);
    });
  }

  initSchedulePastResults();
  initScheduleActionButtons();

  // ----- Shared club data source of truth -----
  // Source now lives in /data/*.json for easy non-code updates.

  function normalizeName(value) {
    return (value || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function deriveInitials(name) {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "N/A";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  function isCaptainInContext(playerName, year) {
    const normalized = normalizeName(playerName);
    if (normalized === normalizeName("Grant Miller")) {
      // Requested contexts: main roster page and 2025 history tab.
      if (year === "2025") return true;
      if (!year) return true;
    }
    if (normalized === normalizeName("Jack Ramey") && year === "2026") return true;
    return false;
  }

  function buildPlayerMap(players) {
    const byName = new Map();
    players.forEach((player) => {
      byName.set(normalizeName(player.name), player);
      (player.aliases || []).forEach((alias) => {
        byName.set(normalizeName(alias), player);
      });
    });
    return byName;
  }

  function buildStaffMap(staff) {
    const byName = new Map();
    staff.forEach((person) => {
      byName.set(normalizeName(person.name), person);
    });
    return byName;
  }

  function buildSeasonStatsMap(seasons) {
    const byKey = new Map();
    seasons.forEach((season) => {
      byKey.set(`${season.team}-${season.season}`, season);
    });
    return byKey;
  }

  function getPageTeam() {
    const path = window.location.pathname;
    if (path.includes("womens")) return "women";
    if (path.includes("mens") || path.includes("roster") || path.includes("staff")) return "men";
    return null;
  }

  function getPlayerSeasonStats(player, year, seasonsByKey) {
    if (!player || !year || !seasonsByKey) return null;
    const season = seasonsByKey.get(`${player.team}-${year}`);
    return season?.playerStats?.[player.id] || null;
  }

  function getRosterApps(player) {
    return player?.roster?.allTimeAppearances ?? player?.roster?.appearances ?? 0;
  }

  function formatApps(value, labelPrefix = "") {
    const apps = Number(value) || 0;
    const noun = apps === 1 ? "App." : "Apps.";
    return `${apps} ${labelPrefix}${noun}`;
  }

  function splitName(name) {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    return {
      first: parts[0] || name || "",
      last: parts.slice(1).join(" ") || ""
    };
  }

  function avatarMarkup(person) {
    if (person?.image) {
      return `<div class="history-avatar avatar-photo"><img src="${person.image}" alt="${person.name} headshot" loading="lazy"></div>`;
    }
    return `<div class="history-avatar">${deriveInitials(person?.name)}</div>`;
  }

  function displayNumber(player) {
    const raw = player?.roster?.number;
    return raw ? `#${String(raw).replace(/^#/, "")}` : "#TBD";
  }

  function positionGroup(position) {
    const value = (position || "").toUpperCase();
    if (value.includes("GK")) return "Goalkeepers";
    if (value.includes("ST") || value.includes("FWD") || value.includes("WING") || value.includes("LW") || value.includes("RW")) return "Attackers";
    if (value.includes("CB") || value.includes("LB") || value.includes("RB") || value.includes("DEF")) return "Defenders";
    return "Midfielders";
  }

  function playerCardMarkup(player, apps, allTime = true) {
    const { first, last } = splitName(player.name);
    const captain = player.roster?.captain ? '<span class="captain-armband" aria-label="Captain" title="Captain"></span>' : "";
    return `
      <article class="roster-card">
        ${avatarMarkup(player)}
        <h3><span class="roster-first-name">${first}</span><span class="roster-last-name">${last}${captain}</span></h3>
        <p class="roster-meta"><span class="roster-number">${displayNumber(player)}</span><span class="roster-position">${player.roster?.position || "N/A"}</span><span class="roster-appearances">${formatApps(apps, allTime ? "All-Time " : "")}</span></p>
        ${player.hometown ? `<p class="roster-hometown">${player.hometown}</p>` : ""}
      </article>
    `;
  }

  function historyPlayerMarkup(player, stats, year) {
    const { first, last } = splitName(player.name);
    const captain = isCaptainInContext(player.name, String(year)) ? '<span class="captain-armband" aria-label="Captain" title="Captain"></span>' : "";
    const apps = stats?.appearances ?? 0;
    return `
      <article class="history-player">
        ${avatarMarkup(player)}
        <div>
          <h3 class="history-name"><span class="history-first-name">${first}</span><span class="history-last-name">${last}${captain}</span></h3>
          ${player.hometown ? `<p class="history-hometown">${player.hometown}</p>` : ""}
          <p class="history-subtext"><span class="history-pill history-number-pill">${displayNumber(player)}</span><span class="history-pill history-position-pill">${player.roster?.position || "N/A"}</span><span class="history-pill history-apps-pill">${formatApps(apps)}</span></p>
        </div>
      </article>
    `;
  }

  function coachCardMarkup(person, role) {
    const { first, last } = splitName(person.name);
    const matches = role.matchesCoached === null || role.matchesCoached === undefined
      ? ""
      : `<span class="roster-coach-matches">${role.matchesCoached} ${role.matchesCoached === 1 ? "Match" : "Matches"}</span>`;
    return `
      <article class="roster-card coaching-card">
        ${avatarMarkup(person)}
        <h3><span class="roster-first-name">${first}</span><span class="roster-last-name">${last}</span></h3>
        <p class="roster-meta"><span class="roster-position">${role.title}</span>${matches}</p>
        ${person.hometown ? `<p class="roster-hometown">${person.hometown}</p>` : ""}
      </article>
    `;
  }

  function renderRosterPages(players, staff) {
    const panel = document.querySelector(".roster-panel[data-roster='first-team']");
    if (!panel) return;
    const team = getPageTeam();
    if (!team) return;

    const currentPlayers = players
      .filter((player) => player.team === team && player.roster?.current)
      .sort((a, b) => Number(a.roster?.number || 999) - Number(b.roster?.number || 999));
    const currentRoles = staff
      .map((person) => ({ person, role: getRoleForContext(person, team, "2026") }))
      .filter((entry) => entry.role);

    const groupOrder = ["Goalkeepers", "Defenders", "Midfielders", "Attackers"];
    const grouped = new Map(groupOrder.map((group) => [group, []]));
    currentPlayers.forEach((player) => {
      grouped.get(positionGroup(player.roster?.position)).push(player);
    });

    panel.innerHTML = `
      <div class="roster-group">
        <h2 class="roster-group-title">Coaches</h2>
        <div class="coaching-row">${currentRoles.map(({ person, role }) => coachCardMarkup(person, role)).join("")}</div>
      </div>
      ${groupOrder.map((group) => `
        <div class="roster-group">
          <h2 class="roster-group-title">${group}</h2>
          <div class="roster-grid">${grouped.get(group).map((player) => playerCardMarkup(player, getRosterApps(player), true)).join("")}</div>
        </div>
      `).join("")}
    `;
  }

  function setCardAvatar(avatarEl, player, altName) {
    if (!avatarEl || !player) return;
    if (player.image) {
      avatarEl.classList.add("avatar-photo");
      avatarEl.innerHTML = `<img src="${player.image}" alt="${altName} headshot" loading="lazy">`;
      return;
    }
    avatarEl.classList.remove("avatar-photo");
    avatarEl.textContent = player.initials || deriveInitials(altName);
  }

  function upsertCardHometown(container, className, hometown, beforeEl) {
    if (!container) return;
    let hometownEl = container.querySelector(`.${className}`);
    if (!hometown) {
      if (hometownEl) hometownEl.remove();
      return;
    }
    if (!hometownEl) {
      hometownEl = document.createElement("p");
      hometownEl.className = className;
      if (beforeEl && beforeEl.parentElement === container) {
        container.insertBefore(hometownEl, beforeEl);
      } else {
        container.appendChild(hometownEl);
      }
    }
    hometownEl.textContent = hometown;
  }

  function syncSharedPlayerCards(playerByName, seasonsByKey) {
    if (!playerByName || playerByName.size === 0) return;

    // Roster cards (main roster style)
    const rosterCards = document.querySelectorAll(
      '.roster-panel[data-roster="first-team"] .roster-card:not(.coaching-card)'
    );
    rosterCards.forEach((card) => {
      const first = card.querySelector(".roster-first-name");
      const last = card.querySelector(".roster-last-name");
      if (!first || !last) return;
      const fullName = `${first.textContent?.trim() || ""} ${last.textContent?.trim() || ""}`.trim();
      const player = playerByName.get(normalizeName(fullName));
      if (!player) return;

      const canonicalParts = player.name.split(" ");
      first.textContent = canonicalParts[0] || player.name;
      const lastName = canonicalParts.slice(1).join(" ") || canonicalParts[0];
      const showCaptain = isCaptainInContext(player.name);
      last.innerHTML = `${lastName}${showCaptain ? '<span class="captain-armband" aria-label="Captain" title="Captain"></span>' : ''}`;

      setCardAvatar(card.querySelector(".history-avatar"), player, player.name);

      if (player.roster) {
        const numberEl = card.querySelector(".roster-number");
        const positionEl = card.querySelector(".roster-position");
        const appsEl = card.querySelector(".roster-appearances");
        if (numberEl) numberEl.textContent = player.roster.number ? `#${String(player.roster.number).replace(/^#/, "")}` : "#TBD";
        if (positionEl) positionEl.textContent = player.roster.position || "N/A";
        if (appsEl) {
          appsEl.textContent = formatApps(getRosterApps(player), "All-Time ");
        }
      }

      const rosterMeta = card.querySelector(".roster-meta");
      upsertCardHometown(card, "roster-hometown", player.hometown, rosterMeta);
    });

    // History/records cards (sync name + avatar for the same player everywhere)
    const historyNameEls = document.querySelectorAll(".history-player .history-name");
    historyNameEls.forEach((nameEl) => {
      const nameText = nameEl.textContent?.trim() || "";
      const player = playerByName.get(normalizeName(nameText));
      if (!player) return;
      nameEl.textContent = player.name;
      const card = nameEl.closest(".history-player");
      const avatarEl = card?.querySelector(".history-avatar");
      setCardAvatar(avatarEl, player, player.name);

      const detailCol = nameEl.parentElement;
      const historySubtext = detailCol?.querySelector(".history-subtext");
      upsertCardHometown(detailCol, "history-hometown", player.hometown, historySubtext || null);
    });

    formatHistoryRosterCards(playerByName, seasonsByKey);
  }

  function formatHistoryRosterCards(playerByName, seasonsByKey) {
    const historyCards = document.querySelectorAll(
      '.history-panel[data-year="2025"] .history-roster .history-player:not(.coaching-card), .history-panel[data-year="2026"] .history-roster .history-player:not(.coaching-card)'
    );

    historyCards.forEach((card) => {
      const nameEl = card.querySelector(".history-name");
      const subtextEl = card.querySelector(".history-subtext");
      if (!nameEl || !subtextEl) return;

      const historyPanel = card.closest(".history-panel");
      const year = historyPanel?.getAttribute("data-year");
      const fullName = nameEl.textContent.trim();
      const nameParts = fullName.split(/\s+/).filter(Boolean);
      if (nameParts.length > 0) {
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" ") || nameParts[0];
        const showCaptain = isCaptainInContext(fullName, year);
        nameEl.innerHTML = `<span class="history-first-name">${firstName}</span><span class="history-last-name">${lastName}${showCaptain ? '<span class="captain-armband" aria-label="Captain" title="Captain"></span>' : ''}</span>`;
      }

      const normalizedName = normalizeName(fullName);
      const mappedPlayer = playerByName?.get(normalizedName);
      const existingNumberPill = subtextEl.querySelector(".history-number-pill");
      const existingPositionPill = subtextEl.querySelector(".history-position-pill");
      const existingAppsPill = subtextEl.querySelector(".history-apps-pill");
      let numberPart = "#TBD";
      let positionPart = "N/A";
      let appsValue;
      const seasonStats = getPlayerSeasonStats(mappedPlayer, year, seasonsByKey);
      if (seasonStats) {
        appsValue = seasonStats.appearances ?? 0;
      } else {
        appsValue = getRosterApps(mappedPlayer);
      }
      let appsPart = `${appsValue} Apps.`;

      if (existingNumberPill && existingPositionPill) {
        numberPart = existingNumberPill.textContent.trim() || numberPart;
        positionPart = existingPositionPill.textContent.trim() || positionPart;
        if (existingAppsPill) {
          appsPart = existingAppsPill.textContent.trim() || appsPart;
        }
      } else {
        const [numberPartRaw, positionPartRaw, appsPartRaw] = subtextEl.textContent.split("|");
        numberPart = (numberPartRaw || numberPart).trim();
        positionPart = (positionPartRaw || positionPart).trim();
        appsPart = (appsPartRaw || appsPart).trim();
      }

      subtextEl.innerHTML = `<span class="history-pill history-number-pill">${numberPart}</span><span class="history-pill history-position-pill">${positionPart}</span><span class="history-pill history-apps-pill">${appsPart}</span>`;
    });
  }

  function getRoleForContext(person, team, year) {
    if (!person?.roles) return null;
    return person.roles.find((role) => {
      const teamMatches = !team || role.team === team;
      const yearMatches = !year || String(role.season) === String(year);
      return teamMatches && yearMatches;
    }) || null;
  }

  function syncStaffCards(staffByName) {
    if (!staffByName || staffByName.size === 0) return;
    const cards = document.querySelectorAll(".roster-card.coaching-card");
    cards.forEach((card) => {
      const first = card.querySelector(".roster-first-name");
      const last = card.querySelector(".roster-last-name");
      if (!first || !last) return;
      const fullName = `${first.textContent?.trim() || ""} ${last.textContent?.trim() || ""}`.trim();
      const person = staffByName.get(normalizeName(fullName));
      if (!person) return;

      const panel = card.closest(".history-panel");
      const year = panel?.getAttribute("data-year") || "2026";
      const team = getPageTeam();
      const role = getRoleForContext(person, team, year) || getRoleForContext(person, null, year);
      if (!role) return;

      setCardAvatar(card.querySelector(".history-avatar"), person, person.name);
      first.textContent = person.name.split(" ")[0] || person.name;
      last.textContent = person.name.split(" ").slice(1).join(" ") || "";
      const positionEl = card.querySelector(".roster-position");
      if (positionEl) positionEl.textContent = role.title;
      const matchesEl = card.querySelector(".roster-coach-matches");
      if (matchesEl) {
        if (role.matchesCoached === null || role.matchesCoached === undefined) {
          matchesEl.remove();
        } else {
          matchesEl.textContent = `${role.matchesCoached} ${role.matchesCoached === 1 ? "Match" : "Matches"}`;
        }
      }
      upsertCardHometown(card, "roster-hometown", person.hometown, card.querySelector(".roster-meta"));
    });
  }

  function formatSignedNumber(value) {
    const number = Number(value) || 0;
    return number > 0 ? `+${number}` : String(number);
  }

  function renderLeagueStandings(standings) {
    const section = document.querySelector(".league-standings-section");
    if (!section || !Array.isArray(standings)) return;

    const cards = section.querySelectorAll(".league-standings-card");
    cards.forEach((card) => {
      const isWomen = card.querySelector("h3")?.textContent?.toLowerCase().includes("women");
      const team = isWomen ? "women" : "men";
      const table = standings.find((entry) => entry.team === team);
      if (!table) return;

      const leagueEl = card.querySelector(".league-standings-card-header span");
      if (leagueEl) leagueEl.textContent = table.league;
      const tbody = card.querySelector("tbody");
      if (!tbody) return;
      tbody.innerHTML = table.rows.map((row) => `
        <tr class="${row.highlight ? "firelands-row" : ""}">
          <td><span class="league-rank">${row.rank}</span>${row.team}</td>
          <td>${row.played}</td>
          <td>${row.points}</td>
          <td>${formatSignedNumber(row.goalDifference)}</td>
        </tr>
      `).join("");
    });
  }

  function formatRecord(record) {
    if (!record) return "N/A";
    return `${record.wins}W - ${record.draws}D - ${record.losses}L`;
  }

  function formatCupRecord(record) {
    if (!record) return "N/A";
    return `${record.wins}W - ${record.losses}L`;
  }

  function topLeaderText(season, statKey) {
    const entries = Object.entries(season.playerStats || {})
      .map(([playerId, stats]) => ({ playerId, value: stats[statKey] || 0 }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value);
    if (entries.length === 0) return "N/A";
    const topValue = entries[0].value;
    const names = entries
      .filter((entry) => entry.value === topValue)
      .map((entry) => clubDataCache.playerById.get(entry.playerId)?.name || entry.playerId);
    return `${names.join(" & ")} (${topValue})`;
  }

  function renderSummaryGrid(panel, season) {
    const grid = panel.querySelector(".summary-grid");
    if (!grid) return;
    const existingItems = new Map(
      Array.from(grid.querySelectorAll(".summary-item")).map((item) => [
        item.querySelector(".summary-item-label")?.textContent?.trim(),
        item.querySelector(".summary-item-value")?.textContent?.trim()
      ]).filter(([label]) => label)
    );
    const items = [
      ["League", season.league],
      ["Regular Season Record", formatRecord(season.record)],
      ...(season.cupRecord ? [["Cup Record", formatCupRecord(season.cupRecord)]] : []),
      ["Table Finish", season.tableFinish || `N/A (${season.record?.points ?? 0} points)`],
      ["Goals Scored", season.teamTotals?.goals ?? 0],
      ["Total Assists", season.teamTotals?.assists ?? 0],
      ["Clean Sheets", season.teamTotals?.cleanSheets ?? 0],
      ["Total Saves", season.teamTotals?.saves ?? 0],
      ["Yellow Cards", season.teamTotals?.yellowCards ?? 0],
      ["Red Cards", season.teamTotals?.redCards ?? 0],
      ["Top Goal Scorer", topLeaderText(season, "goals")],
      ["Top Assister", topLeaderText(season, "assists")],
      ["Top Saver", topLeaderText(season, "saves")],
      ["Most Clean Sheets", "N/A"]
    ];
    existingItems.forEach((value, label) => {
      if (!items.some(([itemLabel]) => itemLabel === label)) {
        items.push([label, value]);
      }
    });
    grid.innerHTML = items.map(([label, value]) => `
      <div class="summary-item"><span class="summary-item-label">${label}</span><span class="summary-item-value">${value}</span></div>
    `).join("");
  }

  function resultIcon(competition) {
    if (competition === "Cup") return '<span class="trophy-icon trophy-silver" aria-hidden="true"></span> ';
    if (competition === "Playoff") return '<span class="trophy-icon trophy-gold" aria-hidden="true"></span> ';
    return "";
  }

  function renderMatchResults(panel, team, season, matches) {
    const results = panel.querySelector(".season-mini-results-columns");
    if (!results) return;
    const seasonMatches = matches.filter((match) => match.team === team && Number(match.season) === Number(season));
    if (seasonMatches.length === 0) return;
    const midpoint = Math.ceil(seasonMatches.length / 2);
    const columns = [seasonMatches.slice(0, midpoint), seasonMatches.slice(midpoint)].filter((group) => group.length);
    results.innerHTML = columns.map((group) => `
      <ul>
        ${group.map((match) => {
          const text = `${resultIcon(match.competition)}${match.homeTeam} ${match.homeScore} - ${match.awayTeam} ${match.awayScore}`;
          return `<li>${match.videoUrl ? `<a href="${match.videoUrl}" target="_blank" rel="noopener noreferrer">${text}</a>` : text}</li>`;
        }).join("")}
        ${group === columns[columns.length - 1] ? '<li class="results-key"><span class="trophy-icon trophy-silver" aria-hidden="true"></span> Cup Match | <span class="trophy-icon trophy-gold" aria-hidden="true"></span> Playoff Match</li>' : ""}
      </ul>
    `).join("");
  }

  function renderBreakdown(panel, season) {
    const breakdown = panel.querySelector(".season-breakdown");
    if (!breakdown) return;
    const groups = [
      ["Goals", "goals"],
      ["Assists", "assists"],
      ["Saves", "saves"],
      ["Yellow Cards", "yellowCards"],
      ["Red Cards", "redCards"]
    ];
    breakdown.innerHTML = groups.map(([title, key]) => {
      const rows = Object.entries(season.playerStats || {})
        .map(([playerId, stats]) => ({ name: clubDataCache.playerById.get(playerId)?.name || playerId, value: stats[key] || 0 }))
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
      return `
        <div class="breakdown-column">
          <h3>${title}</h3>
          <ul>${rows.length ? rows.map((row) => `<li>${row.name}: ${row.value}</li>`).join("") : "<li>N/A</li>"}</ul>
        </div>
      `;
    }).join("");
  }

  function recordCardMarkup(player, subtext, valueText) {
    if (!player) {
      return `
        <article class="history-player">
          <div class="history-avatar">N/A</div>
          <div>
            <h3 class="history-name">No Record Yet</h3>
            <p class="history-subtext">${subtext}</p>
            <p class="history-meta-value">TBD</p>
          </div>
        </article>
      `;
    }
    return `
      <article class="history-player">
        ${avatarMarkup(player)}
        <div>
          <h3 class="history-name">${player.name}</h3>
          <p class="history-subtext">${subtext}</p>
          <p class="history-meta-value">${valueText}</p>
        </div>
      </article>
    `;
  }

  function statLabel(key) {
    return {
      appearances: "Matches",
      goals: "Goals",
      assists: "Assists",
      saves: "Saves",
      yellowCards: "Yellow Cards",
      redCards: "Red Cards"
    }[key] || key;
  }

  function topRows(rows, key) {
    const sorted = rows
      .filter((row) => (row[key] || 0) > 0)
      .sort((a, b) => (b[key] || 0) - (a[key] || 0) || a.player.name.localeCompare(b.player.name));
    if (sorted.length === 0) return [];
    const topValue = sorted[0][key] || 0;
    return sorted.filter((row) => (row[key] || 0) === topValue);
  }

  function setRecordSection(panel, title, rows) {
    const titleEl = Array.from(panel.querySelectorAll(".records-leader-title"))
      .find((el) => el.textContent.trim() === title);
    const roster = titleEl?.closest(".record-section")?.querySelector(".records-roster");
    if (!roster) return;
    roster.innerHTML = rows.join("");
  }

  function renderRecordPanels(seasons, players) {
    const team = getPageTeam();
    const panel = document.querySelector('.history-panel[data-year="records"]');
    if (!team || !panel) return;
    const teamSeasons = seasons.filter((season) => season.team === team);
    const teamLabel = team === "women" ? "Women's First Team" : "Men's First Team";

    const aggregate = new Map();
    teamSeasons.forEach((season) => {
      Object.entries(season.playerStats || {}).forEach(([playerId, stats]) => {
        const player = players.find((candidate) => candidate.id === playerId);
        if (!player) return;
        const row = aggregate.get(playerId) || { player };
        ["appearances", "goals", "assists", "saves", "yellowCards", "redCards"].forEach((key) => {
          row[key] = (row[key] || 0) + (stats[key] || 0);
        });
        aggregate.set(playerId, row);
      });
    });
    const allTimeRows = Array.from(aggregate.values());
    const allTimeSections = [
      ["Club Leading Goal Scorer", "goals"],
      ["Club Leading Assister", "assists"],
      ["Club Leader in Saves", "saves"],
      ["Club Leader in Yellow Cards", "yellowCards"],
      ["Club Leader in Matches Played", "appearances"]
    ];
    allTimeSections.forEach(([title, key]) => {
      const rows = topRows(allTimeRows, key);
      setRecordSection(
        panel,
        title,
        rows.length
          ? rows.map((row) => recordCardMarkup(row.player, teamLabel, `${row[key]} ${statLabel(key)}`))
          : [recordCardMarkup(null, teamLabel)]
      );
    });

    const seasonRows = [];
    teamSeasons.forEach((season) => {
      Object.entries(season.playerStats || {}).forEach(([playerId, stats]) => {
        const player = players.find((candidate) => candidate.id === playerId);
        if (!player) return;
        seasonRows.push({ player, season: season.season, ...stats });
      });
    });
    const singleSeasonSections = [
      ["Single Season Goal Record", "goals"],
      ["Single Season Assist Record", "assists"],
      ["Single Season Save Record", "saves"],
      ["Single Season Yellow Card Record", "yellowCards"],
      ["Single Season Red Card Record", "redCards"]
    ];
    singleSeasonSections.forEach(([title, key]) => {
      const rows = topRows(seasonRows, key);
      setRecordSection(
        panel,
        title,
        rows.length
          ? rows.map((row) => recordCardMarkup(row.player, `${row.season} Season`, `${row[key]} ${statLabel(key)}`))
          : [recordCardMarkup(null, `${teamSeasons[0]?.season || "Current"} Season`)]
      );
    });
  }

  function renderCurrentSeasonRoster(panel, season, players, staff) {
    if (String(season.season) !== "2026") return;
    const existingRosterGroups = Array.from(panel.querySelectorAll(".roster-group"));
    const firstRosterGroup = existingRosterGroups.find((group) => group.querySelector(".coaching-row, .history-roster"));
    if (!firstRosterGroup) return;
    existingRosterGroups.forEach((group) => group.remove());

    const currentRoles = staff
      .map((person) => ({ person, role: getRoleForContext(person, season.team, season.season) }))
      .filter((entry) => entry.role);
    const playerRows = Object.entries(season.playerStats || {})
      .map(([playerId, stats]) => ({ player: players.find((candidate) => candidate.id === playerId), stats }))
      .filter((entry) => entry.player);
    const groupOrder = ["Goalkeepers", "Defenders", "Midfielders", "Attackers"];
    const grouped = new Map(groupOrder.map((group) => [group, []]));
    playerRows.forEach((entry) => {
      grouped.get(positionGroup(entry.player.roster?.position)).push(entry);
    });

    const rosterMarkup = `
      <div class="roster-group">
        <h3 class="roster-group-title">Coaches</h3>
        <div class="coaching-row">${currentRoles.map(({ person, role }) => coachCardMarkup(person, role)).join("")}</div>
      </div>
      ${groupOrder.map((group) => `
        <div class="roster-group">
          <h3 class="roster-group-title">${group}</h3>
          <div class="history-roster">${grouped.get(group).map(({ player, stats }) => historyPlayerMarkup(player, stats, season.season)).join("")}</div>
        </div>
      `).join("")}
    `;
    const breakdown = panel.querySelector(".season-breakdown");
    if (breakdown) {
      breakdown.insertAdjacentHTML("afterend", rosterMarkup);
    } else {
      panel.insertAdjacentHTML("beforeend", rosterMarkup);
    }
  }

  function renderSeasonPanels(seasons, matches, players, staff) {
    const team = getPageTeam();
    if (!team) return;
    document.querySelectorAll(".history-panel[data-year]").forEach((panel) => {
      const year = panel.getAttribute("data-year");
      if (!/^\d{4}$/.test(year)) return;
      const season = seasons.find((entry) => entry.team === team && String(entry.season) === year);
      if (!season) return;
      renderSummaryGrid(panel, season);
      renderMatchResults(panel, team, season.season, matches);
      renderBreakdown(panel, season);
      renderCurrentSeasonRoster(panel, season, players, staff);
    });
  }

  const clubDataCache = {
    playerById: new Map()
  };

  async function loadClubData() {
    const [playersResponse, staffResponse, seasonResponse, matchesResponse, standingsResponse] = await Promise.all([
      fetch("/data/players.json", { cache: "no-store" }),
      fetch("/data/staff.json", { cache: "no-store" }),
      fetch("/data/season-stats.json", { cache: "no-store" }),
      fetch("/data/matches.json", { cache: "no-store" }),
      fetch("/data/standings.json", { cache: "no-store" })
    ]);

    for (const response of [playersResponse, staffResponse, seasonResponse, matchesResponse, standingsResponse]) {
      if (!response.ok) throw new Error(`Failed to load club data (${response.url}: ${response.status})`);
    }

    const [playersData, staffData, seasonData, matchesData, standingsData] = await Promise.all([
      playersResponse.json(),
      staffResponse.json(),
      seasonResponse.json(),
      matchesResponse.json(),
      standingsResponse.json()
    ]);

    const players = playersData.players || [];
    clubDataCache.playerById = new Map([
      ...players.map((player) => [player.id, player]),
      ...(staffData.staff || []).map((person) => [person.id, person])
    ]);
    return {
      players,
      staff: staffData.staff || [],
      seasons: seasonData.seasons || [],
      matches: matchesData.matches || [],
      standings: standingsData.standings || []
    };
  }

  function loadAndSyncClubData() {
    loadClubData()
      .then((data) => {
        const playerByName = buildPlayerMap(data.players);
        const staffByName = buildStaffMap(data.staff);
        const seasonsByKey = buildSeasonStatsMap(data.seasons);
        renderRosterPages(data.players, data.staff);
        syncSharedPlayerCards(playerByName, seasonsByKey);
        syncStaffCards(staffByName);
        renderLeagueStandings(data.standings);
        renderSeasonPanels(data.seasons, data.matches, data.players, data.staff);
        renderRecordPanels(data.seasons, data.players);
      })
      .catch((err) => {
        console.error("Error loading club data:", err);
      });
  }

  loadAndSyncClubData();

  function formatBlogDate(value) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

  function formatSocialDate(value) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  // ----- Load blog data from blogs.json -----
  let blogPosts = [];

  fetch(`/blogs.json?v=${Date.now()}`, { cache: "no-store" })
    .then((r) => r.json())
    .then((data) => {
      blogPosts = data;

      // Initialize hero rotation if on the home page
      if (heroContent && heroTitle && heroSubtitle && heroButton) {
        updateHeroContent();
        setInterval(() => fadeOutAndUpdate(), 8000);
      }

      // Initialize blog list if on the news page
      if (blogList && searchInput && categoryFilter) {
        renderBlogs(blogPosts);
      }

      // Initialize related posts if on a blog post page
      if (relatedPostsGrid) {
        renderRelatedPosts(blogPosts);
      }

      // Initialize latest news on the homepage
      if (latestNewsGrid) {
        renderLatestNews(blogPosts);
      }
    })
    .catch((err) => console.error("Error loading blog data:", err));

  // ----- Hero rotation -----
  const heroContent = document.getElementById("hero-content");
  const heroTitle = document.getElementById("hero-title");
  const heroSubtitle = document.getElementById("hero-subtitle");
  const heroButton = document.getElementById("hero-button");
  let currentIndex = 0;

  function fadeOutAndUpdate() {
    if (!heroContent) return;
    heroContent.classList.add("fade-out");
    setTimeout(() => {
      updateHeroContent();
      heroContent.classList.remove("fade-out");
      heroContent.classList.add("fade-in");
      setTimeout(() => heroContent.classList.remove("fade-in"), 1000);
    }, 1000);
  }

  function updateHeroContent() {
    if (blogPosts.length === 0 || !heroTitle || !heroSubtitle || !heroButton)
      return;
    const post = blogPosts[currentIndex];
    heroTitle.textContent = post.title;
    heroSubtitle.textContent = post.excerpt;
    heroButton.href = post.link;
    currentIndex = (currentIndex + 1) % blogPosts.length;
  }

  // ----- Global ticker (all pages, synced position) -----
  const TICKER_DURATION_MS = 28000;
  const DEFAULT_TICKER_ITEMS = [
    "Firelands United launches women's first team for 2026 season",
    "Firelands United launches women's first team for 2026 season"
  ];

  let ticker = document.querySelector(".news-ticker");
  const navbar = document.querySelector(".navbar");

  if (!ticker && navbar) {
    ticker = document.createElement("section");
    ticker.className = "news-ticker";
    ticker.innerHTML = '<div class="news-ticker-track"></div>';
    navbar.insertAdjacentElement("afterend", ticker);
  }

  if (ticker) {
    const tickerTrack = ticker.querySelector(".news-ticker-track");
    if (tickerTrack) {
      const itemA = ticker.getAttribute("data-ticker-text");
      const itemB = ticker.getAttribute("data-ticker-text-2");
      const messages = [itemA, itemB].filter(Boolean);
      const activeMessages = messages.length > 0 ? messages : DEFAULT_TICKER_ITEMS;
      const baseItems = [];

      // Keep the ticker train long enough on every page (including pages with only one headline set).
      while (baseItems.length < 4) {
        const nextItem = activeMessages[baseItems.length % activeMessages.length];
        baseItems.push(nextItem);
      }

      tickerTrack.innerHTML = "";
      baseItems.forEach((msg, idx) => {
        const item = document.createElement("span");
        item.className = "news-ticker-item";
        if (idx > 0) item.setAttribute("aria-hidden", "true");
        item.textContent = msg;
        tickerTrack.appendChild(item);
      });

      const originals = Array.from(tickerTrack.querySelectorAll(".news-ticker-item"));
      originals.forEach((item) => {
        const clone = item.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        tickerTrack.appendChild(clone);
      });

      // Keep the ticker at a global position across page navigations.
      const offsetMs = Date.now() % TICKER_DURATION_MS;
      tickerTrack.style.animationDelay = `-${offsetMs}ms`;
    }
  }

  // ----- Hamburger menu -----
  const hamburger = document.getElementById("hamburger-menu");
  const navLinks = document.getElementById("nav-links");
  const navDropdowns = document.querySelectorAll(".nav-dropdown");
  const navDropdownToggles = document.querySelectorAll(".nav-dropdown-toggle");

  if (hamburger && navLinks) {
    hamburger.addEventListener("click", (e) => {
      e.stopPropagation();
      navLinks.classList.toggle("show");
      hamburger.classList.toggle("active");
      if (!navLinks.classList.contains("show")) {
        navDropdowns.forEach((dropdown) => dropdown.classList.remove("open"));
      }
      document.body.style.overflow = navLinks.classList.contains("show")
        ? "hidden"
        : "";
    });

    document.addEventListener("click", (e) => {
      if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove("show");
        hamburger.classList.remove("active");
        navDropdowns.forEach((dropdown) => dropdown.classList.remove("open"));
        document.body.style.overflow = "";
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 768) {
        navLinks.classList.remove("show");
        hamburger.classList.remove("active");
        navDropdowns.forEach((dropdown) => dropdown.classList.remove("open"));
        document.body.style.overflow = "";
      }
    });
  }

  if (navDropdownToggles.length > 0) {
    navDropdownToggles.forEach((toggle) => {
      toggle.addEventListener("click", (e) => {
        if (window.innerWidth > 768) return;
        const parentDropdown = toggle.closest(".nav-dropdown");
        if (!parentDropdown) return;

        const href = toggle.getAttribute("href");
        const alreadyOpen = parentDropdown.classList.contains("open");
        if (alreadyOpen && href) {
          return;
        }

        e.preventDefault();
        navDropdowns.forEach((dropdown) => {
          if (dropdown !== parentDropdown) dropdown.classList.remove("open");
        });
        parentDropdown.classList.toggle("open");
      });
    });
  }

  // ----- Men's history year tabs -----
  const yearTabs = document.querySelectorAll(".year-tab");
  const yearPanels = document.querySelectorAll(".history-panel");

  if (yearTabs.length > 0 && yearPanels.length > 0) {
    yearTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetYear = tab.getAttribute("data-year");
        if (!targetYear) return;

        yearTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        yearPanels.forEach((panel) => {
          const isMatch = panel.getAttribute("data-year") === targetYear;
          panel.classList.toggle("active", isMatch);
        });
      });
    });
  }

  // ----- Roster page tabs -----
  const rosterTabs = document.querySelectorAll(".roster-tab");
  const rosterPanels = document.querySelectorAll(".roster-panel");

  if (rosterTabs.length > 0 && rosterPanels.length > 0) {
    rosterTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetRoster = tab.getAttribute("data-roster");
        if (!targetRoster) return;

        rosterTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        rosterPanels.forEach((panel) => {
          const isMatch = panel.getAttribute("data-roster") === targetRoster;
          panel.classList.toggle("active", isMatch);
        });
      });
    });
  }

  // ----- Internship page tabs -----
  const internshipTabs = document.querySelectorAll(".internship-tab");
  const internshipPanels = document.querySelectorAll(".internship-panel");

  if (internshipTabs.length > 0 && internshipPanels.length > 0) {
    internshipTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetInternship = tab.getAttribute("data-internship-target");
        if (!targetInternship) return;

        internshipTabs.forEach((t) => {
          const isActive = t === tab;
          t.classList.toggle("active", isActive);
          t.setAttribute("aria-pressed", isActive ? "true" : "false");
        });

        internshipPanels.forEach((panel) => {
          const isMatch = panel.getAttribute("data-internship-panel") === targetInternship;
          panel.classList.toggle("active", isMatch);
          panel.hidden = !isMatch;
        });
      });
    });
  }

  // ----- Internship application forms -----
  const internshipForms = document.querySelectorAll(".internship-application-form");
  const contactRelayUrl = "https://firelandsunited-contact.chwalik.workers.dev";

  if (internshipForms.length > 0) {
    internshipForms.forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();

        const role = (form.getAttribute("data-internship-role") || "").trim();
        const name = (form.querySelector('input[name="name"]')?.value || "").trim();
        const email = (form.querySelector('input[name="email"]')?.value || "").trim();
        const phone = (form.querySelector('input[name="phone"]')?.value || "").trim();
        const school = (form.querySelector('input[name="school"]')?.value || "").trim();
        const interest = (form.querySelector('textarea[name="interest"]')?.value || "").replace(/\n+/g, " ").trim();
        const resumeInput = form.querySelector('input[name="resume"]');
        const resumeFile = resumeInput?.files?.[0];
        const timestamp = new Date().toLocaleString("en-US", { hour12: true });

        const successMessage = form.parentElement?.querySelectorAll(".internship-application-status")[0];
        const errorMessage = form.parentElement?.querySelectorAll(".internship-application-status")[1];
        const submitButton = form.querySelector(".submit-button");

        if (successMessage) successMessage.hidden = true;
        if (errorMessage) errorMessage.hidden = true;

        if (!role || !name || !email || !interest || !resumeFile) return;

        const isPdf =
          resumeFile.type === "application/pdf" ||
          (resumeFile.name || "").toLowerCase().endsWith(".pdf");
        const maxResumeSize = 8 * 1024 * 1024;

        if (!isPdf || resumeFile.size > maxResumeSize) {
          if (errorMessage) {
            errorMessage.textContent = !isPdf
              ? "Please upload your resume as a PDF."
              : "Resume file is too large. Please keep it under 8MB.";
            errorMessage.hidden = false;
          }
          return;
        }

        const payload = new FormData();
        payload.append("formType", "internship-application");
        payload.append("role", role);
        payload.append("name", name);
        payload.append("email", email);
        payload.append("phone", phone);
        payload.append("school", school);
        payload.append("interest", interest);
        payload.append("timestamp", timestamp);
        payload.append("resume", resumeFile);

        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = "Sending...";
        }

        fetch(contactRelayUrl, {
          method: "POST",
          body: payload
        })
          .then((response) => {
            if (!response.ok) throw new Error("Internship application request failed.");
            form.reset();
            if (successMessage) successMessage.hidden = false;
          })
          .catch(() => {
            if (errorMessage) {
              errorMessage.textContent = "Could not send your application. Please try again in a moment.";
              errorMessage.hidden = false;
            }
          })
          .finally(() => {
            if (submitButton) {
              submitButton.disabled = false;
              submitButton.textContent = "Submit Application";
            }
          });
      });
    });
  }

  // ----- Blog list/search (news page) -----
  const blogList = document.getElementById("blog-list");
  const searchInput = document.getElementById("search-input");
  const categoryFilter = document.getElementById("category-filter");

  function renderBlogs(items) {
    blogList.innerHTML = "";
    if (items.length === 0) {
      blogList.innerHTML = '<p class="no-results">No posts found.</p>';
      return;
    }
    items.forEach((blog) => {
      const card = document.createElement("a");
      card.classList.add("blog-card");
      card.href = blog.link;
      const imgSrc = blog.image || "/img/blogs/default.jpg";
      const category = blog.category || "Club News";
      const publishDate = formatBlogDate(blog.date);
      card.innerHTML = `
        <div class="blog-card-image">
          <img src="${imgSrc}" alt="${blog.title}">
        </div>
        <div class="blog-card-body">
          <div class="blog-card-meta">
            <span class="blog-card-category">${category}</span>
            <span class="blog-card-date">${publishDate}</span>
          </div>
          <h3 class="blog-card-title">${blog.title}</h3>
          <p class="blog-card-excerpt">${blog.excerpt}</p>
        </div>`;
      blogList.appendChild(card);
    });
  }

  function filterBlogs() {
    const searchText = searchInput.value.toLowerCase();
    const selected = categoryFilter.value;
    const filtered = blogPosts.filter((b) => {
      const matchesSearch = b.title.toLowerCase().includes(searchText);
      const matchesCat =
        selected === "all" || (b.category || "").toLowerCase() === selected;
      return matchesSearch && matchesCat;
    });
    renderBlogs(filtered);
  }

  if (searchInput && categoryFilter) {
    searchInput.addEventListener("input", filterBlogs);
    categoryFilter.addEventListener("change", filterBlogs);
  }

  // ----- Related posts (blog post pages) -----
  const relatedPostsGrid = document.getElementById("related-posts-grid");

  function renderRelatedPosts(allPosts) {
    if (!relatedPostsGrid || allPosts.length === 0) return;

    // Get the current page path
    const currentPath = window.location.pathname;

    // Filter out the current post and pick up to 3 others
    const otherPosts = allPosts.filter(
      (p) =>
        p.link !== currentPath &&
        p.link !== currentPath.replace(/\/$/, "") &&
        p.link + "/" !== currentPath
    );

    // Show up to 3 related posts (newest first, already sorted from blogs.json)
    const postsToShow = otherPosts.slice(0, 3);

    if (postsToShow.length === 0) {
      relatedPostsGrid.closest(".related-posts").style.display = "none";
      return;
    }

    relatedPostsGrid.innerHTML = "";
    postsToShow.forEach((post) => {
      const card = document.createElement("a");
      card.classList.add("related-card");
      card.href = post.link;
      const imgSrc = post.image || "/img/blogs/default.jpg";
      const category = post.category || "Club News";
      const publishDate = formatBlogDate(post.date);
      card.innerHTML = `
        <div class="related-card-image">
          <img src="${imgSrc}" alt="${post.title}">
        </div>
        <div class="related-card-body">
          <div class="related-card-meta">
            <span class="related-card-category">${category}</span>
            <span class="related-card-date">${publishDate}</span>
          </div>
          <h3 class="related-card-title">${post.title}</h3>
          <p class="related-card-excerpt">${post.excerpt}</p>
        </div>`;
      relatedPostsGrid.appendChild(card);
    });
  }

  // ----- Latest news (homepage) -----
  const latestNewsGrid = document.getElementById("latest-news-grid");
  const latestNewsScroll = latestNewsGrid
    ? latestNewsGrid.closest(".latest-news-scroll")
    : null;

  function renderLatestNews(allPosts) {
    if (!latestNewsGrid || allPosts.length === 0) return;

    // Show a wider set for horizontal scrolling on the homepage.
    const postsToShow = allPosts.slice(0, 12);

    latestNewsGrid.innerHTML = "";
    postsToShow.forEach((post) => {
      const card = document.createElement("a");
      card.classList.add("latest-news-card");
      card.href = post.link;
      const imgSrc = post.image || "/img/blogs/default.jpg";
      const category = post.category || "Club News";
      const publishDate = formatBlogDate(post.date);
      card.innerHTML = `
        <div class="latest-news-card-image">
          <img src="${imgSrc}" alt="${post.title}">
        </div>
        <div class="latest-news-card-body">
          <div class="latest-news-card-meta">
            <span class="latest-news-card-category">${category}</span>
            <span class="latest-news-card-date">${publishDate}</span>
          </div>
          <h3 class="latest-news-card-title">${post.title}</h3>
          <p class="latest-news-card-excerpt">${post.excerpt}</p>
        </div>`;
      latestNewsGrid.appendChild(card);
    });

    updateLatestNewsHint();
  }

  function updateLatestNewsHint() {
    if (!latestNewsGrid || !latestNewsScroll) return;

    const maxScrollLeft = latestNewsGrid.scrollWidth - latestNewsGrid.clientWidth;
    const noOverflow = maxScrollLeft <= 4;
    const atEnd = latestNewsGrid.scrollLeft >= maxScrollLeft - 4;

    latestNewsScroll.classList.toggle("no-overflow", noOverflow);
    latestNewsScroll.classList.toggle("at-end", atEnd);
  }

  if (latestNewsGrid && latestNewsScroll) {
    latestNewsGrid.addEventListener("scroll", updateLatestNewsHint, { passive: true });
    window.addEventListener("resize", updateLatestNewsHint);
  }

  // ----- Merch slider (homepage) -----
  const SHOPIFY_BASE_URL = 'https://firelandsunited.myshopify.com';
  const SHOPIFY_CDN = 'https://firelandsunited.myshopify.com/cdn/shop/files';

  const merchProducts = [
    {
      name: 'Firelands United Inaugural 2025 Home Jersey',
      price: '$40.00',
      slug: 'firelands-united-2025-home-jersey',
      image: `${SHOPIFY_CDN}/Photoroom_20260122_165116.png?v=1769176652`
    },
    {
      name: 'Firelands United Inaugural 2025 Away Jersey',
      price: '$40.00',
      slug: 'firelands-united-2025-away-jersey',
      image: `${SHOPIFY_CDN}/Photoroom_20260122_164816.png?v=1769176668`
    },
    {
      name: 'Firelands United 2025 Keeper Jersey',
      price: '$40.00',
      slug: 'firelands-united-2025-keeper-jersey',
      image: `${SHOPIFY_CDN}/Photoroom_20260122_164603.png?v=1769176923`
    },
    {
      name: 'Firelands United Official Training Top',
      price: '$20.00',
      slug: 'firelands-united-official-training-top',
      image: `${SHOPIFY_CDN}/Photoroom_20260120_155602.png?v=1769111034`
    },
    {
      name: '"Up the Lands" Sweatshirt',
      price: '$30.00',
      slug: 'up-the-lands-sweatshirt',
      image: `${SHOPIFY_CDN}/Photoroom_20260120_154737.png?v=1769111153`
    },
    {
      name: '"Up the Lands" Zipper Hoodie',
      price: '$30.00',
      slug: 'up-the-lands-zipper-hoodie',
      image: `${SHOPIFY_CDN}/2_6a919dc5-f053-4d26-a9d0-4911b128c568.png?v=1769115505`
    },
    {
      name: 'Firelands United Badge Sweatshirt',
      price: '$30.00',
      slug: 'firelands-united-badge-sweatshirt',
      image: `${SHOPIFY_CDN}/Photoroom_20260120_155044.png?v=1769111402`
    },
    {
      name: 'Firelands United Badge Orange & White Sweatshirt',
      price: '$30.00',
      slug: 'firelands-united-badge-orange-white-sweatshirt',
      image: `${SHOPIFY_CDN}/1_1fb98661-5832-438a-bdd6-20402c7faa7f.png?v=1769114427`
    },
    {
      name: 'Long Sleeve Firelands United Pullover',
      price: '$35.00',
      slug: 'long-sleeve-firelands-united-pullover',
      image: `${SHOPIFY_CDN}/Photoroom_20260122_152158.png?v=1769114809`
    },
    {
      name: '"Up the Lands" Crewneck - Blemished Collection',
      price: '$15.00',
      slug: 'up-the-lands-crewneck-blemished-collection',
      image: `${SHOPIFY_CDN}/Photoroom_20260122_152415.png?v=1769115136`
    },
    {
      name: 'FUFC Hoodie - Blemished Collection',
      price: '$15.00',
      slug: 'fufc-hoodie-blemished-collection',
      image: `${SHOPIFY_CDN}/Photoroom_20260122_152607.png?v=1769116449`
    },
    {
      name: 'Silky "Up the Lands" Hoodie - Blemished Collection',
      price: '$15.00',
      slug: 'silky-up-the-lands-hoodie-blemished-collection',
      image: `${SHOPIFY_CDN}/Photoroom_20260122_152513.png?v=1769115886`
    },
    {
      name: 'Youth Firelands United T-Shirt',
      price: '$13.00',
      slug: 'youth-firelands-united-t-shirt',
      image: `${SHOPIFY_CDN}/Photoroom_20260122_163016.png?v=1769177174`
    }
  ];

  const merchTrack = document.getElementById('merch-track');
  const merchDotsContainer = document.getElementById('merch-dots');
  const merchTrackWrapper = merchTrack
    ? merchTrack.closest('.merch-track-wrapper')
    : null;

  if (merchTrack && merchDotsContainer && merchTrackWrapper) {
    let merchIndex = 0;
    let cardsPerView = window.innerWidth <= 768 ? 1 : 3;
    const merchGap = 24;

    // Render product cards
    function renderMerchCards() {
      merchTrack.innerHTML = '';
      merchProducts.forEach((product) => {
        const card = document.createElement('a');
        card.classList.add('merch-card');
        card.href = `${SHOPIFY_BASE_URL}/products/${product.slug}`;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.innerHTML = `
          <div class="merch-card-image">
            <img src="${product.image}&width=600" alt="${product.name}">
          </div>
          <div class="merch-card-body">
            <div class="merch-card-name">${product.name}</div>
            <div class="merch-card-price">${product.price}</div>
          </div>`;
        merchTrack.appendChild(card);
      });
    }

    // Total number of slide positions (page-step)
    function getMaxIndex() {
      return Math.ceil(merchProducts.length / cardsPerView) - 1;
    }

    function setMerchCardWidths() {
      const wrapperWidth = merchTrackWrapper.clientWidth;
      const cardWidth =
        (wrapperWidth - merchGap * (cardsPerView - 1)) / cardsPerView;
      const cards = merchTrack.querySelectorAll('.merch-card');
      cards.forEach((card) => {
        card.style.flex = `0 0 ${cardWidth}px`;
      });
    }

    // Render dot indicators
    function renderMerchDots() {
      merchDotsContainer.innerHTML = '';
      const totalDots = getMaxIndex() + 1;
      for (let i = 0; i < totalDots; i++) {
        const dot = document.createElement('button');
        dot.classList.add('merch-dot');
        dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
        if (i === merchIndex) dot.classList.add('active');
        dot.addEventListener('click', () => {
          scrollMerchToIndex(i);
        });
        merchDotsContainer.appendChild(dot);
      }
    }

    // Update slider controls and dot state based on native scroll position
    function updateMerchSlider() {
      const maxIndex = getMaxIndex();
      merchIndex = Math.round(merchTrackWrapper.scrollLeft / merchTrackWrapper.clientWidth);
      merchIndex = Math.max(0, Math.min(merchIndex, maxIndex));

      // Update arrow states
      const leftArrow = document.querySelector('.merch-arrow-left');
      const rightArrow = document.querySelector('.merch-arrow-right');
      if (leftArrow) leftArrow.disabled = merchIndex === 0;
      if (rightArrow) rightArrow.disabled = merchIndex >= maxIndex;

      // Update dots
      const dots = merchDotsContainer.querySelectorAll('.merch-dot');
      dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === merchIndex);
      });
    }

    function scrollMerchToIndex(index) {
      const clampedIndex = Math.max(0, Math.min(index, getMaxIndex()));
      merchTrackWrapper.scrollTo({
        left: clampedIndex * merchTrackWrapper.clientWidth,
        behavior: 'smooth'
      });
    }

    // Arrow event listeners
    const merchLeftArrow = document.querySelector('.merch-arrow-left');
    const merchRightArrow = document.querySelector('.merch-arrow-right');

    if (merchLeftArrow) {
      merchLeftArrow.addEventListener('click', () => {
        scrollMerchToIndex(merchIndex - 1);
      });
    }

    if (merchRightArrow) {
      merchRightArrow.addEventListener('click', () => {
        scrollMerchToIndex(merchIndex + 1);
      });
    }

    merchTrackWrapper.addEventListener('scroll', updateMerchSlider, { passive: true });

    // Handle window resize
    window.addEventListener('resize', () => {
      const newCardsPerView = window.innerWidth <= 768 ? 1 : 3;
      if (newCardsPerView !== cardsPerView) {
        cardsPerView = newCardsPerView;
      }
      setMerchCardWidths();
      renderMerchDots();
      scrollMerchToIndex(0);
      updateMerchSlider();
    });

    // Initialize
    renderMerchCards();
    setMerchCardWidths();
    renderMerchDots();
    updateMerchSlider();
  }

  // ----- Reusable Instagram feed renderer -----
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderInstagramCards(container, posts, profile) {
    if (!Array.isArray(posts) || posts.length === 0) {
      container.innerHTML = '<p class="instagram-feed-empty">No recent posts yet.</p>';
      return;
    }

    const profileImage = profile?.profile_picture_url || "/img/firelands-badge.png";
    const username = profile?.username || "firelandsunited";

    container.innerHTML = posts.map((post) => {
      const imageUrl = post.image_url || "";
      const caption = escapeHtml(post.caption || "View this post on Instagram");
      const permalink = post.permalink || "https://www.instagram.com/firelandsunited/";
      const timestamp = formatSocialDate(post.timestamp);

      return `
        <a class="instagram-card" href="${permalink}" target="_blank" rel="noopener noreferrer">
          <div class="instagram-card-top">
            <span class="instagram-card-dot" aria-hidden="true"><img src="${profileImage}" alt="${username} profile photo" loading="lazy"></span>
            <span class="instagram-card-handle">${username}</span>
          </div>
          <div class="instagram-card-media">
            <img src="${imageUrl}" alt="${caption}" loading="lazy">
          </div>
          <div class="instagram-card-body">
            <div class="instagram-card-actions" aria-hidden="true">♡ ○ ⤴</div>
            <p class="instagram-card-caption">${caption}</p>
            <span class="instagram-card-date">${timestamp}</span>
          </div>
        </a>`;
    }).join("");
  }

  function renderContactSocialInstagram(container, data) {
    renderInstagramCards(container, data.posts || [], data.profile || {});
  }

  function normalizeBeholdInstagramData(data) {
    const posts = Array.isArray(data?.posts) ? data.posts : [];
    const latest = posts[0];
    if (!latest) {
      return {
        posts: [],
        profile: {
          username: data?.username || "firelandsunited",
          profile_picture_url: data?.profilePictureUrl || "/img/firelands-badge.png"
        }
      };
    }

    const fallbackSizedImage =
      latest?.sizes?.large?.mediaUrl
      || latest?.sizes?.medium?.mediaUrl
      || latest?.sizes?.full?.mediaUrl
      || latest?.sizes?.small?.mediaUrl
      || "";

    const imageUrl =
      latest.thumbnailUrl
      || (latest.mediaType === "VIDEO" || latest.isReel ? fallbackSizedImage : "")
      || latest.mediaUrl
      || fallbackSizedImage;

    return {
      posts: [
        {
          id: latest.id,
          caption: latest.prunedCaption || latest.caption || "View this post on Instagram",
          permalink: latest.permalink || "https://www.instagram.com/firelandsunited/",
          media_type: latest.mediaType || (latest.isReel ? "VIDEO" : "IMAGE"),
          image_url: imageUrl,
          timestamp: latest.timestamp || ""
        }
      ],
      profile: {
        username: data?.username || "firelandsunited",
        profile_picture_url: data?.profilePictureUrl || "/img/firelands-badge.png"
      }
    };
  }

  function normalizeRssAppInstagramData(data) {
    const items = Array.isArray(data?.items) ? data.items : [];
    const latest = items[0];
    if (!latest) {
      return {
        posts: [],
        profile: {
          username: data?.title?.includes("@")
            ? data.title.split("@").pop().trim().split(/\s+/)[0]
            : "firelandsunited",
          profile_picture_url: "/img/firelands-badge.png"
        }
      };
    }

    const fallbackImage =
      latest?.enclosure?.link
      || latest?.thumbnail
      || latest?.image
      || "";

    return {
      posts: [
        {
          id: latest.id || latest.guid || latest.link || "instagram-latest",
          caption: latest.description || latest.title || "View this post on Instagram",
          permalink: latest.url || latest.link || "https://www.instagram.com/firelandsunited/",
          media_type: "IMAGE",
          image_url: fallbackImage,
          timestamp: latest.date_published || latest.published || latest.pubDate || ""
        }
      ],
      profile: {
        username: "firelandsunited",
        profile_picture_url: "/img/firelands-badge.png"
      }
    };
  }

  function renderContactSocialYoutube(container, video) {
    if (!video || !video.url) {
      container.innerHTML = '<p class="instagram-feed-empty">Could not load the latest YouTube video right now.</p>';
      return;
    }

    const title = escapeHtml(video.title || "Watch on YouTube");
    const thumb = video.thumbnail || "/img/social-share.jpg";
    const published = formatSocialDate(video.published_at);

    container.innerHTML = `
      <a class="contact-social-link-card" href="${video.url}" target="_blank" rel="noopener noreferrer">
        <div class="contact-social-link-media">
          <img src="${thumb}" alt="${title}" loading="lazy">
        </div>
        <div class="contact-social-link-body">
          <span class="contact-social-link-kicker">Latest Video</span>
          <h3>${title}</h3>
          ${published ? `<span class="contact-social-link-date">${published}</span>` : ""}
        </div>
      </a>`;
  }

  function renderContactSocialBluesky(container, post) {
    if (!post || !post.url) {
      container.innerHTML = '<p class="instagram-feed-empty">Could not load the latest Bluesky post right now.</p>';
      return;
    }

    const text = escapeHtml(post.text || "View the latest post on Bluesky.");
    const published = formatSocialDate(post.posted_at);
    const displayName = escapeHtml(post.display_name || "Andrew Chwalik");
    const handle = escapeHtml(post.handle || "andrewchwalik.bsky.social");
    const avatar = post.avatar || "/img/firelands-badge.png";

    container.innerHTML = `
      <a class="contact-social-link-card contact-social-link-card--bluesky" href="${post.url}" target="_blank" rel="noopener noreferrer">
        <div class="contact-social-link-top">
          <span class="contact-social-link-avatar"><img src="${avatar}" alt="${displayName} avatar" loading="lazy"></span>
          <span class="contact-social-link-profile">
            <strong>${displayName}</strong>
            <span>@${handle}</span>
          </span>
        </div>
        <div class="contact-social-link-body">
          <span class="contact-social-link-kicker">Latest Post</span>
          <p>${text}</p>
          ${published ? `<span class="contact-social-link-date">${published}</span>` : ""}
        </div>
      </a>`;
  }

  function initContactSocialFeeds() {
    const instagramContainer = document.querySelector('[data-contact-social-card="instagram"]');
    const youtubeContainer = document.querySelector('[data-contact-social-card="youtube"]');
    const blueskyContainer = document.querySelector('[data-contact-social-card="bluesky"]');

    if (!instagramContainer && !youtubeContainer && !blueskyContainer) return;

    const socialCacheKeys = {
      instagram: "firelands-contact-social-instagram-v2",
      social: "firelands-contact-social-combined"
    };

    function readCachedJson(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        return null;
      }
    }

    function writeCachedJson(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        // Ignore storage failures.
      }
    }

    function appendQueryParam(url, key, value) {
      const separator = url.includes("?") ? "&" : "?";
      return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    }

    if (instagramContainer) {
      const endpoint = instagramContainer.getAttribute("data-instagram-feed-endpoint");
      if (!endpoint) {
        instagramContainer.innerHTML = '<p class="instagram-feed-empty">Instagram feed endpoint is not set.</p>';
      } else {
        const cachedInstagram = readCachedJson(socialCacheKeys.instagram);
        if (cachedInstagram?.posts?.length) {
          renderContactSocialInstagram(instagramContainer, cachedInstagram);
        }
        fetch(appendQueryParam(endpoint, "limit", 1))
          .then((response) => {
            if (!response.ok) throw new Error("Instagram feed request failed");
            return response.json();
          })
          .then((data) => {
            const normalized = data;
            writeCachedJson(socialCacheKeys.instagram, normalized);
            renderContactSocialInstagram(instagramContainer, normalized);
          })
          .catch(() => {
            const cached = readCachedJson(socialCacheKeys.instagram);
            if (cached?.posts?.length) {
              renderContactSocialInstagram(instagramContainer, cached);
            } else {
              instagramContainer.innerHTML = '<p class="instagram-feed-empty">Could not load Instagram posts right now.</p>';
            }
          });
    }
    }

    const socialEndpoint =
      youtubeContainer?.getAttribute("data-social-feed-endpoint")
      || blueskyContainer?.getAttribute("data-social-feed-endpoint");

    if (!socialEndpoint) {
      if (youtubeContainer) {
        youtubeContainer.innerHTML = '<p class="instagram-feed-empty">Social feed endpoint is not set.</p>';
      }
      if (blueskyContainer) {
        blueskyContainer.innerHTML = '<p class="instagram-feed-empty">Social feed endpoint is not set.</p>';
      }
      return;
    }

    const cachedSocial = readCachedJson(socialCacheKeys.social);
    if (cachedSocial) {
      if (youtubeContainer && cachedSocial.youtube) {
        renderContactSocialYoutube(youtubeContainer, cachedSocial.youtube);
      }
      if (blueskyContainer && cachedSocial.bluesky) {
        renderContactSocialBluesky(blueskyContainer, cachedSocial.bluesky);
      }
    }

    fetch(socialEndpoint)
      .then((response) => {
        if (!response.ok) throw new Error("Social feed request failed");
        return response.json();
      })
      .then((data) => {
        writeCachedJson(socialCacheKeys.social, data);
        if (youtubeContainer) renderContactSocialYoutube(youtubeContainer, data.youtube || {});
        if (blueskyContainer) renderContactSocialBluesky(blueskyContainer, data.bluesky || {});
      })
      .catch(() => {
        const cached = readCachedJson(socialCacheKeys.social);
        if (youtubeContainer) {
          if (cached?.youtube) {
            renderContactSocialYoutube(youtubeContainer, cached.youtube);
          } else {
            youtubeContainer.innerHTML = '<p class="instagram-feed-empty">Could not load the latest YouTube video right now.</p>';
          }
        }
        if (blueskyContainer) {
          if (cached?.bluesky) {
            renderContactSocialBluesky(blueskyContainer, cached.bluesky);
          } else {
            blueskyContainer.innerHTML = '<p class="instagram-feed-empty">Could not load the latest Bluesky post right now.</p>';
          }
        }
      });
  }

  function initInstagramFeeds() {
    const feedContainers = document.querySelectorAll("[data-instagram-feed]");
    if (!feedContainers.length) return;

    feedContainers.forEach((container) => {
      const endpoint = container.getAttribute("data-instagram-feed-endpoint");
      const limit = Number(container.getAttribute("data-instagram-feed-limit") || 6);
      if (!endpoint) {
        container.innerHTML = '<p class="instagram-feed-empty">Instagram feed endpoint is not set.</p>';
        return;
      }

      container.innerHTML = '<p class="instagram-feed-loading">Loading recent posts...</p>';

      fetch(`${endpoint}?limit=${encodeURIComponent(limit)}`)
        .then((response) => {
          if (!response.ok) throw new Error("Instagram feed request failed");
          return response.json();
        })
        .then((data) => {
          renderInstagramCards(container, data.posts || [], data.profile || {});
        })
        .catch(() => {
          container.innerHTML = '<p class="instagram-feed-empty">Could not load Instagram posts right now.</p>';
        });
    });
  }

  initInstagramFeeds();
  initContactSocialFeeds();

  // ----- Newsletter form (Google Sheets) -----
  const newsletterForm = document.getElementById("newsletter-form");
  var GOOGLE_SHEET_URL =
    "https://script.google.com/macros/s/AKfycbzXK4eHP3ZDeX8Kmakwx0wtuNwKpuSueW2wf8TmxSj3s4KlA0oiUfXjPzT99s7fvwQgjg/exec";

  function showNewsletterSuccess(form) {
    const container = form.parentElement;
    form.style.display = "none";

    const disclaimer = container.querySelector(".newsletter-disclaimer");
    if (disclaimer) disclaimer.style.display = "none";

    const successMsg = document.createElement("p");
    successMsg.style.color = "#fff";
    successMsg.style.fontSize = "1.1rem";
    successMsg.style.fontWeight = "600";
    successMsg.style.marginTop = "10px";
    successMsg.textContent = "You\u2019re subscribed! Welcome to the club. \u26BD";
    container.appendChild(successMsg);
  }

  function showNewsletterError(form, submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Subscribe";
    const errorMsg = document.createElement("p");
    errorMsg.style.color = "#ff6b6b";
    errorMsg.style.fontSize = "0.9rem";
    errorMsg.style.marginTop = "10px";
    errorMsg.textContent = "Something went wrong. Please try again.";
    form.parentElement.appendChild(errorMsg);
  }

  function postNewsletterSignup(payload) {
    // Keep this as a regular request so we only show success after the request completes.
    return fetch(GOOGLE_SHEET_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: false,
    }).then(() => undefined);
  }

  if (newsletterForm) {
    newsletterForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const emailInput = document.getElementById("newsletter-email");
      const email = (emailInput.value || "").trim();
      const source = window.location.pathname || "/";
      const submitBtn = newsletterForm.querySelector(".newsletter-btn");
      if (!email) return;

      // Disable the button while submitting
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";

      postNewsletterSignup({ email, source })
        .then(() => {
          showNewsletterSuccess(newsletterForm);
        })
        .catch(() => {
          showNewsletterError(newsletterForm, submitBtn);
        });
    });
  }
});
