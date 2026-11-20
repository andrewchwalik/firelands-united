(() => {
  const form = document.querySelector('#contract');
  const fields = form.elements;
  const steps = [...form.querySelectorAll('.tryout-step')];
  const markers = [...document.querySelectorAll('.contract-progress button')];
  const next = document.querySelector('#tryout-next');
  const back = document.querySelector('#back');
  const status = document.querySelector('#status');
  const version = 'summer-2027-v1';
  const draftKey = 'firelands-contract-' + version;
  const names = ['returning','name','email','address','phone','dob','instagram','height','weight','primaryPosition','secondaryPosition','jersey','shorts','kit1','kit2','kit3','agree','esign','signature','signed','guardianAgree','guardianName','guardianDate'];
  const labels = ['Returning player','Name','Email','Address','Phone','Date of birth','Instagram','Height (ft/in)','Weight (lb)','Primary position','Secondary position','Jersey size','Shorts size','First kit preference','Second kit preference','Third kit preference','Contract acknowledged','Electronic signature consent','Player signature','Player signature date','Guardian agreement','Guardian signature','Guardian signature date'];
  const kitChoices = [fields.kit1, fields.kit2, fields.kit3];
  for (const choice of kitChoices) {
    for (let number = 0; number <= 99; number++) choice.add(new Option(String(number), String(number)));
  }
  let step = 0;
  let furthestStep = 0;
  let id = crypto.randomUUID();
  let busy = false;
  let complete = false;
  const day = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

  function answers() {
    return Object.fromEntries(names.map(name => {
      const input = fields.namedItem(name);
      if (name === 'instagram' && input.value) return [name, '@' + input.value.trim().replace(/^@+/, '')];
      return [name, input.type === 'checkbox' ? input.checked : input.value.trim()];
    }));
  }
  function save() {
    if (!complete) try { localStorage.setItem(draftKey,JSON.stringify({id,step,furthestStep,answers:answers(),at:Date.now()})); } catch {}
  }
  try {
    const d = JSON.parse(localStorage.getItem(draftKey));
    if (d && Date.now()-d.at < 30*86400000 && /^[a-f0-9-]{36}$/.test(d.id)) {
      for (const key of names) {
        const input = fields.namedItem(key), value=d.answers[key];
        if (input.type==='checkbox') input.checked=value===true;
        else if(typeof value==='string') input.value=value;
      }
      id=d.id; step=Number.isInteger(d.step)?Math.min(3,Math.max(0,d.step)):0;
      furthestStep = Number.isInteger(d.furthestStep) ? Math.max(step, Math.min(steps.length - 1, d.furthestStep)) : step;
    }
  } catch {}

  function conditions() {
    const date = day(), cutoff = (Number(date.slice(0,4))-18)+date.slice(4);
    const selected = new Set();
    for (const choice of kitChoices) {
      choice.setCustomValidity(choice.value && selected.has(choice.value) ? 'Choose a different kit number for each preference.' : '');
      selected.add(choice.value);
    }
    if (fields.instagram.value.startsWith('@')) fields.instagram.value = fields.instagram.value.replace(/^@+/, '');
    fields.dob.max=date;
    const minor=fields.dob.value && fields.dob.value>cutoff;
    const guardian=document.querySelector('#guardian');
    guardian.hidden=guardian.disabled=!minor;
    for(const input of [fields.signed,fields.guardianDate]) {
      input.min=input.max=date;
      input.value=date;
    }
    const returning = fields.returning.checked;
    document.querySelector('#signing-photo').hidden = returning;
    fields.photo.disabled = returning;
    fields.photo.required = !returning;
    if (returning) fields.photo.value = '';
    const file=fields.photo.files[0];
    fields.photo.setCustomValidity(file && (!/^image\/(jpeg|png|webp|gif|heic|heif|avif|tiff|bmp|x-adobe-dng)$/i.test(file.type) || file.size<1 || file.size>1024**3)?'Choose a supported photo up to 1 GB.':'');
  }
  function invalid(panel) {
    return [...panel.querySelectorAll('input,select')].find(el=>el.willValidate && !el.checkValidity());
  }
  const errorHint = document.createElement('small');
  errorHint.id = 'contract-field-error';
  errorHint.setAttribute('role', 'alert');
  let errorField;
  function clearError() {
    if (!errorField) return;
    errorField.removeAttribute('aria-invalid');
    const descriptions = (errorField.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== errorHint.id);
    if (descriptions.length) errorField.setAttribute('aria-describedby', descriptions.join(' '));
    else errorField.removeAttribute('aria-describedby');
    errorHint.remove();
    errorField = null;
  }
  function showError(field) {
    clearError();
    errorField = field;
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), errorHint.id].filter(Boolean).join(' '));
    errorHint.textContent = field.validity.patternMismatch && field.title ? field.title : field.validationMessage;
    const label = field.closest('label');
    label.append(errorHint);
    const focusTarget = field === fields.dob && field.classList.contains('has-custom-picker')
      ? document.getElementById('birth-picker-open') : field;
    focusTarget.focus({preventScroll:true});
    label.scrollIntoView({block:'center',behavior:'instant'});
  }
  function updateMarkers() {
    markers.forEach((marker, i) => {
      marker.disabled = busy || complete || i > furthestStep || i === step;
      if (!complete && i === step) marker.setAttribute('aria-current', 'step');
      else marker.removeAttribute('aria-current');
    });
  }
  function visit(index) {
    clearError();
    conditions();
    step = index;
    furthestStep = Math.max(furthestStep, step);
    status.textContent = '';
    render(true);
    save();
  }
  function render(focus=false) {
    steps.forEach((panel,i)=>panel.hidden=i!==step);
    updateMarkers();
    back.hidden=step===0;
    next.textContent=step===3?'Sign and submit':'Continue';
    if(step===3){
      const dl=document.querySelector('#tryout-review'); dl.replaceChildren();
      function row(label,value){
        const dt=document.createElement('dt'),dd=document.createElement('dd');
        dt.textContent=label;dd.textContent=value;dl.append(dt,dd);
      }
      const a=answers();
      names.forEach((key,i)=>{
        if(key.startsWith('guardian') && fields.guardianName.matches(':disabled')) return;
        row(labels[i],typeof a[key]==='boolean'?(a[key]?'Yes':'No'):a[key]);
      });
      if (!a.returning) row('Signing photo', fields.photo.files[0]?.name);
    }
    if(focus) steps[step].querySelector('h2').focus();
  }
  conditions();
  for(let i=0;i<step;i++) if(invalid(steps[i])) {step=i;break;}
  render();
  function updateDraft() {
    conditions();
    if (errorField && errorField.validity.valid) clearError();
    save();
  }
  form.addEventListener('input', updateDraft);
  form.addEventListener('change', updateDraft);
  window.addEventListener('pagehide',save);
  back.onclick = () => visit(step - 1);
  markers.forEach((marker, i) => marker.addEventListener('click', () => visit(i)));
  async function send(body) {
    if (!form.dataset.endpoint) throw Error('Submission service is unavailable');
    const response=await fetch(form.dataset.endpoint,{method:'POST',credentials:'omit',body:JSON.stringify({...body,id,version})});
    if(!response.ok) throw Error();
    const data=await response.json();
    if(!data.ok) throw Error();
    return data;
  }
  function base64(blob) {
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result.split(',')[1]);
      reader.onerror=reject;
      reader.readAsDataURL(blob);
    });
  }
  form.onsubmit=async event=>{
    event.preventDefault();
    if(busy || complete) return;
    conditions();
    for(let i=0;i<=step;i++){
      const el=invalid(steps[i]);
      if(el){step=i;render();showError(el);return;}
    }
    if(step<3){visit(step + 1);return;}
    busy=true;next.disabled=back.disabled=true;updateMarkers();save();
    try {
      const a = answers();
      const file = a.returning ? null : fields.photo.files[0];
      status.textContent='Saving your contract…';
      let result=await send({action:'begin',answers:a,mime:file?.type||'',size:file?.size||0});
      if(!result.done){
        if(!file || !result.key) throw Error();
        const key=result.key, chunk=4*1024*1024;
        for(let offset=0;offset<file.size;offset+=chunk){
          status.textContent='Uploading your photo… '+Math.floor(100*offset/file.size)+'%';
          await send({action:'chunk',key,offset,data:await base64(file.slice(offset,offset+chunk))});
        }
        status.textContent='Saving your signed contract…';
        result=await send({action:'finish',key,answers:a});
      }
      if(!result.done) throw Error();
      complete=true;
      try {localStorage.removeItem(draftKey);} catch {}
      markers[3].removeAttribute('aria-current');markers[3].classList.add('is-complete');
      form.innerHTML = `<div class="tryout-form-content tryout-step contract-confirmation">
        <h2 tabindex="-1">Welcome to the 2027 Firelands United roster!</h2>
        <p>We're thrilled to have you representing the Lands. Our club director will be reaching out with more details soon. If you have any questions in the meantime, you can drop us a DM on <a href="https://www.instagram.com/firelandsunited/">Instagram</a>.</p>
        <p>If you want to get hyped for the season, you can watch <a href="https://www.youtube.com/playlist?list=PLWFAnIt998Ss4F09pFNZu6jtiLMItm7kz">last season's vlog</a>. Be sure to get yourself ready to be on camera for the 2027 vlog! We'll see you on the pitch soon.</p>
        <iframe title="Tryouts for 2026 — Season 2, Episode 1" src="https://www.youtube-nocookie.com/embed/SfSausCcHOs" referrerpolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
      </div>`;
      form.querySelector('h2').focus();
    } catch {
      status.textContent='We could not confirm your signed contract. Your answers are still here. Please try submitting again.';
    } finally {busy=false;next.disabled=back.disabled=false;updateMarkers();}
  };
})();
