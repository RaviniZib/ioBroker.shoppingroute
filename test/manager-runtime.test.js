'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

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
});

test('catalogue manager has a dedicated module federation build',()=>{
 const script=fs.readFileSync(path.join(root,'scripts','build-admin.js'),'utf8');
 assert.match(script,/vite\.catalog-manager\.config\.mjs/);
 assert.match(script,/ShoppingRouteCatalogSet/);
 assert.ok(fs.existsSync(path.join(root,'vite.catalog-manager.config.mjs')));
 assert.ok(fs.existsSync(path.join(root,'src-admin','catalog-manager-components.mjs')));
});
