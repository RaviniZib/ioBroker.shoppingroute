'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createConfigBackup,isSuspiciousConfigReplacement,restoreProtectedConfig}=require('../build/lib/config-protection');

function many(prefix,count){return Array.from({length:count},(_,i)=>({name:`${prefix}${i}`}));}
function populated(){return {markets:many('m',16),routes:many('r',283),products:many('p',157),productGroups:many('g',29),lists:[{name:'SHOP'},{name:'WORK'}],reviewItems:many('q',8),priorityMarket:'A'};}
function packageDefaults(){return {markets:many('m',5),routes:many('r',75),products:many('p',5),productGroups:many('g',15),lists:[{name:'SHOP'}],reviewItems:[],priorityMarket:'B'};}

test('detects destructive replacement of a populated catalogue by package-sized data',()=>{
 const before=populated(); const backup=createConfigBackup(before,'2026-10-05T00:00:00Z');
 assert.equal(isSuspiciousConfigReplacement(packageDefaults(),backup),true);
});

test('restores protected arrays exactly while preserving scalar settings from the admin save',()=>{
 const before=populated(); const current=packageDefaults(); const backup=createConfigBackup(before,'2026-10-05T00:00:00Z');
 const restored=restoreProtectedConfig(current,backup);
 for(const key of ['markets','routes','products','productGroups','lists','reviewItems']) assert.deepEqual(restored[key],before[key],key);
 assert.equal(restored.priorityMarket,'B');
});

test('does not undo ordinary edits that are not a broad catalogue collapse',()=>{
 const before=populated(); const backup=createConfigBackup(before);
 const edited={...before,products:before.products.slice(0,120),priorityMarket:'C'};
 assert.equal(isSuspiciousConfigReplacement(edited,backup),false);
 assert.deepEqual(restoreProtectedConfig(edited,backup),edited);
});
