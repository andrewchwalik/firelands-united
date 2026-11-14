export const RELEASE_VERSION = '2027-tryouts-2026-11-14';
export const fields = ['fullName','email','phone','homeAddress','dateOfBirth','availability','positions','secondaryPosition','height','dominantFoot','highlightVideo','experience','motivation','emergencyName','emergencyRelationship','emergencyPhone','releaseName','playerSignature','playerSignatureDate','guardianName','guardianSignature','guardianDate'];
export function clubDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get = key => parts.find(p => p.type === key).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function validate(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid registration.');
  if (!['men','women'].includes(input.team)) throw new Error('Please select a team.');
  if (!/^[a-f0-9-]{36}$/i.test(input.registrationId || '')) throw new Error('Please reload the registration form.');
  if (input.releaseVersion !== RELEASE_VERSION) throw new Error('The release has changed. Please reload and review it again.');
  const data = {team:input.team, registrationId:input.registrationId, releaseVersion:RELEASE_VERSION};
  const today = clubDate(now);
  for (const key of fields) {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > (['experience','motivation'].includes(key) ? 5000 : 500)) throw new Error('One of your answers is too long or invalid.');
    data[key] = value.trim();
  }
  for (const key of fields.filter(key => !['highlightVideo','guardianName','guardianSignature','guardianDate','playerSignatureDate'].includes(key))) {
    if (!data[key]) throw new Error('Please complete all required fields.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new Error('Please enter a valid email address.');
  if (data.availability !== 'Yes') throw new Error('You must be able to attend the majority of practices and home matches.');
  if (!['Left Footed','Right Footed'].includes(data.dominantFoot)) throw new Error('Please select your dominant foot.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dateOfBirth)) throw new Error('Please enter a valid date of birth.');
  const date = new Date(`${data.dateOfBirth}T12:00:00Z`);
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0,10) !== data.dateOfBirth || data.dateOfBirth > today) throw new Error('Please enter a valid date of birth.');
  if (data.highlightVideo) {
    let url;
    try { url = new URL(data.highlightVideo); } catch { throw new Error('Please enter a valid highlight video link.'); }
    if (!['https:','http:'].includes(url.protocol)) throw new Error('Please enter an http or https video link.');
  }
  const cutoff = `${Number(today.slice(0,4))-18}${today.slice(4)}`;
  const minor = data.dateOfBirth > cutoff;
  if (minor && (!data.guardianName || !data.guardianSignature)) throw new Error('A parent or guardian must complete and sign the release.');
  data.playerSignatureDate = today;
  data.guardianDate = minor ? today : '';
  if (!minor) { data.guardianName=''; data.guardianSignature=''; }
  return data;
}
