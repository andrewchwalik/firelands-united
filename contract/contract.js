(() => {
  const form = document.querySelector('#contract');
  const fields = form.elements;
  const steps = [...form.querySelectorAll('.tryout-step')];
  const markers = [...document.querySelectorAll('.tryout-progress li')];
  const next = document.querySelector('#tryout-next');
  const back = document.querySelector('#back');
  const status = document.querySelector('#status');
  const version = 'summer-2027-v1';
  const draftKey = 'firelands-contract-' + version;
  const names = ['returning','name','email','address','phone','dob','instagram','jersey','shorts','agree','esign','signature','signed','guardianAgree','guardianName','guardianDate'];
  const labels = ['Returning player','Name','Email','Address','Phone','Date of birth','Instagram','Jersey size','Shorts size','Contract acknowledged','Electronic signature consent','Player signature','Player signature date','Guardian agreement','Guardian signature','Guardian signature date'];
  let step = 0;
  let id = crypto.randomUUID();
  let busy = false;
  let complete = false;
  const day = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

  function answers() {
    return Object.fromEntries(names.map(name => {
      const input = fields.namedItem(name);
      return [name, input.type === 'checkbox' ? input.checked : input.value.trim()];
    }));
  }
  function save() {
    if (!complete) try { localStorage.setItem(draftKey,JSON.stringify({id,step,answers:answers(),at:Date.now()})); } catch {}
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
    }
  } catch {}

  function conditions() {
    const date = day(), cutoff = (Number(date.slice(0,4))-18)+date.slice(4);
    fields.dob.max=date;
    const minor=fields.dob.value && fields.dob.value>cutoff;
    const guardian=document.querySelector('#guardian');
    guardian.hidden=guardian.disabled=!minor;
    for(const input of [fields.signed,fields.guardianDate]) {
      input.min=input.max=date;
      if (!input.value) input.value=date;
    }
    fields.photo.required=!fields.returning.checked;
    document.querySelector('#photo-label').textContent=fields.returning.checked?'Signing photo (optional replacement)':'Signing photo (required)';
    const file=fields.photo.files[0];
    fields.photo.setCustomValidity(file && (!/^image\/(jpeg|png|webp|gif|heic|heif|avif|tiff|bmp|x-adobe-dng)$/i.test(file.type) || file.size<1 || file.size>1024**3)?'Choose a supported photo up to 1 GB.':'');
  }
  function invalid(panel) {
    return [...panel.querySelectorAll('input,select')].find(el=>el.willValidate && !el.checkValidity());
  }
  function render(focus=false) {
    steps.forEach((panel,i)=>panel.hidden=i!==step);
    markers.forEach((marker,i)=>i===step?marker.setAttribute('aria-current','step'):marker.removeAttribute('aria-current'));
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
      row('Signing photo',fields.photo.files[0]?.name || 'Use photo on file');
    }
    if(focus) steps[step].querySelector('h2').focus();
  }
  conditions();
  for(let i=0;i<step;i++) if(invalid(steps[i])) {step=i;break;}
  render();
  form.addEventListener('input',()=>{conditions();save();});
  form.addEventListener('change',()=>{conditions();save();});
  window.addEventListener('pagehide',save);
  back.onclick=()=>{if(!busy && step>0){step--;status.textContent='';render(true);save();}};
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
      if(el){step=i;render();el.reportValidity();return;}
    }
    if(step<3){step++;render(true);save();return;}
    busy=true;next.disabled=back.disabled=true;save();
    try {
      const file=fields.photo.files[0], a=answers();
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
      form.innerHTML='<div class="tryout-form-content tryout-step"><h2 tabindex="-1">Contract received</h2><p>Welcome to the 2027 Firelands United roster. Your signed player contract has been saved.</p></div>';
      form.querySelector('h2').focus();
    } catch {
      status.textContent='We could not confirm your signed contract. Your answers are still here. Please try submitting again.';
    } finally {busy=false;next.disabled=back.disabled=false;}
  };
})();
