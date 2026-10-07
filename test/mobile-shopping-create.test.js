'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const { Components: { ShoppingListEditor } } = require('../src-admin/shopping-list-editor');
function elements(tree) { return !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(elements)]; }
function runtimeFixture() {
    class Adapter extends EventEmitter {
        constructor() { super(); this.config = { dryRun: false, lists: [{ name: 'SHOP' }], markets: [{name: 'REWE'}] }; this.log = { info() {}, debug() {}, warn() {}, error() {} }; }
        async getStateAsync() { return { val: true }; }
        async setStateAsync() {}
        setTimeout(fn, ms) { return setTimeout(fn, ms); }
        clearTimeout(timer) { clearTimeout(timer); }
    }
    const filename = path.join(__dirname, '../build/main.js');
    const runtime = new Module(filename, module);
    const realRequire = Module.createRequire(filename);
    runtime.filename = filename;
    runtime.require = id => id === '@iobroker/adapter-core' ? { Adapter } : realRequire(id);
    runtime._compile(fs.readFileSync(filename, 'utf8'), filename);
    const adapter = runtime.exports({});
    for (const method of ['persistRuntimeConfig', 'refreshExports', 'updateFeedbackReport', 'persistManualOverrides']) adapter[method] = async () => {};
    adapter.getStateAsync = async () => ({ val: '' });
    adapter.logDirectRuntime = () => {};
    return adapter;
}


test('missing Alexa list never stops another configured list', async () => {
 const a=runtimeFixture();a.config.lists=[{name:'Missing'},{name:'SHOP'}];a.directClient={getLists:async()=>[{name:'SHOP',listId:'shop'}]};let stops=0,applies=[];
 a.activateDirectSafetyStop=async()=>{stops++};a.applyDirectSort=async name=>{await a.directListId(name);applies.push(name)};
 a.prepareImmediateApply('Missing');await a.startApply('Missing');a.prepareImmediateApply('SHOP');await a.startApply('SHOP');assert.equal(stops,0);assert.deepEqual(applies,['SHOP']);
});
test('poll skips missing bindings and still observes the healthy list', async () => {
 const a=runtimeFixture();a.config.lists=[{name:'Missing'},{name:'SHOP'}];a.directClient={getLists:async()=>[{name:'SHOP',listId:'shop'}]};a.readDirectItems=async()=>[];let seen=[];
 a.observeListState=name=>seen.push(name);a.armDirectPoll=()=>{};a.isEnabled=async()=>true;await a.runDirectPoll();assert.deepEqual(seen,['SHOP']);
});
test('invalid new binding is rejected before config mutation or scheduling', async()=>{
 const a=runtimeFixture();a.directClient={getLists:async()=>[{name:'SHOP',listId:'shop'}]};let scheduled=0;a.scheduleAll=()=>scheduled++;const before=JSON.stringify(a.config);
 await assert.rejects(a.applyManagedConfig({...a.config,lists:[{name:'Missing',enabled:true}]}),/does not exist/);assert.equal(JSON.stringify(a.config),before);assert.equal(scheduled,0);
});
test('adding an item verifies its exact ID and schedules observation',async()=>{
 const a=runtimeFixture();a.directListId=async()=> 'shop';let reads=0,writes=0,observed=0;
 a.readDirectItems=async()=>++reads===1?[]:[{id:'new',value:'Milch',completed:false}];a.directClient={batchCreate:async(id,values)=>{writes++;assert.equal(id,'shop');assert.deepEqual(values,['Milch']);return {items:[{itemId:'new'}]}}};
 a.isEnabled=async()=>true;a.beforeDirectWrite=async()=>{};a.recordDirectWrite=async()=>{};a.observeListState=()=>observed++;a.buildShoppingListView=async()=>({});
 assert.equal((await a.addShoppingItem({listName:'SHOP',text:' Milch '})).ok,true);assert.equal(writes,1);assert.equal(observed,1);
 a.config.dryRun=true;await assert.rejects(a.addShoppingItem({listName:'SHOP',text:'Eier'}),/Dry Run/);assert.equal(writes,1);
});
test('ambiguous item creation is never retried or reported as success',async()=>{
 const a=runtimeFixture();a.directListId=async()=> 'shop';a.readDirectItems=async()=>[];a.isEnabled=async()=>true;a.beforeDirectWrite=async()=>{};let writes=0,stops=0;
 a.directClient={batchCreate:async()=>{writes++;throw Error('timeout')}};a.activateDirectSafetyStop=async()=>stops++;
 await assert.rejects(a.addShoppingItem({listName:'SHOP',text:'Milch'}),/timeout/);assert.equal(writes,1);assert.equal(stops,1);
});
test('empty mobile list offers Add and duplicate taps issue one request',async()=>{
 let resolve;const response=new Promise(r=>resolve=r),calls=[];const e=new ShoppingListEditor({socket:{sendTo:async(...args)=>{calls.push(args);return response}}});
 e.state={view:{listName:'SHOP',lists:['SHOP'],markets:[],items:[],dryRun:false},loading:false,busy:'',newItem:'Milch'};e.setState=p=>Object.assign(e.state,p);
 assert.ok(elements(e.render()).some(n=>n.key==='add-item'));
 const first=e.addItem(),second=e.addItem();assert.equal(calls.length,1);assert.equal(calls[0][1],'addShoppingItem');resolve({ok:false,error:'failure'});await Promise.all([first,second]);assert.equal(e.state.newItem,'Milch');assert.equal(e.state.error,'failure');
});
test('confirmed list creation immediately persists its managed binding', async()=>{
 const a=runtimeFixture();a.directClient={getLists:async()=>[{name:'Popel',listId:'popel'}],createList:async()=>({name:'Popel',listId:'popel'})};a.beforeDirectWrite=async()=>{};let saved;
 a.applyManagedConfig=async data=>{saved=data;return {data,savedAt:'now'}};
 const result=await a.createAlexaList({name:'Popel'});assert.equal(result.ok,true);assert.ok(saved.lists.some(row=>row.name==='Popel'&&row.enabled));assert.equal(result.savedAt,'now');
});
