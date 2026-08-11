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

test('new installations receive complete initial routes from io-package defaults',()=>{
  const groups=ioPackage.native.productGroups.map(group=>group.name);
  const activeMarkets=ioPackage.native.markets.filter(market=>market.enabled!==false).map(market=>market.name);
  const configured=new Set(ioPackage.native.routes.map(route=>`${route.market.toLocaleLowerCase('de')}\u0000${route.category.toLocaleLowerCase('de')}`));

  for(const market of activeMarkets) {
    for(const group of groups) {
      assert.ok(configured.has(`${market.toLocaleLowerCase('de')}\u0000${group.toLocaleLowerCase('de')}`),`${market}: ${group}`);
    }
  }
});

test('dynamic dropdown handlers sort alphabetically',()=>{
  const source=fs.readFileSync(path.join(root,'src','main.ts'),'utf8');
  assert.match(source,/getProductGroups[\s\S]*localeCompare\(b\.label/);
  assert.match(source,/getMarkets[\s\S]*localeCompare\(b\.label/);
});

test('public beta publishing is protected by a root publish guard and package builder',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  assert.equal('private' in pkg,false);
  assert.equal(pkg.license,'MIT');
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
  const category=route._routeEditorRows.items.find(item=>item.attr==='category');
  assert.equal(category.command,'getProductGroups');
  assert.equal(category.default,'Sonstiges');
  assert.equal(category.showAllValues,undefined);
  assert.match(category.jsonData,/globalData\.productGroups/);
  assert.doesNotMatch(category.jsonData,/globalData\._routeEditorRows/);
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


test('unsaved markets and product groups are fed into the real product and review tables',()=>{
  const route=jsonConfig.items.routesTab.items;
  assert.match(route.routeMarketFilter.jsonData,/data\.markets/);

  const products=jsonConfig.items.productsTab.items;
  assert.equal(products._productEditorRows,undefined);
  assert.notEqual(products.products.hidden,'true');
  const pFields=products.products.items;
  const pCategory=pFields.find(x=>x.attr==='category');
  const pDefault=pFields.find(x=>x.attr==='defaultMarket');
  const alternatives=pFields.find(x=>x.attr==='availableMarkets');
  assert.match(pCategory.jsonData,/globalData\.productGroups/);
  assert.match(pDefault.jsonData,/globalData\.markets/);
  assert.equal(alternatives.type,'selectSendTo');
  assert.equal(alternatives.multiple,true);
  assert.equal(alternatives.defaultSendTo,'normalizeMarketSelection');
  assert.match(alternatives.jsonData,/globalData\.markets/);
  assert.match(products.products.onChange.calculateFunc,/join\(','\)/);

  const productCalc=new Function('data',`return ${products.products.onChange.calculateFunc}`);
  const serializedProducts=productCalc({
    products:[{name:'Milch',category:'Milchprodukte',availableMarkets:['ALDI','LIDL']}],
  });
  assert.equal(serializedProducts[0].availableMarkets,'ALDI,LIDL');

  const review=jsonConfig.items.reviewTab.items;
  assert.equal(review._reviewEditorRows,undefined);
  assert.notEqual(review.reviewItems.hidden,'true');
  const rAlternatives=review.reviewItems.items.find(x=>x.attr==='availableMarkets');
  assert.equal(rAlternatives.multiple,true);
  assert.equal(rAlternatives.defaultSendTo,'normalizeMarketSelection');
  assert.match(rAlternatives.jsonData,/globalData\.markets/);

  const reviewCalc=new Function('data',`return ${review.reviewItems.onChange.calculateFunc}`);
  const serializedReviews=reviewCalc({
    reviewItems:[{product:'Milch',availableMarkets:['REWE','LIDL']}],
  });
  assert.equal(serializedReviews[0].availableMarkets,'REWE,LIDL');

  assert.match(review.reviewAcceptAll.jsonData,/JSON\.stringify\(data\)/);
  const source=fs.readFileSync(path.join(root,'src','main.ts'),'utf8');
  assert.match(source,/normalizeMarketSelection/);
});

test('walking route editor deletes and re-adds a group only for the selected market',()=>{
  const route=jsonConfig.items.routesTab.items;
  assert.doesNotMatch(route._routeEditorRows.onChange.calculateFunc,/\breturn\b/);
  const calcEditor=new Function('data',`return ${route._routeEditorRows.onChange.calculateFunc}`);
  const productGroups=[{name:'Milchprodukte'},{name:'Obst/Gemüse'},{name:'Werkzeug'}];
  const originalGroups=structuredClone(productGroups);
  const sourceRoutes=[
    {market:'ALDI',category:'Milchprodukte',order:10},
    {market:'ALDI',category:'Obst/Gemüse',order:20},
    {market:'BAUMARKT',category:'Milchprodukte',order:10},
    {market:'BAUMARKT',category:'Werkzeug',order:20},
  ];
  const rows=calcEditor({
    routes:sourceRoutes,
    routeMarketFilter:'BAUMARKT',
    productGroups,
  });
  assert.deepEqual(rows.map(r=>r.category),['Milchprodukte','Werkzeug','Obst/Gemüse']);
  assert.ok(rows.every(r=>r._market==='BAUMARKT'));

  const calcRoutes=new Function('data',`return ${route.routes.onChange.calculateFunc}`);
  const afterDelete=calcRoutes({
    routes:sourceRoutes,
    routeMarketFilter:'BAUMARKT',
    _routeEditorRows:rows.filter(row=>row.category!=='Milchprodukte'),
  });
  assert.deepEqual(afterDelete.filter(r=>r.market==='BAUMARKT').map(r=>r.category),['Werkzeug','Obst/Gemüse']);
  assert.deepEqual(afterDelete.filter(r=>r.market==='ALDI').map(r=>r.category),['Milchprodukte','Obst/Gemüse']);
  assert.deepEqual(productGroups,originalGroups);

  const afterAdd=calcRoutes({
    routes:afterDelete,
    routeMarketFilter:'BAUMARKT',
    _routeEditorRows:[rows.find(row=>row.category==='Werkzeug'),{_market:'BAUMARKT',category:'Milchprodukte'}],
  });
  assert.deepEqual(afterAdd.filter(r=>r.market==='BAUMARKT').map(r=>r.category),['Werkzeug','Milchprodukte']);
  assert.deepEqual(afterAdd.filter(r=>r.market==='ALDI').map(r=>r.category),['Milchprodukte','Obst/Gemüse']);
  assert.deepEqual(productGroups,originalGroups);

  const source=fs.readFileSync(path.join(root,'src','main.ts'),'utf8');
  assert.doesNotMatch(source,/ensureMarketRoutes|ensureRoutesForMarketsAndGroups/);
});

test('walking route editor rebuilds ALDI rows after switching from BAUMARKT',()=>{
  const route=jsonConfig.items.routesTab.items;
  const calcEditor=new Function('data',`return ${route._routeEditorRows.onChange.calculateFunc}`);
  const calcRoutes=new Function('data',`return ${route.routes.onChange.calculateFunc}`);
  const productGroups=[{name:'Milchprodukte'},{name:'Werkzeug'},{name:'Obst/Gemüse'}];
  const routes=[
    {market:'BAUMARKT',category:'Werkzeug',order:10},
    {market:'BAUMARKT',category:'Milchprodukte',order:20},
    {market:'ALDI',category:'Obst/Gemüse',order:10},
    {market:'ALDI',category:'Milchprodukte',order:20},
  ];

  const baumarktRows=calcEditor({routes,routeMarketFilter:'BAUMARKT',productGroups});
  assert.deepEqual(baumarktRows.map(row=>row.category),['Werkzeug','Milchprodukte','Obst/Gemüse']);
  assert.ok(baumarktRows.every(row=>row._market==='BAUMARKT'));

  // During the reactive market change the hidden table may still see the old
  // BAUMARKT rows. The v0.3.2 market marker must prevent them from overwriting ALDI.
  const routesDuringSwitch=calcRoutes({
    routes,
    routeMarketFilter:'ALDI',
    _routeEditorRows:baumarktRows,
  });
  assert.deepEqual(routesDuringSwitch,routes);

  const aldiRows=calcEditor({routes:routesDuringSwitch,routeMarketFilter:'ALDI',productGroups});
  assert.deepEqual(aldiRows.map(row=>row.category),['Obst/Gemüse','Milchprodukte','Werkzeug']);
  assert.ok(aldiRows.every(row=>row._market==='ALDI'));
  assert.notDeepEqual(aldiRows.map(row=>row.category),baumarktRows.map(row=>row.category));
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
