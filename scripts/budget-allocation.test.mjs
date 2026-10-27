import assert from 'node:assert/strict';
import { getBudgetAllocation } from '../src/budgetAllocation.js';

const transport = {alokasi:'200000',sub:[{nama:'Ganti Oli',alokasi:'100000'}]};
const before = JSON.stringify(transport);
assert.deepEqual(getBudgetAllocation(transport,211000), {
  main:200000,subcategories:100000,total:300000,used:211000,remaining:89000,
  excess:0,percent:211000/300000*100,over:false,unallocated:false,
});
assert.equal(JSON.stringify(transport),before,'Clarifying totals must not migrate or change saved allocations');
const over = getBudgetAllocation({alokasi:'500000'},596000);
assert.equal(over.over,true);
assert.equal(over.excess,96000);
assert.equal(over.percent.toFixed(0),'119');
assert.equal(over.remaining,0);
assert.equal(getBudgetAllocation({alokasi:'500000'},500000).over,false);
assert.equal(getBudgetAllocation({alokasi:'0'},1000).unallocated,true);
assert.equal(getBudgetAllocation({alokasi:'0'},0).percent,0);
assert.equal(getBudgetAllocation({alokasi:'200.000',sub:[{alokasi:'100.000'}]},'211.000').remaining,89000);
assert.equal(getBudgetAllocation({alokasi:'0',sub:[{alokasi:'100000'},{alokasi:'200000'}]},211000).total,300000);
console.log('Budget allocation and over-budget explanation tests passed');
