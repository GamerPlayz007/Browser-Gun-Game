// Native map quality picker inside CROSSFIRE's main lobby.
// No separate preview site: selecting Neon Zenith launches its original
// environment module through the same CROSSFIRE page/runtime router.
const select=document.getElementById('map-select');
if(select){
  const box=document.createElement('div');
  box.id='cf-neon-quality-row';
  box.hidden=true;
  box.style.cssText='margin:12px 0;padding:12px;border:1px solid #5c97a866;border-radius:8px;background:#061a2388;';
  const label=document.createElement('label');
  label.htmlFor='cf-neon-quality';
  label.textContent='NEON ZENITH · GRAPHICS';
  label.style.cssText='display:block;margin-bottom:8px;font-size:11px;letter-spacing:.08em;';
  const picker=document.createElement('select');
  picker.id='cf-neon-quality';
  picker.setAttribute('aria-label','Neon Zenith graphics quality');
  for(const [id,name] of [
    ['school','School / Performance'],
    ['balanced','Balanced (recommended)'],
    ['high','High / Original']]){
    const option=document.createElement('option');
    option.value=id;option.textContent=name;picker.append(option);
  }
  picker.value='balanced';
  picker.style.cssText='width:100%;padding:10px;box-sizing:border-box;';
  const note=document.createElement('small');
  note.textContent='Uses the original city, loaded inside CROSSFIRE. School mode reduces startup and graphics workload.';
  note.style.cssText='display:block;margin-top:8px;opacity:.8;line-height:1.5;';
  box.append(label,picker,note);
  select.insertAdjacentElement('afterend',box);
  function update(){box.hidden=select.value!=='neon_zenith';}
  select.addEventListener('change',update);
  // The game fetches its registry asynchronously, so the selection can change
  // programmatically after this defer script executes.
  fetch('/api/maps').then(r=>r.ok?r.json():null).then(()=>update()).catch(()=>{});
}
