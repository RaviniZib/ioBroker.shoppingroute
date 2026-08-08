'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const { emptyUsageStatistics, recordAddedItem }=require('../build/lib/statistics');

test('local usage statistics count products, markets, groups and lists',()=>{
  let stats=emptyUsageStatistics(new Date('2026-08-08T00:00:00Z'));
  stats=recordAddedItem(stats,'SHOP',{productName:'Milch',market:'LIDL',category:'Milchprodukte'});
  assert.equal(stats.totalAddedItems,1);
  assert.equal(stats.byProduct.Milch,1);
  assert.equal(stats.byMarket.LIDL,1);
  assert.equal(stats.byCategory.Milchprodukte,1);
  assert.equal(stats.byList.SHOP,1);
});
