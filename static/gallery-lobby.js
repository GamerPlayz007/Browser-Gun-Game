import {chooseGalleryFinish} from './gallery-assets.js';
import {safeRead56,safeWrite56} from './preferences56.js';

const selector=document.getElementById('gallery-finish6');
const link=document.getElementById('gallery-open6');
if(selector&&link){
 const key='cf-gallery-finish';
 selector.value=chooseGalleryFinish(safeRead56(key,'midnight'));
 function update(){
  const finish=chooseGalleryFinish(selector.value);
  const query=new URLSearchParams({finish,profile:'performance'});
  link.href='/static/aether9-pbr-showroom.html?'+query.toString();
  safeWrite56(key,finish);
 }
 selector.addEventListener('change',update);
 update();
}
