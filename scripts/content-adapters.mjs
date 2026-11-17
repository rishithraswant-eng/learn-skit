import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function fixedOptionOrder(items,seed){
  let positions;
  for(let attempt=0;attempt<100;attempt++){
    positions=items.map((_,i)=>({position:i%4,key:hash(seed+':'+attempt+':'+i)})).sort((a,b)=>a.key.localeCompare(b.key)).map(x=>x.position);
    if(!positions.some((p,i)=>i>2&&positions.slice(i-3,i+1).every(x=>x===p)))break;
  }
  return items.map((q,i)=>{const answer=q.options[q.answer];const wrong=Object.entries(q.options).filter(([letter])=>letter!==q.answer).map(([,value])=>value).sort((a,b)=>hash(seed+q.id+a).localeCompare(hash(seed+q.id+b)));const options=[...wrong];options.splice(positions[i],0,answer);return {...q,options:Object.fromEntries(options.map((value,j)=>['ABCD'[j],value])),answer:'ABCD'[positions[i]]};});
}
