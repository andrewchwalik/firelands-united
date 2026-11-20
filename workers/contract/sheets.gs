// Deploy as the Firelands United account, with anonymous access for players.
const BOOK = '1xn3_7nZDAn4_vY6uEC2Pa7T9A8GJWDpLp62nft9krJs';
const VERSION = 'summer-2027-v2';
const PREVIOUS_VERSION = 'summer-2027-v1';
const MAX = 1024 * 1024 * 1024;
const CHUNK = 4 * 1024 * 1024;
const TYPES = /^image\/(jpeg|png|webp|gif|heic|heif|avif|tiff|bmp|x-adobe-dng)$/i;

function authorizeContract() {
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  SpreadsheetApp.openById(BOOK).getSheetByName('2027 Player Contracts').getLastRow();

  UrlFetchApp.getRequest('https://www.googleapis.com/');
}

function textCell(value) {
  return /^[\s]*[=+@-]/.test(value) ? "'" + value : value;
}
function today() {
  return Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd');
}
function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s+'T12:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0,10) === s;
}
function minor(dob, date) {
  const cutoff = (Number(date.slice(0,4))-18) + date.slice(4);
  return dob > cutoff;
}
function validated(a, version) {
  if (![VERSION, PREVIOUS_VERSION].includes(version)) throw Error();
  const required = ['name','email','address','phone','dob','instagram','jersey','shorts','signature','signed'];
  if (!a || required.some(k=>typeof a[k]!=='string' || !a[k].trim() || a[k].length>500)) throw Error();
  const date=today();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email) || !validDate(a.dob) || a.dob>date || a.signed!==date || a.agree!==true || a.esign!==true) throw Error();
  // An already-open older form can finish without the new details.
  const detailKeys = ['height','weight','primaryPosition','secondaryPosition','kit1','kit2','kit3'];
  if (detailKeys.some(k => Object.prototype.hasOwnProperty.call(a,k))) {
    for (const key of ['height','primaryPosition']) {
      if (typeof a[key] !== 'string' || !a[key].trim() || a[key].length > (key === 'height' ? 30 : 100)) throw Error();
    }
    if (typeof a.secondaryPosition !== 'string' || a.secondaryPosition.length > 100) throw Error();
    if (typeof a.weight !== 'string' || !Number.isFinite(Number(a.weight)) || Number(a.weight) <= 0) throw Error();
    const choices = [a.kit1,a.kit2,a.kit3];
    if (choices.some(n => typeof n !== 'string' || !/^(0|[1-9][0-9]?)$/.test(n)) || new Set(choices).size !== 3) throw Error();
  }
  if (version === VERSION) {
    const requiredRelease = ['emergencyName','emergencyRelationship','emergencyPhone','releaseName','playerSignature'];
    if (minor(a.dob,date)) requiredRelease.push('releaseGuardianName','releaseGuardianSignature');
    if (requiredRelease.some(key => typeof a[key] !== 'string' || !a[key].trim() || a[key].length > 300)) throw Error();
    if (!detailKeys.every(key => Object.prototype.hasOwnProperty.call(a,key)) || a.playerSignatureDate !== date || (minor(a.dob,date) && a.releaseGuardianDate !== date)) throw Error();
    if (!minor(a.dob,date)) { a.releaseGuardianName=''; a.releaseGuardianSignature=''; a.releaseGuardianDate=''; }
  }
  const sizes=['XS','S','M','L','XL','XXL'];
  if (!sizes.includes(a.jersey) || !sizes.includes(a.shorts)) throw Error();
  if (minor(a.dob,date)) {
    if(a.guardianAgree!==true || typeof a.guardianName!=='string' || !a.guardianName.trim() || a.guardianName.length>500 || a.guardianDate!==date) throw Error();
  } else {
    a.guardianName=''; a.guardianDate=''; a.guardianAgree=false;
  }
  return a;
}
function drive(method,url,options) {
  const o=options||{};
  o.method=method; o.muteHttpExceptions=true;
  o.headers=Object.assign({Authorization:'Bearer '+ScriptApp.getOAuthToken()},o.headers||{});
  return UrlFetchApp.fetch(url,o);
}
function sheet() { return SpreadsheetApp.openById(BOOK).getSheetByName('2027 Player Contracts'); }
function recorded(id) {
  const s=sheet(), n=s.getLastRow();
  return n>1 && !!s.getRange(2,18,n-1,1).createTextFinder(id).matchEntireCell(true).findNext();
}
function begin(p) {
  const a=validated(p.answers,p.version);
  if(typeof a.returning!=='boolean') throw Error();
  if(recorded(p.id)) return {done:true};
  if(a.returning && p.size===0 && p.mime==='') return record(p.id,a,'',p.version);
  if(!TYPES.test(p.mime) || !Number.isSafeInteger(p.size) || p.size<=0 || p.size>MAX) throw Error();
  const metadata={name:'2027 - '+a.name+' - '+p.id.slice(0,8),mimeType:p.mime};
  const r=drive('post','https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',{
    contentType:'application/json',payload:JSON.stringify(metadata),headers:{'X-Upload-Content-Type':p.mime,'X-Upload-Content-Length':String(p.size)}});
  const url=r.getHeaders().Location || r.getHeaders().location;
  if(r.getResponseCode()!==200 || !url || !url.startsWith('https://www.googleapis.com/')) throw Error();
  const key=Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty(key,JSON.stringify({id:p.id,version:p.version,url:url,mime:p.mime,size:p.size,expires:Date.now()+86400000}));
  return {key:key};
}
function receive(p) {
  const props=PropertiesService.getScriptProperties();
  if (!/^[a-f0-9-]{36}$/.test(p.key)) throw Error();
  const session=JSON.parse(props.getProperty(p.key)||'null');
  if(!session || session.id!==p.id || session.expires<Date.now()) throw Error();
  if(p.action==='chunk'){
    if(session.file) return {offset:session.size};
    const start=p.offset;
    if(!Number.isSafeInteger(start)||start<0||start%CHUNK!==0||start>=session.size||typeof p.data!=='string'||p.data.length>Math.ceil(CHUNK/3)*4) throw Error();
    const bytes=Utilities.base64Decode(p.data);
    if(bytes.length!==Math.min(CHUNK,session.size-start)) throw Error();
    const end=start+bytes.length;
    const res=drive('put',session.url,{contentType:session.mime,payload:bytes,headers:{'Content-Range':'bytes '+start+'-'+(end-1)+'/'+session.size},followRedirects:false});
    if([200,201].includes(res.getResponseCode())){
      session.file=JSON.parse(res.getContentText()).id;
      props.setProperty(p.key,JSON.stringify(session));
    } else if(res.getResponseCode()!==308 || end===session.size) throw Error();
    return {offset:end};
  }
  if(p.action!=='finish'||!session.file||p.version!==(session.version||PREVIOUS_VERSION)) throw Error();
  const a=validated(p.answers,p.version);
  const result=record(p.id,a,session.file,p.version); props.deleteProperty(p.key); return result;
}
function record(id,a,file,version){
  if(typeof a.returning!=='boolean' || (!file && !a.returning)) throw Error();
  const lock=LockService.getScriptLock(); lock.waitLock(12000);
  try {
    if(!recorded(id)){
      const values=[a.name,a.email,a.address,a.phone,a.dob,a.instagram,a.jersey,a.shorts,file?'https://drive.google.com/open?id='+file:'','Yes','Yes',a.signature,a.signed,a.guardianAgree?'Yes':'',a.guardianName,a.guardianDate,version,id,new Date().toISOString(),a.returning?'Yes':'No',
        ...['height','weight','primaryPosition','secondaryPosition','kit1','kit2','kit3'].map(key => a[key] || '')];
      if (version === VERSION) values.push(...['emergencyName', 'emergencyRelationship', 'emergencyPhone', 'releaseName', 'playerSignature', 'playerSignatureDate', 'releaseGuardianName', 'releaseGuardianSignature', 'releaseGuardianDate'].map(key => a[key] || ''));
      sheet().appendRow(values.map(textCell));
      SpreadsheetApp.flush();
    }
  } finally {lock.releaseLock();}
  return {done:true};
}
function doPost(e) {
  let result;
  try {
    if(e.postData.length>6000000) throw Error();
    const p=JSON.parse(e.postData.contents);
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.id)) throw Error();
    if(p.action==='begin'){
      // Purge abandoned session handles; Google expires unfinished uploads.
      const props=PropertiesService.getScriptProperties(), entries=props.getProperties();
      Object.keys(entries).forEach(k=>{if(JSON.parse(entries[k]).expires<Date.now()) props.deleteProperty(k);});
      result=begin(p);
    } else result=receive(p);
    result.ok=true;
  } catch(err) {result={ok:false};}
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
