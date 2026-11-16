// An honest, separately labelled preview. This does not impersonate a live FPS map.
const select = document.getElementById('map-select');
if (select) {
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
  fetch('/api/neon-preview').then(r=>r.ok?r.json():null).then(status=>{
    if(status?.ready){
      a.href='/neon/?crossfire';a.target='_self';a.removeAttribute('rel');
      a.textContent='WALK NEON ZENITH IN CROSSFIRE ↗';
    }
  }).catch(()=>{});
}
