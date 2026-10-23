'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const { ShoppingListEditor } = require('../src-admin/shopping-list-editor');
const view = () => ({ listName:'SHOP',lists:['SHOP'],markets:['REWE','LIDL'],dryRun:false,
    items:[{id:'a',text:'Milch',market:'REWE',position:0},{id:'b',text:'Brot',market:'REWE',position:1}] });
function fixture() {
    class Adapter extends EventEmitter {
        constructor() { super(); this.config={dryRun:false,lists:[{name:'SHOP'}],markets:[{name:'REWE'},{name:'LIDL'}]};
            this.log={info(){},warn(){},error(){},debug(){}}; }
        async getStateAsync(){return {val:''};}
        async setStateAsync(){}
        setTimeout(fn,ms){return setTimeout(fn,ms);}
        clearTimeout(t){clearTimeout(t);}
    }
    const filename=path.join(__dirname,'../build/main.js');
    const runtime=new Module(filename,module), realRequire=Module.createRequire(filename);
    runtime.filename=filename;
    runtime.require=id=>id==='@iobroker/adapter-core'?{Adapter}:realRequire(id);
    runtime._compile(fs.readFileSync(filename,'utf8'),filename);
    const adapter=runtime.exports({});
    let applies=0,persists=0,last=[];
    adapter.buildShoppingListView=async()=>view();
    adapter.isEnabled=async()=>true;
    adapter.persistManualOverrides=async()=>{persists++;};
    adapter.startApply=async()=>{applies++;last=structuredClone(adapter.manualOverrides);};
    adapter.prepareImmediateApply=()=>{};
    return {adapter,counts:()=>({applies,persists}),last:()=>last};
}
const moves=[{itemId:'a',itemText:'Milch',targetMarket:'LIDL',targetPosition:0},
    {itemId:'b',itemText:'Brot',targetMarket:'LIDL',targetPosition:0}];
test('all manual corrections produce one apply and preserve their accumulated order',async()=>{
    const f=fixture();
    const result=await f.adapter.applyManualMove({listName:'SHOP',moves});
    assert.equal(result.ok,true);
    assert.deepEqual(f.counts(),{applies:1,persists:1});
    assert.equal(f.last().find(x=>x.itemId==='a').market,'LIDL');
    assert.equal(f.last().find(x=>x.itemId==='a').position,1);
    assert.equal(f.last().find(x=>x.itemId==='b').position,0);
});
test('a stale or ambiguous item rejects the whole batch before any write',async()=>{
    for (const invalid of [{itemId:'missing',itemText:'missing',targetMarket:'LIDL'},
        {itemId:'b',targetMarket:'UNKNOWN'}]) {
        const f=fixture();
        const result=await f.adapter.applyManualMove({listName:'SHOP',moves:[moves[0],invalid]});
        assert.equal(result.ok,false);
        assert.deepEqual(f.counts(),{applies:0,persists:0});
        assert.deepEqual(f.adapter.manualOverrides,[]);
    }
});
test('failed batch restores previous manual overrides',async()=>{
    const f=fixture();
    f.adapter.startApply=async()=>{throw Error('write not confirmed');};
    const result=await f.adapter.applyManualMove({listName:'SHOP',moves});
    assert.equal(result.ok,false);assert.match(result.error,/not confirmed/);
    assert.deepEqual(f.adapter.manualOverrides,[]);
});
test('batch rebinds changed Amazon IDs only by unique product text',async()=>{
    const f=fixture();
    const result=await f.adapter.applyManualMove({listName:'SHOP',moves:[{...moves[0],itemId:'old-id'}]});
    assert.equal(result.ok,true);assert.equal(f.last()[0].itemId,'a');
    const g=fixture();
    g.adapter.buildShoppingListView=async()=>({...view(),items:[...view().items,{id:'c',text:'Milch',market:'REWE',position:2}]});
    assert.equal((await g.adapter.applyManualMove({listName:'SHOP',moves:[{...moves[0],itemId:'old-id'}]})).ok,false);
    assert.equal(g.counts().applies,0);
});
test('draft survives reload and is removed only after confirmed transfer',async()=>{
    const storage=new Map(),previous=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
    Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{
        getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key),
    }});
    const make=()=>{
        const e=new ShoppingListEditor({});
        e.setState=patch=>{e.state={...e.state,...patch};};
        e.send=async()=>view();
        return e;
    };
    try {
        const first=make();await first.load();await first.move('a','LIDL',0);
        assert.equal(storage.size,1);
        const reloaded=make();await reloaded.load();
        assert.equal(reloaded.draftMoves.length,1);assert.equal(reloaded.state.view.items[0].market,'LIDL');
        reloaded.send=async()=>({ok:false,error:'offline'});await reloaded.applyChanges();
        assert.equal(storage.size,1);assert.equal(reloaded.draftMoves.length,1);
        reloaded.send=async()=>({ok:true,view:reloaded.draftView});await reloaded.applyChanges();
        assert.equal(storage.size,0);assert.equal(reloaded.draftMoves.length,0);
    } finally {
        if(previous)Object.defineProperty(globalThis,'sessionStorage',previous);else delete globalThis.sessionStorage;
    }
});
test('dry run cannot stage or send changes',async()=>{
    const e=new ShoppingListEditor({});e.state.view={...view(),dryRun:true};
    e.setState=patch=>{e.state={...e.state,...patch};};
    e.send=async()=>assert.fail('unexpected request');
    await e.move('a','LIDL',0);await e.applyChanges();assert.equal(e.draftMoves.length,0);
});
