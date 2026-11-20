import {S3Client,GetObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
export function allowedMediaPath(path){
 if(path==='study-content/modules.json')return true;
 return typeof path==='string'&&path.length<=160&&(/^(M(?:0[1-9]|1[0-7]))\/\1(?:_sprint|_blitz)?\.(?:mp4|vtt)$/.test(path)||/^course\/(?:full|sprint|blitz)\/(?:index\.m3u8|init\.mp4|captions\.vtt|segment-\d{1,6}\.m4s)$/.test(path));
}
export function mediaSigner(env){
 const endpoint=new URL(env.R2_ENDPOINT);
 if(endpoint.protocol!=='https:'||!endpoint.hostname.endsWith('.r2.cloudflarestorage.com')||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||!['','/'].includes(endpoint.pathname))throw Error('Invalid media endpoint');
 if(!env.R2_ACCESS_KEY_ID||!env.R2_SECRET_ACCESS_KEY||!env.R2_BUCKET_NAME)throw Error('Media credentials missing');
 const client=new S3Client({region:'auto',endpoint:endpoint.origin,credentials:{accessKeyId:env.R2_ACCESS_KEY_ID,secretAccessKey:env.R2_SECRET_ACCESS_KEY}});
 return async path=>getSignedUrl(client,new GetObjectCommand({Bucket:env.R2_BUCKET_NAME,Key:path}),{expiresIn:21600});
}
export function makeMediaHandler({env=process.env,fetcher=fetch,signer}={}){
 let sign;
 return async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const reply=(code,message)=>res.status(code).json({error:message});
  if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(405,'Use POST');}
  const token=req.headers?.authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if(!token||token.length>8192)return reply(401,'Sign in required');
  let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return reply(400,'Invalid request');}
  const paths=body?.paths;
  if(!Array.isArray(paths)||!paths.length||paths.length>100||!paths.every(allowedMediaPath))return reply(400,'Invalid media paths');
  if(paths.includes('study-content/modules.json')&&env.R2_CONTENT_ENABLED!=='true')return reply(503,'Study delivery is not configured');
  const url=env.SUPABASE_URL||env.NEXT_PUBLIC_SUPABASE_URL,key=env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key||env.R2_MEDIA_ENABLED!=='true')return reply(503,'Media service is not configured');
  try{
   const auth=await fetcher(url.replace(/\/$/,'')+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
   if(auth.status===401||auth.status===403)return reply(401,'Session expired. Sign in again.');
   if(!auth.ok)return reply(503,'Sign-in verification is temporarily unavailable');
   const user=await auth.json();if(!user?.id)return reply(401,'Sign in required');
   sign||=signer||mediaSigner(env);
   const data=await Promise.all(paths.map(async path=>({path,signedUrl:await sign(path)})));
   return res.status(200).json({data});
  }catch{return reply(503,'Media service is temporarily unavailable');}
 };
}
