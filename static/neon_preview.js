// An honest, separately labelled preview. This does not impersonate a live FPS map.
const select = document.getElementById('map-select');
if (select) {
  // Pick the native scene's startup workload BEFORE it downloads or compiles.
  const qualityRow=document.createElement('div');
  qualityRow.id='cf-neon-quality-row';
  qualityRow.hidden=true;
  qualityRow.style.cssText='margin:12px 0;padding:12px;border:1px solid #5c97a866;border-radius:8px;background:#061a2388;';
  const qualityLabel=document.createElement('label');
  qualityLabel.htmlFor='cf-neon-quality';
  qualityLabel.textContent='NEON ZENITH · GRAPHICS PRESET';
  qualityLabel.style.cssText='display:block;margin-bottom:8px;font-size:11px;letter-spacing:.08em;';
  const qualitySelect=document.createElement('select');
  qualitySelect.id='cf-neon-quality';
  qualitySelect.setAttribute('aria-label','Neon Zenith map graphics quality');
  for(const [value,label] of [
    ['school','School / Performance — fastest startup'],
    ['balanced','Balanced — recommended'],
    ['high','High — maximum original quality']]){
    const option=document.createElement('option');
    option.value=value;option.textContent=label;qualitySelect.append(option);
  }
  qualitySelect.value='balanced';
  qualitySelect.style.cssText='width:100%;padding:10px;box-sizing:border-box;';
  const detail=document.createElement('small');
  detail.style.cssText='display:block;margin-top:8px;line-height:1.5;opacity:.75;';
  detail.textContent='School uses smaller original textures and fewer distant details. Daybreak City is unaffected.';
  qualityRow.append(qualityLabel,qualitySelect,detail);
  select.insertAdjacentElement('afterend',qualityRow);
  const syncQuality=()=>{qualityRow.hidden=select.value!=='neon_zenith';};
  select.addEventListener('change',syncQuality);
  syncQuality();
  const box = document.createElement('div');
  box.id='native-neon-preview';
  box.style.cssText='margin:13px 0;padding:14px;border:1px solid #4c9ba077;border-radius:8px;background:#071b2188;';
  const title=document.createElement('strong');
  title.textContent='NEON ZENITH · ORIGINAL ENVIRONMENT';
  title.style.cssText='display:block;font-size:12px;letter-spacing:.09em;margin-bottom:9px;';
  const a=document.createElement('a');
  a.textContent='EXPLORE ORIGINAL CITY ↗';
  a.href='https://zenith.billpwchan.art/?fly';
  a.rel='noopener noreferrer';
  a.target='_blank';
  a.style.cssText='display:inline-block;color:#baf4ef;font-weight:700;font-size:12px;text-decoration:underline;';
  const note=document.createElement('small');
  note.textContent='Original full-quality environment preview. Not a CROSSFIRE multiplayer arena yet.';
  note.style.cssText='display:block;margin-top:8px;line-height:1.5;opacity:.78;';
  box.append(title,a,note);
  select.insertAdjacentElement('afterend',box);
  // A playable map belongs in the normal selector; don't show the old
  // standalone walkthrough card once the native multiplayer map is registered.
  fetch('/api/maps').then(r=>r.ok?r.json():null).then(catalog=>{
    if(catalog?.maps?.some(m=>m.id==='neon_zenith'&&m.available))box.remove();
  }).catch(()=>{});
  fetch('/api/neon-preview').then(r=>r.ok?r.json():null).then(status=>{
    if(status?.ready){
      a.href='/neon/?crossfire';a.target='_self';a.removeAttribute('rel');
      a.textContent='WALK NEON ZENITH IN CROSSFIRE ↗';
    }
  }).catch(()=>{});
}
