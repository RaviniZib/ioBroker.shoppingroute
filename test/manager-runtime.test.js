'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const {Components:{CatalogManager}}=require('../src-admin/catalog-manager');

test('ShoppingRoute exposes a per-instance JSON admin tab for runtime management',()=>{
 const io=JSON.parse(fs.readFileSync(path.join(root,'io-package.json'),'utf8'));
 assert.equal(io.common.adminTab.singleton,false);
 assert.equal(io.common.adminTab.link,'jsonTab.json');
 const tab=JSON.parse(fs.readFileSync(path.join(root,'admin','jsonTab.json'),'utf8'));
 assert.equal(tab.items.manager.type,'custom');
 assert.equal(tab.items.manager.guiApi,2);
 assert.equal(tab.items.manager.name,'ShoppingRouteCatalogSet/Components/CatalogManager');
});

test('managed catalogues are persisted outside native instance config',()=>{
 const io=JSON.parse(fs.readFileSync(path.join(root,'io-package.json'),'utf8'));
 assert.ok(io.instanceObjects.some(x=>x._id==='data.managedConfig'&&x.common.role==='json'));
 const source=fs.readFileSync(path.join(root,'src','main.ts'),'utf8');
 assert.match(source,/data\.managedConfig/);
 assert.match(source,/getManagedConfig/);
 assert.match(source,/saveManagedConfig/);
 assert.match(source,/applyManagedConfig/);
});

test('catalogue manager provides all planned management areas and runtime save',()=>{
 const source=fs.readFileSync(path.join(root,'src-admin','catalog-manager.js'),'utf8');
 for(const token of ['shopping','products','markets','groups','routes','lists','review']) assert.match(source,new RegExp(token));
 assert.match(source,/saveManagedConfig/);
 assert.match(source,/getManagedConfig/);
 assert.match(source,/ShoppingListEditor/);
 assert.match(source,/position:sticky/);
 assert.match(source,/\.srm-head\{[^}]*width:100%/);
 assert.match(source,/\.srm-content\{[^}]*max-width:1500px/);
 assert.match(source,/srm-logo/);
 assert.match(source,/srm-headgrid/);
 assert.match(source,/width:315px/);
 assert.match(source,/nth-child\(odd\)/);
 assert.match(source,/shoppingroute-market-column/);
 assert.match(source,/shoppingroute\.png/);
 assert.match(source,/BEDIENUNGSANLEITUNG_DE\.md/);
 assert.match(source,/USER_GUIDE_EN\.md/);
 assert.match(source,/adminLanguage/);
});

test('catalogue manager has a dedicated module federation build',()=>{
 const script=fs.readFileSync(path.join(root,'scripts','build-admin.js'),'utf8');
 assert.match(script,/vite\.catalog-manager\.config\.mjs/);
 assert.match(script,/ShoppingRouteCatalogSet/);
 assert.ok(fs.existsSync(path.join(root,'vite.catalog-manager.config.mjs')));
 assert.ok(fs.existsSync(path.join(root,'src-admin','catalog-manager-components.mjs')));
});


test('runtime normalization uppercases market names and all market references',()=>{
 const source=fs.readFileSync(path.join(root,'src','main.ts'),'utf8');
 assert.match(source,/normalizeMarketName/);
 assert.match(source,/name: up\(x\?\.name\)/);
 assert.match(source,/market: up\(x\?\.market\)/);
 assert.match(source,/defaultMarket: up\(x\?\.defaultMarket\)/);
 assert.match(source,/priorityMarket: up\(x\?\.priorityMarket\)/);
});

test('catalogue changes save automatically instead of remaining local drafts',async()=>{
 for(const key of ['lists','markets','productGroups','products']){
  const calls=[],data={lists:[{name:'SHOP'}],markets:[{name:'ALDI'}],productGroups:[{name:'Food'}],products:[{name:'Milk'}]};
  const manager=new CatalogManager({socket:{sendTo:async(_instance,command,message)=>{calls.push({command,message});return {ok:true,data:message.data,savedAt:'now'};}}});
  manager.state={...manager.state,data:structuredClone(data),base:structuredClone(data),loading:false};
  manager.setState=(patch,done)=>{manager.state={...manager.state,...(typeof patch==='function'?patch(manager.state):patch)};if(done)done();};
  manager.del(key,0);
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(calls.length,1,key);
  assert.equal(calls[0].command,'saveManagedConfig');
  assert.deepEqual(calls[0].message.data[key],[]);
  assert.equal(manager.changed(),false);
  manager.componentWillUnmount();
 }
});
