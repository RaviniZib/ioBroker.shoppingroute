'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const ioPackage=JSON.parse(fs.readFileSync(path.join(root,'io-package.json'),'utf8'));
const jsonConfig=JSON.parse(fs.readFileSync(path.join(root,'admin','jsonConfig.json'),'utf8'));

test('beta version and branding are consistent',()=>{
  assert.equal(ioPackage.common.version,'0.2.0-beta.5');
  assert.equal(ioPackage.common.titleLang.de,'ShoppingRoute');
  assert.equal(ioPackage.common.icon,'shoppingroute.png');
  assert.ok(fs.existsSync(path.join(root,'admin',ioPackage.common.icon)));
});

test('new admin areas are present',()=>{
  for(const tab of ['listsTab','productGroupsTab','routesTab','productsTab','reviewTab','transferTab','diagnosticsTab']) assert.ok(jsonConfig.items[tab],tab);
});

test('known instances, lists, markets and product groups use dropdown controls',()=>{
  const general=jsonConfig.items.general.items;
  assert.equal(general.alexaInstance.type,'instance');
  assert.equal(general.alexaInstance.adapter,'alexa2');
  assert.equal(general.alexaInstance.onlyEnabled,true);
  assert.equal(general.fallbackMarket.type,'selectSendTo');
  assert.equal(general.priorityMarket.type,'selectSendTo');
  const listFields=jsonConfig.items.listsTab.items.lists.items;
  assert.equal(listFields.find(x=>x.attr==='name').type,'selectSendTo');
  assert.equal(listFields.find(x=>x.attr==='name').command,'getAlexaLists');
  const routeFields=jsonConfig.items.routesTab.items.routesExpert.items.routes.items;
  assert.equal(routeFields.find(x=>x.attr==='market').command,'getMarkets');
  assert.equal(routeFields.find(x=>x.attr==='category').command,'getProductGroups');
});

test('product list is sortable by product, group and market',()=>{
  const fields=jsonConfig.items.productsTab.items.products.items;
  for(const attr of ['name','category','defaultMarket']) assert.equal(fields.find(x=>x.attr===attr).sort,true);
});

test('multiple lists, review queue, API protection and diagnostics states exist',()=>{
  const ids=new Set(ioPackage.instanceObjects.map(o=>o._id));
  for(const id of ['info.reviewQueue','info.previewText','info.statistics','info.configExport','info.marketProfiles','info.versionInstalled','info.versionBeta','info.feedbackReport','control.temporaryPriorityMarket','control.importConfigJson','control.marketProfileImport']) assert.ok(ids.has(id),id);
  assert.ok(Array.isArray(ioPackage.native.lists));
  assert.equal(ioPackage.native.apiSafeMode,true);
});

test('dynamic dropdown handlers sort alphabetically',()=>{
  const source=fs.readFileSync(path.join(root,'src','main.ts'),'utf8');
  assert.match(source,/getProductGroups[\s\S]*localeCompare\(b\.label/);
  assert.match(source,/getMarkets[\s\S]*localeCompare\(b\.label/);
});

test('closed beta project remains private and package builder exists',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal(pkg.private,true);
  assert.equal(pkg.license,'SEE LICENSE IN LICENSE');
  assert.ok(fs.existsSync(path.join(root,'scripts','make-closed-beta-package.js')));
});

test('walking routes use a focused one-market editor and keep a collapsed expert fallback',()=>{
  const routes=jsonConfig.items.routesTab.items;
  assert.equal(routes.routeEditor.type,'custom');
  assert.equal(routes.routeEditor.url,'custom/routeEditor.js');
  assert.equal(routes.routeEditor.name,'ShoppingRouteAdminSet/Components/RouteEditor');
  assert.equal(routes.routesExpert.type,'accordion');
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.match(pkg.scripts['build:admin'],/browserify/);
  assert.ok(fs.existsSync(path.join(root,'src-admin','route-editor.js')));
});

test('API protection is integrated into General and no longer has its own tab',()=>{
  const general=jsonConfig.items.general.items;
  assert.equal(jsonConfig.items.apiTab,undefined);
  for(const key of ['apiSafeMode','maxWritesPerMinute','batchSize','batchPauseMs','maxWriteRetries','retryBaseMs']) assert.ok(general[key],key);
});

test('market terminology distinguishes normal default from current-shopping override',()=>{
  const general=jsonConfig.items.general.items;
  assert.equal(general.priorityMarket.label.de,'Standardmarkt für Einkäufe');
  assert.equal(general.temporaryMarketState.label.de,'Markt für aktuellen Einkauf');
});

test('Alexa list discovery scans actual list objects instead of configured names only',()=>{
  const source=fs.readFileSync(path.join(root,'src','main.ts'),'utf8');
  assert.match(source,/discoverAlexaLists/);
  assert.match(source,/getForeignObjectsAsync\(`\$\{instance\}\.Lists\.\*\.json`/);
  assert.match(source,/getAlexaLists/);
});

test('ioBroker checker metadata is present',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.ok(pkg.keywords.includes('ioBroker'));
  assert.equal(pkg.devDependencies['@iobroker/testing'],'5.2.2');
  assert.equal(ioPackage.common.type,'logic');
  assert.equal(ioPackage.common.tier,3);
  assert.ok(ioPackage.common.extIcon);
  assert.ok(Array.isArray(ioPackage.common.globalDependencies));
  assert.equal(jsonConfig.i18n,false);
  assert.equal('main' in ioPackage.common,false);
  for(const lang of ['en','de','ru','pt','nl','fr','it','es','pl','uk','zh-cn']) {
    assert.ok(ioPackage.common.titleLang[lang],`titleLang ${lang}`);
    assert.ok(ioPackage.common.desc[lang],`desc ${lang}`);
  }
});

test('adapter source uses adapter-managed timers',()=>{
  const source=fs.readFileSync(path.join(root,'src','main.ts'),'utf8');
  assert.doesNotMatch(source,/(^|[^.A-Za-z])setTimeout\s*\(/m);
  assert.doesNotMatch(source,/(^|[^.A-Za-z])setInterval\s*\(/m);
  assert.match(source,/this\.setTimeout\(/);
  assert.match(source,/this\.setInterval\(/);
  assert.match(source,/private sortTimer: ioBroker\.Timeout \| null \| undefined/);
  assert.match(source,/private versionTimer: ioBroker\.Interval \| null \| undefined/);
});
