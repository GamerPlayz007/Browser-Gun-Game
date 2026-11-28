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

/** Reassemble byte-perfect GLB chunks for large original artwork.
 * Chunks are static public repository files, not network game data.
 * Sequential fetches keep peak download/network memory bounded.
 */
export async function readSplitAssetBytes(parts,{signal,maxBytes=65_000_000,fetchImpl=fetch}={}){
 if(!Array.isArray(parts)||parts.length<2||parts.length>16)throw Error('Invalid split GLB manifest');
 const chunks=[];let length=0;
 for(const url of parts){
  if(typeof url!=='string'||!url.startsWith('/static/assets/'))throw Error('Untrusted GLB chunk path');
  const buffer=await readAssetBytes(url,{signal,maxBytes:maxBytes-length,fetchImpl});
  length+=buffer.byteLength;
  if(length>maxBytes)throw Error('Combined GLB exceeds download budget');
  chunks.push(new Uint8Array(buffer));
 }
 const result=new Uint8Array(length);let offset=0;
 for(const piece of chunks){result.set(piece,offset);offset+=piece.byteLength;}
 return result.buffer;
}
