const seasonSelect = document.querySelector('#profile-season-select');
if (seasonSelect) {
  const panels = document.querySelectorAll('.profile-season-panel');
  const showSeason = () => {
    panels.forEach(panel => { panel.hidden = panel.dataset.season !== seasonSelect.value; });
  };
  document.querySelector('.profile-selector').hidden = false;
  seasonSelect.addEventListener('change', showSeason);
  showSeason();
}
