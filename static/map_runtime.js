/**
 * CROSSFIRE map runtime router.
 *
 * A SINGLE CROSSFIRE document owns the page and room selection.
 * Daybreak uses the existing WebGL renderer. Neon Zenith is loaded as an
 * original-source map module with its native WebGPU/TSL scene and shaders.
 * We do not start the Daybreak renderer when Neon Zenith was chosen.
 * No iframe, external site or replacement low-fidelity map geometry.
 */
const params=new URLSearchParams(location.search);
const isNeon=params.get('map')==='neon_zenith' && params.has('crossfire-mp');

async function bootNeonMap(){
  document.title='CROSSFIRE · Neon Zenith';
  document.body.classList.add('cf-native-map');
  // Main CROSSFIRE front-end is the host; the native map can mount and
  // unmount without duplicating the WebGL game's expensive renderer.
  const hidden=['viewport','shade','damage','home','hud','room-panel',
    'death','scoreboard','results','toast'];
  for(const id of hidden){
    const el=document.getElementById(id);
    if(el)el.hidden=true;
  }
  const shell=document.createElement('div');
  shell.id='cf-native-root';
  const canvas=document.createElement('canvas');
  canvas.id='gl';
  const ui=document.createElement('div');
  ui.id='ui';
  ui.innerHTML='<div id="fade"></div><div id="loader" class="boot"><div class="lw">'+
    '<div class="lt"><b>NEON ZENITH</b> · CROSSFIRE MAP</div>'+
    '<div class="bar"><i></i></div><div class="st">INITIALIZING ORIGINAL CITY</div>'+
    '<a class="src" href="/" style="display:block;margin-top:20px;color:#64d9e2">RETURN TO CROSSFIRE LOBBY</a>'+
    '</div></div>';
  shell.append(canvas,ui);document.body.append(shell);
  const style=document.createElement('style');
  style.textContent=`
  body.cf-native-map {background:#04040a!important}
  body.cf-native-map #cf-native-root{position:fixed;inset:0;z-index:2}
  body.cf-native-map #cf-native-root #gl{position:fixed;inset:0;display:block;width:100vw;height:100vh}
  body.cf-native-map #cf-native-root #ui{position:fixed;inset:0;pointer-events:none}
  body.cf-native-map #cf-native-root #loader{pointer-events:auto}
  `;
  document.head.append(style);

  // The original Neon bundle is content-hashed after every upstream build.
  // Locate it from the actual imported map manifest, never hardcode a hash.
  const response=await fetch('/neon/index.html',{cache:'no-cache'});
  if(!response.ok)throw Error('Native Neon Zenith environment is not installed on this server.');
  const source=await response.text();
  const doc=new DOMParser().parseFromString(source,'text/html');
  const asset=doc.querySelector('script[type="module"][src]')?.getAttribute('src');
  const css=doc.querySelector('link[rel="stylesheet"][href]')?.getAttribute('href');
  if(!asset?.startsWith('/neon/assets/')||!css?.startsWith('/neon/assets/')){
    throw Error('Original Neon Zenith bundle manifest could not be read.');
  }
  const stylesheet=document.createElement('link');
  stylesheet.rel='stylesheet';
  stylesheet.href=css;
  document.head.append(stylesheet);
  await new Promise((resolve,reject)=>{
    stylesheet.addEventListener('load',resolve,{once:true});
    stylesheet.addEventListener('error',()=>reject(Error('Unable to load native city styling')),{once:true});
  });
  // DOM already has the original scene's canvas and loading UI. Runtime
  // executes in this SAME CROSSFIRE page, not a separate /neon document.
  await import(asset);
}
async function start(){
  if(isNeon){
    try{await bootNeonMap();}
    catch(error){
      console.error('CROSSFIRE original map failed:',error);
      document.querySelector('#cf-native-root #loader .st')?.replaceChildren(
        document.createTextNode('NATIVE MAP FAILED: '+(error.message||String(error))));
    }
  }else{
    await import('/static/game.js');
  }
}
start();
