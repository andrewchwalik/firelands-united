(() => {
  'use strict';
  const form = document.getElementById('tryout-form');
  if (!form) return;
  const steps = [...form.querySelectorAll('.tryout-step')];
  const progress = [...document.querySelectorAll('.tryout-progress li')];
  const next = document.getElementById('tryout-next');
  const back = document.getElementById('tryout-back');
  const submit = document.getElementById('tryout-submit');
  let current = 0;
  let furthest = 0;
  form.noValidate = true;
  const errorBox = document.createElement('div');
  errorBox.id = 'tryout-validation';
  errorBox.className = 'tryout-validation';
  errorBox.setAttribute('role', 'alert');
  errorBox.tabIndex = -1;
  errorBox.hidden = true;
  function clearError() {
    errorBox.hidden = true;
    form.querySelectorAll('[aria-invalid="true"]').forEach(input => {
      input.removeAttribute('aria-invalid');
      const descriptions = (input.getAttribute('aria-describedby') || '').split(' ').filter(id => id !== errorBox.id);
      if (descriptions.length) input.setAttribute('aria-describedby', descriptions.join(' '));
      else input.removeAttribute('aria-describedby');
    });
  }
  function showError(input) {
    clearError();
    const label = input.type === 'radio'
      ? input.closest('fieldset').querySelector('legend').textContent.trim()
      : (input.closest('label').childNodes[0].textContent || 'this field').trim();
    let message = `Please complete ${label.toLowerCase()}.`;
    if (input.validity.customError) message = input.validationMessage;
    else if (input.validity.typeMismatch) message = input.type === 'email' ? 'Please enter a valid email address.' : 'Please enter a valid link, starting with https://.';
    else if (input.validity.rangeOverflow) message = 'Please choose a date that is not in the future.';
    else if (input.validity.badInput) message = 'Please enter a valid date.';
    errorBox.textContent = message;
    steps[current].querySelector('h2').after(errorBox);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', `${input.getAttribute('aria-describedby') || ''} ${errorBox.id}`.trim());
    errorBox.hidden = false;
    errorBox.focus({ preventScroll: true });
    errorBox.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  form.addEventListener('input', clearError);
  form.addEventListener('change', clearError);
  const birth = form.elements.dateOfBirth;
  const guardian = document.getElementById('tryout-guardian');
  const attendance = [...form.querySelectorAll('[name="availability"]')];
  function updateAttendance() {
    const blocked = form.elements.availability.value === 'No';
    attendance.forEach(input => input.setCustomValidity(blocked ? 'You must be able to attend the majority of practices and home matches to continue.' : ''));
    document.getElementById('attendance-error').hidden = !blocked;
  }
  attendance.forEach(input => input.addEventListener('change', updateAttendance));
  function updateGuardian() {
    // Use the club's calendar date, not a UTC-parsed birthday or the tryout date.
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = type => parts.find(item => item.type === type).value;
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    birth.max = today;
    form.elements.playerSignatureDate.max = today;
    form.elements.guardianDate.max = today;
    form.elements.playerSignatureDate.value = today;
    form.elements.guardianDate.value = today;
    const cutoff = `${Number(part('year')) - 18}-${part('month')}-${part('day')}`;
    const minor = !!birth.value && birth.validity.valid && birth.value > cutoff;
    guardian.hidden = !minor;
    guardian.disabled = !minor;
    for (const input of guardian.querySelectorAll('input')) input.required = minor;
    return minor;
  }
  birth.addEventListener('input', updateGuardian);
  birth.addEventListener('change', updateGuardian);
  window.addEventListener('pageshow', updateGuardian);
  updateGuardian();
  const fields = [['fullName', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['homeAddress', 'Home address'], ['dateOfBirth', 'Date of birth'], ['availability', 'Can attend at least 80% of club activities'], ['positions', 'Primary position'], ['secondaryPosition', 'Secondary position'], ['height', 'Height'], ['dominantFoot', 'Dominant foot'], ['highlightVideo', 'Highlight video'], ['experience', 'Playing experience'], ['motivation', 'Why Firelands United?'], ['emergencyName', 'Emergency contact'], ['emergencyRelationship', 'Relationship'], ['emergencyPhone', 'Emergency phone'], ['releaseName', 'Player name on release'], ['playerSignature', 'Player signature'], ['playerSignatureDate', 'Player signature date']];
  function review() {
    const minor = updateGuardian();
    const data = new FormData(form);
    const rows = [['Session', data.get('team') === 'women' ? "Women's tryouts - December 19, 2026, 2-4 PM" : "Men's tryouts - December 20, 2026, 2-4 PM"], ['Location', 'Edison High School Field House'], ...fields.map(([key, label]) => [label, data.get(key)])];
    if (minor) rows.push(['Parent / guardian name', data.get('guardianName')], ['Parent / guardian e-signature', data.get('guardianSignature')], ['Parent / guardian signature date', data.get('guardianDate')]);
    const list = document.getElementById('tryout-review');
    list.replaceChildren();
    for (const [label, value] of rows) {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      list.append(term, description);
    }
  }
  function show(index) {
    clearError();
    updateGuardian();
    current = index;
    furthest = Math.max(furthest, index);
    steps.forEach((step, i) => { step.hidden = i !== index; });
    progress.forEach((item, i) => {
      const button = item.querySelector('button');
      button.disabled = i > furthest;
      if (i === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
      if (i === index) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    back.hidden = index === 0;
    next.hidden = index === steps.length - 1;
    submit.hidden = index !== steps.length - 1;
    document.getElementById('tryout-step-count').textContent = `Step ${index + 1} of ${steps.length}`;
    if (index === steps.length - 1) review();
    steps[index].querySelector('h2').focus({ preventScroll: true });
    const top = form.getBoundingClientRect().top;
    if (top < 80) window.scrollBy({ top: top - 90, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  function advance() {
    updateGuardian();
    updateAttendance();
    for (const input of steps[current].querySelectorAll('input, textarea')) {
      if (input.type !== 'radio' && input.type !== 'date') input.value = input.value.trim();
      if (!input.checkValidity()) { showError(input); return; }
    }
    if (current < steps.length - 1) show(current + 1);
  }
  next.addEventListener('click', advance);
  progress.forEach((item, index) => {
    item.querySelector('button').addEventListener('click', () => {
      updateGuardian();
      updateAttendance();
      if (index > furthest) return;
      // Returning is unrestricted; moving forward rechecks any edited required fields.
      if (index > current) {
        for (let i = 0; i < index; i++) {
          const invalid = [...steps[i].querySelectorAll('input, textarea')].find(input => !input.checkValidity());
          if (invalid) {
            show(i);
            showError(invalid);
            return;
          }
        }
      }
      show(index);
    });
  });
  back.addEventListener('click', () => show(Math.max(0, current - 1)));
  const registrationId = crypto.randomUUID();
  let sending = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (current !== steps.length - 1) { advance(); return; }
    if (sending || submit.disabled || !form.dataset.endpoint) return;
    updateGuardian();
    updateAttendance();
    for (let i = 0; i < steps.length; i++) {
      const invalid = [...steps[i].querySelectorAll('input, textarea')].find(input => !input.checkValidity());
      if (invalid) { show(i); showError(invalid); return; }
    }
    const payload = {...Object.fromEntries(new FormData(form)), registrationId, releaseVersion:'2027-tryouts-2026-11-14'};
    sending = true;
    submit.disabled = true;
    submit.textContent = 'Submitting...';
    back.disabled = true;
    progress.forEach(item => { item.querySelector('button').disabled = true; });
    try {
      const response = await fetch(form.dataset.endpoint, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(35000)});
      const result = await response.json();
      if (!response.ok || !result.ok || result.registrationId !== registrationId) throw new Error(result.message || 'We could not confirm your registration. Please try again.');
      const reviewStep = progress[progress.length - 1];
      reviewStep.classList.add('is-complete');
      reviewStep.removeAttribute('aria-current');
      const reviewButton = reviewStep.querySelector('button');
      reviewButton.removeAttribute('aria-current');
      reviewButton.setAttribute('aria-label', 'Review complete — registration submitted');
      form.replaceChildren(document.getElementById('tryout-confirmation-template').content.cloneNode(true));
      document.getElementById('confirmation-title').focus();
    } catch (error) {
      errorBox.textContent = error.name === 'TimeoutError' ? 'The connection timed out. Your answers are still here. Please try again.' : (error.message || 'Unable to submit. Please try again.');
      steps[current].querySelector('h2').after(errorBox);
      errorBox.hidden = false;
      errorBox.focus();
      submit.disabled = false;
      submit.textContent = 'Submit registration';
      back.disabled = false;
      progress.forEach((item,i) => { item.querySelector('button').disabled = i > furthest; });
    } finally { sending = false; }
  });
})();
