/** Generic bounded, cancellable static asset reader. No rendering or gameplay dependencies. */
export async function readAssetBytes(url,{signal,onProgress=()=>{},maxBytes=65_000_000,fetchImpl=fetch}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<=0)throw new RangeError('Invalid asset budget');
 const res=await fetchImpl(url,{signal});
 if(!res.ok)throw Error('HTTP '+res.status);
 const length=Number(res.headers.get('content-length'))||0;
 if(length>maxBytes){await res.body?.cancel();throw Error('Asset exceeds download budget');}
 if(!res.body){
  const bytes=await res.arrayBuffer();
  if(bytes.byteLength>maxBytes)throw Error('Asset exceeds download budget');
  onProgress(bytes.byteLength,length);return bytes;
 }
 const reader=res.body.getReader(),chunks=[];let loaded=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   loaded+=value.byteLength;
   if(loaded>maxBytes){await reader.cancel();throw Error('Asset exceeds download budget');}
   chunks.push(value);onProgress(loaded,length);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(loaded);let offset=0;
 for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength;}
 return bytes.buffer;
}

export function chooseGalleryFinish(raw){
 return ['midnight','glacier','eclipse'].includes(raw)?raw:'midnight';
}
export function chooseGalleryProfile(raw,available){
 return ['performance','balanced','original'].includes(raw)&&available.has(raw)?raw:'original';
}
