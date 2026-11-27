/**
 * The permanent Asset Library controls in CROSSFire's original workshop.
 * Only manipulates the catalog DOM; importing/rendering is done by workshop.js.
 */
import {WORKSHOP_CATALOG,matchCatalog,listPersonalAssets,personalToEntry,removePersonalAsset} from './workshop-library.js';

const $=id=>document.getElementById(id);
const el=(tag,className,text)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
};
const formatSize=bytes=>bytes<1_000_000?(bytes/1000).toFixed(0)+' KB':(bytes/1_000_000).toFixed(1)+' MB';

export function createWorkshopLibraryUI({onOpen,onUnavailable,onDeleteActive,isBusy}){
  let personal=[],selectedId='fox-reference',activeId='fox-reference',storageAvailable=true;
  const all=()=>[...WORKSHOP_CATALOG,...personal.map(personalToEntry)];
  const find=id=>all().find(asset=>asset.id===id)||null;
  function detail(asset){
    const box=$('assetDetail');box.replaceChildren();
    if(!asset){box.append(el('span','asset-muted','No matching asset.'));return}
    box.append(el('strong','asset-detail-title',asset.title));
    box.append(el('div','asset-detail-status',asset.status+' · '+asset.origin));
    box.append(el('p','asset-detail-description',asset.description));
    if(asset.note)box.append(el('p','asset-detail-note',asset.note));
    if(asset.profiles.length){
      const labels=asset.profiles.map(p=>p.label+' ('+formatSize(p.bytes)+')').join(' · ');
      box.append(el('p','asset-detail-formats',labels));
      if(asset.id===activeId)box.append(el('p','asset-detail-active','● ON WORKBENCH'));
    }else box.append(el('p','asset-detail-empty','No standalone GLB available in the repository. The workbench remains on the previously loaded asset.'));
    if(asset.category==='personal'){
      const remove=el('button','asset-delete','REMOVE SAVED COPY');remove.type='button';
      remove.disabled=isBusy();
      remove.addEventListener('click',async()=>{
        if(isBusy())return;
        if(!confirm('Remove this GLB from this browser’s workshop library?'))return;
        try{
          await removePersonalAsset(asset.id);
          if(activeId===asset.id)await onDeleteActive();
          await refresh();selectedId=activeId;render();
        }catch(err){onUnavailable('Could not remove local model: '+err.message)}
      });box.append(remove);
    }
  }
  function render(){
    const assets=matchCatalog(all(),{query:$('assetSearch').value,category:$('assetFilter').value});
    const holder=$('assetCards');holder.replaceChildren();
    $('assetCount').textContent=assets.length+' / '+all().length;
    if(!assets.length)holder.append(el('div','asset-empty','No models match your search.'));
    for(const asset of assets){
      const card=el('button','asset-card');card.type='button';
      if(asset.id===selectedId)card.classList.add('selected');
      if(asset.id===activeId)card.classList.add('loaded');
      card.disabled=isBusy();
      const head=el('div','asset-card-heading');head.append(el('strong','',asset.title));head.append(el('span','asset-card-badge',asset.status));
      card.append(head);
      card.append(el('span','asset-card-sub',asset.category.toUpperCase()+' · '+(asset.profiles.length?asset.profiles.length+' VERSION'+(asset.profiles.length===1?'':'S'):'SOURCE ONLY')));
      card.addEventListener('click',()=>{
        if(isBusy())return;
        selectedId=asset.id;render();
        if(!asset.profiles.length){onUnavailable(asset.title+': no standalone model is available for preview.');return}
        Promise.resolve(onOpen(asset)).catch(e=>onUnavailable('Unable to open model: '+e.message));
      });holder.append(card);
    }
    detail(find(selectedId));
    $('assetStorage').textContent=storageAvailable?'Personal GLBs stay in this browser only.':'Browser storage unavailable; imports can still be previewed temporarily.';
  }
  async function refresh(){
    try{personal=await listPersonalAssets();storageAvailable=true}
    catch(err){personal=[];storageAvailable=false}
    render();return personal;
  }
  $('assetSearch').addEventListener('input',render);
  $('assetFilter').addEventListener('change',render);
  return {
    refresh,
    render,
    getEntry:find,
    getActive:()=>find(activeId),
    getAll:all,
    setActive(id){activeId=selectedId=id;render()},
    selectInfo(id){selectedId=id;render()},
    setBusy(value){for(const button of $('assetCards').querySelectorAll('button'))button.disabled=Boolean(value);const remove=$('assetDetail').querySelector('button');if(remove)remove.disabled=Boolean(value)}
  };
}