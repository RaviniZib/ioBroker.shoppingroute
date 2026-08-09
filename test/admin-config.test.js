'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const ioPackage=JSON.parse(fs.readFileSync(path.join(root,'io-package.json'),'utf8'));
const jsonConfig=JSON.parse(fs.readFileSync(path.join(root,'admin','jsonConfig.json'),'utf8'));

test('beta version and branding are consistent',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal(ioPackage.common.version,pkg.version);
  const runtimeSource=fs.readFileSync(path.join(root,'src','main.ts'),'utf8');
  const runtimeVersion=runtimeSource.match(/const VERSION = '([^']+)'/);
  assert.ok(runtimeVersion,'runtime VERSION');
  assert.equal(runtimeVersion[1],pkg.version);
  assert.equal(ioPackage.common.titleLang.de,'ShoppingRoute');
  assert.equal(ioPackage.common.icon,'shoppingroute.png');
  assert.ok(fs.existsSync(path.join(root,'admin',ioPackage.common.icon)));
});

test('user-facing admin areas are present and diagnostics tab is hidden',()=>{
  for(const tab of ['listsTab','productGroupsTab','routesTab','productsTab','reviewTab','transferTab']) assert.ok(jsonConfig.items[tab],tab);
  assert.equal(jsonConfig.items.diagnosticsTab,undefined);
});
test('backup and sharing use an Admin 7.6 compatible launcher without raw JSON controls',()=>{
  const transfer=jsonConfig.items.transferTab.items;
  assert.deepEqual(Object.keys(transfer),['backupHelp','backupTransfer']);

  const launcher=transfer.backupTransfer;
  assert.equal(launcher.type,'sendTo');
  assert.equal(launcher.command,'getBackupUiUrl');
  assert.equal(launcher.openUrl,true);
  assert.equal(launcher.window,'shoppingrouteBackup');

  assert.ok(fs.existsSync(path.join(root,'admin','backup-transfer.html')));

  const html=fs.readFileSync(path.join(root,'admin','backup-transfer.html'),'utf8');
  assert.match(html,/Sicherung herunterladen/);
  assert.match(html,/Sicherung wiederherstellen/);
  assert.match(html,/Marktprofil herunterladen/);
  assert.match(html,/Marktprofil importieren/);
  assert.match(html,/control\.importConfigJson/);
  assert.match(html,/control\.marketProfileImport/);

  const source=fs.readFileSync(path.join(root,'src','main.ts'),'utf8');
  assert.match(source,/getBackupUiUrl/);
  assert.match(source,/openUrl:/);

  const ioPackage=JSON.parse(fs.readFileSync(path.join(root,'io-package.json'),'utf8'));
  const adminDependency=ioPackage.common.globalDependencies.find(entry=>entry.admin);
  assert.ok(adminDependency);
  assert.equal(adminDependency.admin,'>=7.6.20');
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
  const route=jsonConfig.items.routesTab.items;
  assert.equal(route.routeMarketFilter.type,'selectSendTo');
  assert.equal(route.routeMarketFilter.command,'getActiveMarkets');
  assert.equal(route.routeMarketFilter.manual,false);
  assert.equal(route._routeEditorRows.items.find(x=>x.attr==='category').command,'getProductGroups');
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

test('public beta publishing is protected by a root publish guard and package builder',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal('private' in pkg,false);
  assert.equal(pkg.license,'SEE LICENSE IN LICENSE');
  assert.equal(pkg.scripts.prepublishOnly,'node scripts/block-root-publish.js');
  assert.ok(fs.existsSync(path.join(root,'scripts','block-root-publish.js')));
  assert.ok(fs.existsSync(path.join(root,'scripts','make-beta-package.js')));
});

test('walking routes use a standalone market dropdown and a calculated one-market editor',()=>{
  const route=jsonConfig.items.routesTab.items;
  assert.equal(route.routeMarketFilter.type,'selectSendTo');
  assert.equal(route.routeMarketFilter.command,'getActiveMarkets');
  assert.equal(route.routeMarketFilter.manual,false);
  assert.equal(route._routeEditorRows.type,'table');
  assert.equal(route._routeEditorRows.doNotSave,undefined);
  assert.ok(route._routeEditorRows.onChange.alsoDependsOn.includes('routeMarketFilter'));
  assert.equal(route.routes.type,'table');
  assert.equal(route.routes.hidden,'true');
  assert.ok(route.routes.onChange.alsoDependsOn.includes('_routeEditorRows'));
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal(pkg.scripts['build:admin'],undefined);
});

test('walking-route calculate functions keep only the selected market visible and merge edits back',()=>{
  const route=jsonConfig.items.routesTab.items;
  const source=[
    {market:'ALDI',category:'Obst/Gemüse',order:10},
    {market:'ALDI',category:'Milchprodukte',order:20},
    {market:'REWE',category:'Getränke',order:10},
  ];
  const calcEditor=new Function('data',`return ${route._routeEditorRows.onChange.calculateFunc}`);
  const editor=calcEditor({routes:source,routeMarketFilter:'ALDI'});
  assert.deepEqual(editor.map(x=>x.category),['Obst/Gemüse','Milchprodukte']);
  const calcRoutes=new Function('data',`return ${route.routes.onChange.calculateFunc}`);
  const merged=calcRoutes({routes:source,routeMarketFilter:'ALDI',_routeEditorRows:[editor[1],editor[0]]});
  assert.deepEqual(merged.filter(x=>x.market==='ALDI').map(x=>x.category),['Milchprodukte','Obst/Gemüse']);
  assert.deepEqual(merged.filter(x=>x.market==='ALDI').map(x=>x.order),[10,20]);
  assert.deepEqual(merged.filter(x=>x.market==='REWE').map(x=>x.category),['Getränke']);
});

test('API protection is integrated into General and no longer has its own tab',()=>{
  const general=jsonConfig.items.general.items;
  assert.equal(jsonConfig.items.apiTab,undefined);
  for(const key of ['apiSafeMode','maxWritesPerMinute','batchSize','batchPauseMs','maxWriteRetries','retryBaseMs']) assert.ok(general[key],key);
});

test('market terminology distinguishes normal default from current-shopping override',()=>{
  const general=jsonConfig.items.general.items;
  assert.equal(jsonConfig.i18n[general.priorityMarket.label].de,'Standardmarkt für Einkäufe');
  assert.equal(jsonConfig.i18n[general.temporaryMarketState.label].de,'Markt für aktuellen Einkauf');
});


test('current-shopping market has a visible no-market reset option',()=>{
  const source=fs.readFileSync(path.join(root,'src','main.ts'),'utf8');
  assert.match(source,/__none__/);
  assert.match(source,/Kein Markt/);
  const general=jsonConfig.items.general.items;
  assert.equal(general.clearTemporaryMarket,undefined);
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
  assert.equal(pkg.devDependencies['@iobroker/testing'],'^5.2.2');
  assert.equal(ioPackage.common.type,'logic');
  assert.equal(ioPackage.common.tier,3);
  assert.ok(ioPackage.common.extIcon);
  assert.ok(Array.isArray(ioPackage.common.globalDependencies));
  assert.equal(typeof jsonConfig.i18n,'object');
  assert.ok(Object.keys(jsonConfig.i18n).length > 20);
  for(const entry of Object.values(jsonConfig.i18n)) {
    for(const lang of ['en','de','ru','pt','nl','fr','it','es','pl','uk','zh-cn']) assert.ok(entry[lang] !== undefined,`admin i18n ${lang}`);
  }
  assert.equal('main' in ioPackage.common,false);
  for(const lang of ['en','de','ru','pt','nl','fr','it','es','pl','uk','zh-cn']) {
    assert.ok(ioPackage.common.titleLang[lang],`titleLang ${lang}`);
    assert.ok(ioPackage.common.desc[lang],`desc ${lang}`);
  }
});

test('checker workflow and responsive tables are configured',()=>{
  const workflow=fs.readFileSync(path.join(root,'.github','workflows','test-and-release.yml'),'utf8');
  assert.match(workflow,/check-and-lint:/);
  assert.match(workflow,/adapter-tests:/);
  assert.match(workflow,/deploy:/);
  assert.match(workflow,/v\[0-9\]\+\.\[0-9\]\+\.\[0-9\]\+/);
  function walk(node){
    if(!node||typeof node!=='object') return;
    if(node.type==='table') for(const bp of ['xs','sm','md','lg','xl']) assert.ok(bp in node,`table ${bp}`);
    for(const value of Object.values(node)) walk(value);
  }
  walk(jsonConfig);
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
