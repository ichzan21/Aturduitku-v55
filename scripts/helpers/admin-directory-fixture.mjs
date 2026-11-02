import assert from 'node:assert/strict';

export function directoryFixture(size=1207) {
  const records=Array.from({length:size},(_,index)=>({id:`qa-${String(index).padStart(5,'0')}`,value:{displayName:`Customer ${index}`,email:`user${String(index).padStart(5,'0')}@example.invalid`,approvalStatus:index%3===0?'pending_review':index%3===1?'approved':'rejected',role:'user',data:{private:'must never return'}}}));
  const usage={reads:0,queries:0,counts:0,maxLimit:0};
  class Query {
    constructor(filters=[],orders=[],after=[],fields=null,take=null){Object.assign(this,{filters,orders,after,fields,take});}
    clone(patch){return Object.assign(new Query(),this,patch);}
    where(field,op,value){return this.clone({filters:[...this.filters,[field,op,value]]});}
    orderBy(field){return this.clone({orders:[...this.orders,String(field)]});}
    startAfter(...after){return this.clone({after});}
    select(...fields){assert.ok(!fields.includes('data'));return this.clone({fields});}
    limit(take){assert.ok(take<=26);return this.clone({take});}
    matching(){return records.filter(record=>this.filters.every(([field,op,value])=>op==='=='?record.value[field]===value:op==='>='?record.value[field]>=value:record.value[field]<=value));}
    count(){return {get:async()=>{usage.counts++;return {data:()=>({count:this.matching().length})};}};}
    async get(){
      assert.ok(this.take,'Every document query must have a server limit');
      assert.ok(this.fields,'Project admin metadata only');
      usage.queries++;usage.maxLimit=Math.max(usage.maxLimit,this.take);
      const tuple=record=>this.orders.map(field=>field==='__name__'?record.id:record.value[field]);
      const compare=(a,b)=>{for(let index=0;index<a.length;index++){if(a[index]<b[index])return -1;if(a[index]>b[index])return 1;}return 0;};
      const selected=this.matching().sort((a,b)=>compare(tuple(a),tuple(b))).filter(record=>!this.after.length||compare(tuple(record),this.after)>0).slice(0,this.take);
      usage.reads+=selected.length;
      return {docs:selected.map(record=>({id:record.id,data:()=>Object.fromEntries(this.fields.filter(key=>record.value[key]!==undefined).map(key=>[key,record.value[key]]))}))};
    }
  }
  return {db:{collection(name){assert.equal(name,'users');return new Query();}},records,usage};
}
