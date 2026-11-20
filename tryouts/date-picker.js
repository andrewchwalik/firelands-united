(() => {
  'use strict';
  const birth = document.querySelector('input[type="date"][autocomplete="bday"]');
  const dialog = document.getElementById('birth-picker');
  const opener = document.getElementById('birth-picker-open');
  const month = document.getElementById('birth-month');
  const year = document.getElementById('birth-year');
  const days = document.getElementById('birth-days');
  if (!birth || !dialog || typeof dialog.showModal !== 'function') {
    if (opener) opener.hidden = true;
    return;
  }
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  months.forEach((name, i) => month.add(new Option(name, String(i))));
  let closing = false;
  function closePicker() {
    // Native dialog focus restoration happens synchronously, before its close event.
    closing = true;
    dialog.close();
    opener.focus({ preventScroll: true });
  }
  function render() {
    const y = Number(year.value), m = Number(month.value);
    days.replaceChildren();
    const offset = new Date(y, m, 1).getDay();
    for (let i = 0; i < offset; i++) days.append(document.createElement('span'));
    for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) {
      const value = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = d;
      button.setAttribute('aria-label', `${months[m]} ${d}, ${y}`);
      button.setAttribute('aria-pressed', String(birth.value === value));
      button.disabled = value > birth.max;
      button.addEventListener('click', () => {
        birth.value = value;
        birth.dispatchEvent(new Event('input', { bubbles: true }));
        birth.dispatchEvent(new Event('change', { bubbles: true }));
        closePicker();
      });
      days.append(button);
    }
  }
  function openPicker() {
    if (dialog.open || closing) return;
    const maxYear = Number(birth.max.slice(0, 4)) || new Date().getFullYear();
    const selected = birth.value ? birth.value.split('-').map(Number) : [maxYear - 18, 1, 1];
    year.replaceChildren();
    for (let y = maxYear; y >= Math.min(maxYear - 120, selected[0]); y--) year.add(new Option(String(y), String(y)));
    year.value = String(selected[0]);
    month.value = String(selected[1] - 1);
    render();
    dialog.showModal();
  }
  opener.addEventListener('click', openPicker);
  birth.addEventListener('focus', openPicker);
  birth.addEventListener('click', event => { event.preventDefault(); openPicker(); });
  birth.setAttribute('aria-haspopup', 'dialog');
  birth.setAttribute('aria-controls', 'birth-picker');
  month.addEventListener('change', render);
  year.addEventListener('change', render);
  document.getElementById('birth-picker-close').addEventListener('click', closePicker);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closePicker(); });
  dialog.addEventListener('close', () => {
    opener.focus({ preventScroll: true });
    closing = false;
  });
  // Keep direct keyboard date entry, but use the branded popup instead of the native icon.
  birth.classList.add('has-custom-picker');
})();
