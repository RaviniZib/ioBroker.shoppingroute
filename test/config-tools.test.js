'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  exportConfig,
  parseConfigImport,
  buildMarketProfiles,
  importMarketProfile,
  reindexRoutes,
  normalizeRoutesForAdmin,
  availableProductGroupsForRoute,
} = require('../build/lib/config-tools');

test('configuration can be exported and imported with format marker', () => {
  const exported = exportConfig({ priorityMarket:'LIDL', products:[{name:'Milch',category:'Milchprodukte'}] }, '0.2.0-beta.7', new Date('2026-08-08T00:00:00Z'));
  assert.equal(exported.format, 'shoppingroute-config-v1');
  const imported = parseConfigImport(JSON.stringify(exported));
  assert.equal(imported.priorityMarket, 'LIDL');
  assert.equal(imported.products[0].name, 'Milch');
});

test('market profiles are shareable independently', () => {
  const markets=[{name:'ALDI',order:10,enabled:true,aliases:'Aldi'}];
  const routes=[{market:'ALDI',category:'Obst/Gemüse',order:80},{market:'ALDI',category:'Milchprodukte',order:10}];
  const profiles=buildMarketProfiles(markets,routes);
  assert.equal(profiles[0].format,'shoppingroute-market-profile-v1');
  const imported=importMarketProfile(JSON.stringify(profiles[0]),[],[]);
  assert.equal(imported.markets[0].name,'ALDI');
  assert.deepEqual(imported.routes.map(r=>r.order),[10,20]);
});

test('walking routes reindex by table row order', () => {
  const result=reindexRoutes([{market:'A',category:'x',order:99},{market:'A',category:'y',order:1},{market:'B',category:'z',order:50}]);
  assert.deepEqual(result.map(r=>r.order),[10,20,10]);
});


test('normal startup normalization preserves intentional market-specific omissions', () => {
  const productGroups=[{name:'Milchprodukte'},{name:'Obst/Gemüse'},{name:'Werkzeug'}];
  const originalGroups=structuredClone(productGroups);
  const routes=[
    {market:'ALDI',category:'Milchprodukte',order:10},
    {market:'ALDI',category:'Obst/Gemüse',order:20},
    {market:'BAUMARKT',category:'Werkzeug',order:10},
  ];

  const normalized=normalizeRoutesForAdmin(routes);

  assert.equal(normalized.some(r=>r.market==='BAUMARKT'&&r.category==='Milchprodukte'),false);
  assert.equal(normalized.some(r=>r.market==='ALDI'&&r.category==='Milchprodukte'),true);
  assert.deepEqual(productGroups,originalGroups);
});

test('walking routes are grouped alphabetically by market while preserving each market route order', () => {
  const routes = [
    { market: 'REWE', category: 'Getränke', order: 10 },
    { market: 'ALDI', category: 'Milchprodukte', order: 10 },
    { market: 'REWE', category: 'Brot/Gebäck', order: 20 },
    { market: 'ALDI', category: 'Obst/Gemüse', order: 20 },
  ];
  const result = normalizeRoutesForAdmin(routes);
  assert.deepEqual(result.map(r => `${r.market}:${r.category}`), [
    'ALDI:Milchprodukte',
    'ALDI:Obst/Gemüse',
    'REWE:Getränke',
    'REWE:Brot/Gebäck',
  ]);
  assert.deepEqual(result.map(r => r.order), [10,20,10,20]);
});

test('route product-group choices contain only central groups missing from this market', () => {
  const groups=[
    {name:'Milchprodukte'},
    {name:'Obst/Gemüse'},
    {name:'Werkzeug'},
    {name:'werkzeug'},
  ];
  const routeRows=[{category:'Werkzeug'},{category:'Obst/Gemüse'}];

  assert.deepEqual(availableProductGroupsForRoute(groups,routeRows),['Milchprodukte']);
  assert.deepEqual(
    availableProductGroupsForRoute(groups,routeRows,'Werkzeug'),
    ['Milchprodukte','Werkzeug'],
  );
  assert.deepEqual(
    availableProductGroupsForRoute(groups,[{category:'Historische Gruppe'}],'Historische Gruppe'),
    ['Historische Gruppe','Milchprodukte','Obst/Gemüse','Werkzeug'],
  );
});

test('route normalization never removes existing routes during an update', () => {
  const routes=[
    {market:'REWE',category:'Getränke',order:90},
    {market:'BAUMARKT',category:'Werkzeug',order:40},
    {market:'ALDI',category:'Milchprodukte',order:70},
    {market:'BAUMARKT',category:'Farben',order:10},
  ];

  const normalized=normalizeRoutesForAdmin(routes);
  const routeKeys=value=>value.map(r=>`${r.market}\u0000${r.category}`).sort();

  assert.equal(normalized.length,routes.length);
  assert.deepEqual(routeKeys(normalized),routeKeys(routes));
});
