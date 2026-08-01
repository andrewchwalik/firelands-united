const SUPERLATIVE_CATEGORIES = [
  "Most likely to become a professional soccer player",
  "Most likely to get in a fist fight with a ref",
  "Most likely to miss a sitter",
  "Most likely to forget their boots",
  "Most likely to keep a positive attitude no matter the situation",
  "Most likely to hype the team up",
  "Most likely to have the best goal celebration",
  "Most likely to put a free kick on the back of the net",
  "Most likely to hang up the boots to become a hair model",
  "Most likely to have the best excuse for missing practice",
  "Most likely to become a future coach",
  "Most likely to be the first one at practice",
  "Most likely to successfully pull off a 5-star skill move"
];

document.addEventListener("DOMContentLoaded", () => {
  const config = window.SUPERLATIVES_CONFIG || {};
  const form = document.getElementById("superlatives-form");
  const ballotGrid = document.getElementById("superlatives-ballot-grid");
  const successMessage = document.getElementById("superlatives-success-message");
  const errorMessage = document.getElementById("superlatives-error-message");
  const submitButton = document.getElementById("superlatives-submit");

  if (!form || !ballotGrid || !Array.isArray(config.players)) return;

  const playerOptions = config.players
    .map((player) => `<option value="${escapeHtml(player)}">${escapeHtml(player)}</option>`)
    .join("");

  ballotGrid.innerHTML = SUPERLATIVE_CATEGORIES.map((category, index) => {
    const inputId = `superlative-${index + 1}`;
    return `
      <label class="superlative-question" for="${inputId}">
        <span>${index + 1}. ${escapeHtml(category)}</span>
        <select id="${inputId}" name="${escapeHtml(category)}" required>
          <option value="">Select a player</option>
          ${playerOptions}
        </select>
      </label>
    `;
  }).join("");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (successMessage) successMessage.hidden = true;
    if (errorMessage) errorMessage.hidden = true;

    const voterName = document.getElementById("voter-name")?.value.trim() || "";
    const voterEmail = document.getElementById("voter-email")?.value.trim() || "";
    const honey = document.getElementById("superlatives-honey")?.value || "";
    if (honey) return;

    const picks = SUPERLATIVE_CATEGORIES.map((category, index) => {
      const select = document.getElementById(`superlative-${index + 1}`);
      return {
        category,
        player: select?.value.trim() || ""
      };
    });

    if (!voterName || !voterEmail || picks.some((pick) => !pick.player)) {
      if (errorMessage) {
        errorMessage.textContent = "Please add your name, email, and a pick for every superlative.";
        errorMessage.hidden = false;
      }
      return;
    }

    const timestamp = new Date().toLocaleString("en-US", { hour12: true });
    const teamLabel = config.teamLabel || "Firelands United";
    const message = [
      `${teamLabel} Superlatives Ballot`,
      "",
      ...picks.map((pick) => `${pick.category}: ${pick.player}`)
    ].join("\n");

    const payload = {
      formType: "superlatives-vote",
      name: voterName,
      email: voterEmail,
      team: config.team || "",
      teamLabel,
      picks,
      timestamp,
      newsletterOptIn: false,
      subject: `${teamLabel} Superlatives Ballot`,
      message
    };

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }

    fetch("https://firelandsunited-contact.chwalik.workers.dev/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then((response) => {
        if (!response.ok) throw new Error("Vote submission failed.");
        form.reset();
        if (successMessage) successMessage.hidden = false;
      })
      .catch(() => {
        if (errorMessage) {
          errorMessage.textContent = "Could not submit your ballot. Please try again in a moment.";
          errorMessage.hidden = false;
        }
      })
      .finally(() => {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Submit Ballot";
        }
      });
  });
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
