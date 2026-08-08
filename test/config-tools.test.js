'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { exportConfig, parseConfigImport, buildMarketProfiles, importMarketProfile, reindexRoutes, ensureMarketRoutes } = require('../build/lib/config-tools');

test('configuration can be exported and imported with format marker', () => {
  const exported = exportConfig({ priorityMarket:'LIDL', products:[{name:'Milch',category:'Milchprodukte'}] }, '0.2.0-beta.5', new Date('2026-08-08T00:00:00Z'));
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


test('new active markets automatically receive walking-route rows for all product groups', () => {
  const markets=[
    {name:'ALDI',order:10,enabled:true},
    {name:'EDEKA',order:20,enabled:true},
  ];
  const groups=[{name:'Obst/Gemüse'},{name:'Milchprodukte'}];
  const routes=[
    {market:'ALDI',category:'Obst/Gemüse',order:10},
    {market:'ALDI',category:'Milchprodukte',order:20},
  ];
  const synced=ensureMarketRoutes(markets,groups,routes);
  assert.equal(synced.added,2);
  assert.deepEqual(
    synced.routes.filter(r=>r.market==='EDEKA').map(r=>r.category),
    ['Obst/Gemüse','Milchprodukte'],
  );
  assert.deepEqual(synced.routes.filter(r=>r.market==='EDEKA').map(r=>r.order),[10,20]);
});

test('walking routes are grouped alphabetically by market while preserving each market route order', () => {
  const { normalizeRoutesForAdmin } = require('../build/lib/config-tools');
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
