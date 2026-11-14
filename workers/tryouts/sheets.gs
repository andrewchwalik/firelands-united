const SHEET_ID = '1oalr0oaCyeLrKCZnsU3z_1WZDqXoruZtyc2yRQ-b2wU';
const FIELD_ORDER = ['fullName','email','phone','homeAddress','dateOfBirth','availability','positions','secondaryPosition','height','dominantFoot','highlightVideo','experience','motivation','emergencyName','emergencyRelationship','emergencyPhone','releaseName','playerSignature','playerSignatureDate','guardianName','guardianSignature','guardianDate'];
function doPost(e) {
  let lock;
  try {
    const secret=PropertiesService.getScriptProperties().getProperty('SHEETS_SECRET');
    if (!secret || !e.postData || e.postData.contents.length>30000) throw new Error('Invalid request');
    const body=JSON.parse(e.postData.contents);
    const expected=Utilities.computeHmacSha256Signature(body.payload,secret).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
    let mismatch=expected.length ^ String(body.signature).length;
    for(let i=0;i<expected.length;i++) mismatch |= expected.charCodeAt(i) ^ String(body.signature).charCodeAt(i);
    if(mismatch) throw new Error('Invalid signature');
    const envelope=JSON.parse(body.payload), data=envelope.data;
    if(Math.abs(Date.now()-Date.parse(envelope.timestamp))>300000 || !Number.isFinite(Date.parse(envelope.timestamp))) throw new Error('Expired');
    if(!['men','women'].includes(data.team) || data.availability!=='Yes') throw new Error('Invalid registration');
    lock=LockService.getScriptLock();lock.waitLock(20000);
    const sheet=SpreadsheetApp.openById(SHEET_ID).getSheetByName(data.team==='women'?"Women's Tryouts":"Men's Tryouts");
    const count=sheet.getLastRow();
    if(count>1 && sheet.getRange(2,1,count-1,1).createTextFinder(data.registrationId).matchEntireCell(true).findNext()) return result_({ok:true,registrationId:data.registrationId});
    const values=[data.registrationId,envelope.timestamp,...FIELD_ORDER.map(key=>data[key]||''),data.releaseVersion,envelope.releaseHash,data.team==='women'?'2026-12-19':'2026-12-20',10,'Unpaid'];
    // Prevent user-controlled values from becoming spreadsheet formulas.
    const safe=values.map(value=>typeof value==='string' && /^[=+@\-\t\r]/.test(value)?"'"+value:value);
    sheet.getRange(count+1,1,1,safe.length).setValues([safe]);
    SpreadsheetApp.flush();
    return result_({ok:true,registrationId:data.registrationId});
  }catch(error){return result_({ok:false});}
  finally{if(lock && lock.hasLock())lock.releaseLock();}
}
function result_(body){return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);}
