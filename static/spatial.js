// Static X/Z broad phase. Preserve authoring order for deterministic prediction.
const indexes=new WeakMap(),CELL=8;
export function nearbyBoxes(boxes,x,z,radius=1){
 let grid=indexes.get(boxes);
 if(!grid){grid=new Map();boxes.forEach((b,i)=>{
  for(let gx=Math.floor((b.x-b.w/2)/CELL);gx<=Math.floor((b.x+b.w/2)/CELL);gx++)
   for(let gz=Math.floor((b.z-b.d/2)/CELL);gz<=Math.floor((b.z+b.d/2)/CELL);gz++){
    const key=gx+','+gz;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);
   }
 });indexes.set(boxes,grid);}
 const ids=new Set();
 for(let gx=Math.floor((x-radius)/CELL);gx<=Math.floor((x+radius)/CELL);gx++)
  for(let gz=Math.floor((z-radius)/CELL);gz<=Math.floor((z+radius)/CELL);gz++)
   for(const i of grid.get(gx+','+gz)||[])ids.add(i);
 return [...ids].sort((a,b)=>a-b).map(i=>boxes[i]);
}
