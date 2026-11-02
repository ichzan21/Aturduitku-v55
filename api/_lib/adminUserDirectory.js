import { createHash } from 'node:crypto';
import { FieldPath } from 'firebase-admin/firestore';

export const ADMIN_FIELDS = [
  'email','displayName','photoURL','role','approvalStatus','authProvider',
  'buyerEmail','orderId','createdAt','lastLoginAt','lastSeenAt','reviewedAt',
  'reviewedBy','approvedAt','approvedBy','adminNotes','passwordUpdatedAt','passwordUpdatedBy',
];
const statuses=['pending_review','approved','rejected'];
const caches=new WeakMap();
const badRequest=()=>Object.assign(new Error('Parameter halaman pengguna tidak valid. Muat ulang daftar.'),{status:400});
export const toAdminUser=doc=>{
  const data=doc.data()||{};
  return Object.fromEntries([['uid',doc.id],...ADMIN_FIELDS.filter(key=>data[key]!==undefined).map(key=>[key,data[key]])]);
};

function cacheFor(db) {
  if(!caches.has(db)) caches.set(db,{generation:0,stats:null,statsRequest:null,pages:new Map()});
  return caches.get(db);
}
export function invalidateAdminDirectory(db) {
  const cache=cacheFor(db);
  cache.generation++;
  cache.stats=null;
  cache.statsRequest=null;
  cache.pages.clear();
}

function parseOptions(input) {
  const status=input.status||'all',query=String(input.q||'').trim(),searchBy=input.searchBy||'email';
  if(!['all',...statuses].includes(status)||!['email','name','order'].includes(searchBy)||query.length>120) throw badRequest();
  const limit=Number(input.limit||8);
  if(!Number.isInteger(limit)||limit<1||limit>25||query&&query.length<2) throw badRequest();
  const normalized=searchBy==='email'?query.toLowerCase():query;
  const signature=createHash('sha256').update(JSON.stringify([status,normalized,searchBy,limit])).digest('hex').slice(0,24);
  let streams;
  if(!normalized) streams=[{field:null,prefix:''}];
  else if(searchBy==='email') streams=['email','buyerEmail'].map(field=>({field,prefix:normalized}));
  else if(searchBy==='order') streams=[{field:'orderId',prefix:normalized}];
  else {
    const title=normalized.toLowerCase().replace(/(^|\s)\S/g,value=>value.toUpperCase());
    streams=[...new Set([normalized,normalized.toLowerCase(),normalized.toUpperCase(),title])].map(prefix=>({field:'displayName',prefix}));
  }
  let positions=streams.map(()=>null),done=streams.map(()=>false);
  if(input.cursor) {
    try {
      if(typeof input.cursor!=='string'||input.cursor.length>4096) throw badRequest();
      const parsed=JSON.parse(Buffer.from(input.cursor,'base64url').toString());
      if(parsed.signature!==signature||!Array.isArray(parsed.positions)||parsed.positions.length!==streams.length||!Array.isArray(parsed.done)||parsed.done.length!==streams.length) throw badRequest();
      for(const position of parsed.positions) if(position!==null&&(!position||typeof position.id!=='string'||!position.id||position.id.length>1500||position.id.includes('/')||typeof position.value!=='string'||position.value.length>1000)) throw badRequest();
      if(parsed.done.some(value=>typeof value!=='boolean')) throw badRequest();
      ({positions,done}=parsed);
    } catch {throw badRequest();}
  }
  return {status,query:normalized,searchBy,limit,signature,streams,positions,done};
}

async function readStats(db,cache,force) {
  if(!force&&cache.stats&&cache.stats.expires>Date.now()) return cache.stats.value;
  if(cache.statsRequest) return cache.statsRequest;
  const generation=cache.generation;
  const users=db.collection('users');
  const request=Promise.all([users,...statuses.map(status=>users.where('approvalStatus','==',status))].map(query=>query.count().get())).then(results=>{
    const [total,pending_review,approved,rejected]=results.map(result=>Number(result.data().count)||0);
    const value={total,pending_review,approved,rejected};
    if(cache.generation===generation) cache.stats={value,expires:Date.now()+60000};
    return value;
  }).finally(()=>{if(cache.statsRequest===request) cache.statsRequest=null;});
  cache.statsRequest=request;
  return request;
}

async function readPage(db,options) {
  const {streams,status,limit,positions,done}=options;
  const rows=await Promise.all(streams.map(async(stream,index)=>{
    if(done[index]) return [];
    let query=db.collection('users');
    if(stream.field) query=query.where(stream.field,'>=',stream.prefix).where(stream.field,'<=',stream.prefix+'\uf8ff').orderBy(stream.field).orderBy(FieldPath.documentId());
    else {
      if(status!=='all') query=query.where('approvalStatus','==',status);
      query=query.orderBy(FieldPath.documentId());
    }
    if(positions[index]) query=query.startAfter(...(stream.field?[positions[index].value,positions[index].id]:[positions[index].id]));
    const snapshot=await query.select(...ADMIN_FIELDS).limit(limit+1).get();
    return snapshot.docs.map(doc=>({user:toAdminUser(doc),value:stream.field?String(doc.data()[stream.field]||''):doc.id}));
  }));
  const exhausted=rows.map((queue,index)=>done[index]||queue.length<limit+1);
  const consume=index=>{
    const row=rows[index].shift();
    positions[index]={id:row.user.uid,value:row.value};
    return row.user;
  };
  const eligible=(user,index)=>{
    if(status!=='all'&&(user.approvalStatus||'pending_review')!==status) return false;
    // A user matching both email fields belongs to the first matching stream only.
    return !streams.slice(0,index).some(stream=>stream.field&&String(user[stream.field]||'').startsWith(stream.prefix));
  };
  const users=[];
  while(users.length<limit) {
    for(let index=0;index<rows.length;index++) while(rows[index].length&&!eligible(rows[index][0].user,index)) consume(index);
    const available=rows.map((queue,index)=>queue.length?index:-1).filter(index=>index>=0);
    if(!available.length) break;
    available.sort((a,b)=>rows[a][0].value<rows[b][0].value?-1:rows[a][0].value>rows[b][0].value?1:rows[a][0].user.uid.localeCompare(rows[b][0].user.uid));
    users.push(consume(available[0]));
  }
  for(let index=0;index<rows.length;index++) {
    while(rows[index].length&&!eligible(rows[index][0].user,index)) consume(index);
    done[index]=exhausted[index]&&!rows[index].length;
  }
  const hasMore=done.some(value=>!value);
  const nextCursor=hasMore?Buffer.from(JSON.stringify({signature:options.signature,positions,done})).toString('base64url'):null;
  return {users,pagination:{hasMore,nextCursor,pageSize:limit}};
}

export async function listAdminUsers(db,input={}) {
  const options=parseOptions(input),cache=cacheFor(db),force=input.refresh==='1';
  const key=JSON.stringify([options.signature,input.cursor||'']);
  let entry=cache.pages.get(key);
  if(force||!entry||entry.expires<=Date.now()) {
    if(entry?.pending) return entry.promise;
    const generation=cache.generation;
    entry={pending:true,expires:Date.now()+15000};
    entry.promise=Promise.all([readPage(db,options),readStats(db,cache,force)]).then(([page,stats])=>({ok:true,...page,stats}));
    cache.pages.set(key,entry);
    entry.promise.then(()=>{entry.pending=false;if(cache.generation!==generation&&cache.pages.get(key)===entry) cache.pages.delete(key);},()=>{if(cache.pages.get(key)===entry) cache.pages.delete(key);});
    while(cache.pages.size>64) cache.pages.delete(cache.pages.keys().next().value);
  }
  return entry.promise;
}
