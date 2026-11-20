import {readFile} from 'node:fs/promises';
export async function localEnv(){
  const text=await readFile(new URL('../.env.local',import.meta.url),'utf8');
  return Object.fromEntries(text.split(/\r?\n/).map(line=>line.match(/^([A-Z0-9_]+)[ \t]*=[ \t]*(.*)$/)).filter(Boolean).map(([,key,value])=>[key,value.replace(/^(['"])(.*)\1$/,'$2')]));
}
