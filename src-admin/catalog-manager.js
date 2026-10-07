'use strict';
/* eslint-disable */
const React=require('react');
const {MarketsEditor}=require('./markets-editor').Components;
const {ProductGroupsEditor}=require('./product-groups-editor').Components;
const {RouteEditor}=require('./route-editor').Components;
const {ReviewEditor}=require('./review-editor').Components;
const {ShoppingListEditor}=require('./shopping-list-editor').Components;
const h=React.createElement;
const adminLanguage=props=>{
 const candidates=[
  props?.language,
  props?.lang,
  props?.systemConfig?.common?.language,
  typeof globalThis!=='undefined'?globalThis.i18n?.language:'',
  typeof navigator!=='undefined'?navigator.language:'',
 ];
 return String(candidates.find(Boolean)||'en').toLowerCase();
};
const t=(de,en)=>typeof navigator!=='undefined'&&String(navigator.language||'').toLowerCase().startsWith('de')?de:en;
const clone=v=>JSON.parse(JSON.stringify(v));
const arr=v=>Array.isArray(v)?v:[];
const css=`
.srm{padding:0 0 16px;box-sizing:border-box;width:100%;max-width:none;margin:0}.srm h2{margin:0}.srm-head{position:sticky;top:0;z-index:30;width:100%;box-sizing:border-box;margin:0 0 18px;padding:14px 16px 12px;border-bottom:2px solid rgba(220,220,220,.85);box-shadow:0 2px 7px rgba(0,0,0,.12)}.srm-headgrid{display:grid;grid-template-columns:330px minmax(0,1fr);grid-template-rows:auto auto auto;column-gap:28px;align-items:start;min-height:245px}.srm-logo-wrap{grid-column:1;grid-row:1 / span 3;display:flex;align-items:center;justify-content:center;min-height:235px}.srm-logo{width:315px;height:235px;object-fit:contain}.srm-title{grid-column:2;grid-row:1;display:flex;flex-direction:column;justify-content:flex-end;min-height:94px;padding:6px 0 0}.srm-title h2{font-size:2rem;line-height:1.05;margin:0}.srm-sub{opacity:.72;font-size:1.05rem;line-height:1.25;margin-top:12px}
.srm-tabs{grid-column:2;grid-row:2;display:flex;gap:12px;flex-wrap:wrap;align-items:center;min-height:70px;margin:6px 0 0}.srm-tabs button{min-height:54px;font-size:1.05rem;padding:8px 18px}.srm-tools,.srm-add{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.srm-tools{grid-column:2;grid-row:3;min-height:68px;padding:8px 0}.srm-tools button{min-height:52px;font-size:1.02rem;padding:8px 20px}
.srm button{min-height:36px;padding:6px 12px;border:1px solid currentColor;border-radius:5px;background:transparent;color:inherit;cursor:pointer}.srm button:disabled{opacity:.4}.srm .active{font-weight:700;box-shadow:inset 0 -3px currentColor}
.srm-status{margin-left:auto}.srm-error{color:#d32f2f;font-weight:700}.srm-content{min-height:320px;max-width:1500px;margin:0 auto;padding:0 16px;box-sizing:border-box}.srm table{width:100%;border-collapse:separate;border-spacing:0 4px}.srm th{padding:8px 10px;text-align:left;font-size:.82rem;opacity:.72}.srm td{padding:8px 10px;text-align:left;border:0}.srm tbody tr:nth-child(odd) td{background:rgba(127,127,127,.07)}.srm tbody tr:nth-child(even) td{background:rgba(127,127,127,.14)}.srm tbody tr td:first-child{border-radius:6px 0 0 6px}.srm tbody tr td:last-child{border-radius:0 6px 6px 0}
.srm .shoppingroute-editor-row{border-bottom:0!important;margin:4px 0;border-radius:7px}.srm .shoppingroute-editor-row:nth-child(odd){background:rgba(127,127,127,.07)!important}.srm .shoppingroute-editor-row:nth-child(even){background:rgba(127,127,127,.14)!important}
.srm .shoppingroute-market-column{border:0!important;border-radius:8px!important;overflow:hidden;background:rgba(127,127,127,.07)}.srm .shoppingroute-market-column:nth-child(even){background:rgba(127,127,127,.14)}.srm .shoppingroute-market-title{border-bottom:0!important;background:rgba(127,127,127,.12)}
.srm .shoppingroute-item-row{border-bottom:0!important}.srm .shoppingroute-item-row:nth-child(odd){background:rgba(127,127,127,.04)}.srm .shoppingroute-item-row:nth-child(even){background:rgba(127,127,127,.09)}
.srm .shoppingroute-review-list{border:0!important}.srm .shoppingroute-review-row{border-bottom:0!important;margin:4px 0;border-radius:7px}.srm .shoppingroute-review-row:nth-child(odd){background:rgba(127,127,127,.07)}.srm .shoppingroute-review-row:nth-child(even){background:rgba(127,127,127,.14)}
.srm input,.srm select{box-sizing:border-box;width:100%;min-height:34px;padding:5px 7px;border:1px solid rgba(127,127,127,.35);border-radius:4px;background:transparent;color:inherit}.srm-add{margin-top:10px}.srm-add input{max-width:420px}.srm-x{width:55px}
@media(max-width:900px){.srm-headgrid{grid-template-columns:150px minmax(0,1fr);column-gap:14px;min-height:180px}.srm-logo-wrap{min-height:170px}.srm-logo{width:140px;height:150px}.srm-title{min-height:66px}.srm-title h2{font-size:1.35rem}.srm-sub{font-size:.9rem;margin-top:5px}.srm-tabs{flex-wrap:nowrap;overflow-x:auto;min-height:54px;padding-bottom:4px}.srm-tabs button{min-height:44px;font-size:.92rem;padding:6px 12px;flex:0 0 auto}.srm-tools{min-height:52px}.srm-tools button{min-height:42px;font-size:.9rem;padding:6px 12px}}@media(max-width:700px){.srm{padding:0 0 10px}.srm-head{margin:0 0 14px;padding:8px 10px}.srm-headgrid{grid-template-columns:96px minmax(0,1fr);column-gap:10px}.srm-logo-wrap{min-height:135px}.srm-logo{width:92px;height:120px}.srm-title h2{font-size:1.15rem}.srm-sub{font-size:.78rem}.srm-status{width:100%;margin:0}.srm table{display:block;overflow:auto}}
`;
class CatalogManager extends React.Component{
 constructor(p){super(p);this.state={data:null,base:null,tab:'products',loading:true,saving:false,error:'',savedAt:'',newProduct:'',newList:''};}
 componentDidMount(){void this.load();}
 instance(){return String(this.props.adapterName||'shoppingroute')+'.'+(Number.isFinite(Number(this.props.instance))?Number(this.props.instance):0);}
 manualUrl(){return adminLanguage(this.props).startsWith('de')
  ?'https://github.com/RaviniZib/ioBroker.shoppingroute/blob/main/BEDIENUNGSANLEITUNG_DE.md'
  :'https://github.com/RaviniZib/ioBroker.shoppingroute/blob/main/USER_GUIDE_EN.md';}
 openManual(){if(typeof window!=='undefined')window.open(this.manualUrl(),'_blank','noopener,noreferrer');}
 async send(command,message={}){if(!this.props.socket?.sendTo)throw Error('Admin socket is unavailable.');return this.props.socket.sendTo(this.instance(),command,message);}
 async load(){this.setState({loading:true,error:''});try{const r=await this.send('getManagedConfig');if(!r?.ok||!r.data)throw Error(r?.error||'Load failed');const d=clone(r.data);this.setState({data:d,base:clone(d),loading:false,savedAt:r.savedAt||''});}catch(e){this.setState({loading:false,error:e.message||String(e)});}}
 changed(){return JSON.stringify(this.state.data)!==JSON.stringify(this.state.base);}
 setData(d){this.setState({data:clone(d),error:''});}
 setKey(k,v){this.setData({...this.state.data,[k]:v});}
 edit(k,i,p){this.setKey(k,arr(this.state.data[k]).map((x,n)=>n===i?{...x,...p}:{...x}));}
 del(k,i){this.setKey(k,arr(this.state.data[k]).filter((_,n)=>n!==i).map(x=>({...x})));}
 async save(){if(this.state.saving)return;this.setState({saving:true,error:''});try{const r=await this.send('saveManagedConfig',{data:this.state.data});if(!r?.ok||!r.data)throw Error(r?.error||'Save failed');const d=clone(r.data);this.setState({data:d,base:clone(d),saving:false,savedAt:r.savedAt||new Date().toISOString()});}catch(e){this.setState({saving:false,error:e.message||String(e)});}}
 addProduct(){const n=this.state.newProduct.trim();if(!n)return;this.setKey('products',[...arr(this.state.data.products),{name:n,aliases:'',category:'Sonstiges',defaultMarket:'',availableMarkets:[]}]);this.setState({newProduct:''});}
 async addList(){const n=this.state.newList.trim();if(!n||this.listCreationPending)return;this.listCreationPending=true;this.setState({saving:true,error:''});try{const r=await this.send('createAlexaList',{name:n});if(!r?.ok)throw Error(r?.error||'Alexa list creation failed');const rows=arr(this.state.data.lists),lists=rows.some(x=>String(x.name).toLowerCase()===r.name.toLowerCase())?rows:[...rows,{name:r.name,enabled:true,priorityMarket:''}];this.setState({data:{...this.state.data,lists},base:{...this.state.base,lists:r.lists},savedAt:r.savedAt,newList:'',saving:false});}catch(e){this.setState({saving:false,error:e.message||String(e)});}finally{this.listCreationPending=false;}}
 products(){
  const groups=arr(this.state.data.productGroups).map(x=>String(x.name||'')).filter(Boolean),markets=arr(this.state.data.markets).filter(x=>x?.name&&x.enabled!==false).map(x=>String(x.name));
  const opts=v=>['',...v].map(x=>h('option',{key:x,value:x},x||'—'));
  return h('div',null,[h('table',{key:'t'},[h('thead',{key:'h'},h('tr',null,['Artikel','Aliase','Produktgruppe','Standardmarkt','Verfügbare Märkte',''].map((x,i)=>h('th',{key:i},x)))),h('tbody',{key:'b'},arr(this.state.data.products).map((p,i)=>h('tr',{key:i},[
   h('td',{key:'n'},h('input',{value:String(p.name||''),onChange:e=>this.edit('products',i,{name:e.target.value})})),
   h('td',{key:'a'},h('input',{value:String(p.aliases||''),onChange:e=>this.edit('products',i,{aliases:e.target.value})})),
   h('td',{key:'g'},h('select',{value:String(p.category||''),onChange:e=>this.edit('products',i,{category:e.target.value})},opts(groups))),
   h('td',{key:'d'},h('select',{value:String(p.defaultMarket||''),onChange:e=>this.edit('products',i,{defaultMarket:e.target.value})},opts(markets))),
   h('td',{key:'m'},h('input',{value:Array.isArray(p.availableMarkets)?p.availableMarkets.join(', '):String(p.availableMarkets||''),onChange:e=>this.edit('products',i,{availableMarkets:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})})),
   h('td',{key:'x',className:'srm-x'},h('button',{onClick:()=>this.del('products',i)},'×'))])))]),h('div',{key:'a',className:'srm-add'},[h('input',{key:'i',placeholder:t('Neuer Artikel','New product'),value:this.state.newProduct,onChange:e=>this.setState({newProduct:e.target.value}),onKeyDown:e=>e.key==='Enter'&&this.addProduct()}),h('button',{key:'b',onClick:()=>this.addProduct()},t('Hinzufügen','Add'))])]);
 }
 lists(){
  const markets=arr(this.state.data.markets).filter(x=>x?.name&&x.enabled!==false).map(x=>String(x.name)),opts=['',...markets].map(x=>h('option',{key:x,value:x},x||'—'));
  return h('div',null,[h('table',{key:'t'},[h('thead',{key:'h'},h('tr',null,['Aktiv','Alexa-Liste','Prioritätsmarkt',''].map((x,i)=>h('th',{key:i},x)))),h('tbody',{key:'b'},arr(this.state.data.lists).map((p,i)=>h('tr',{key:i},[
   h('td',{key:'e'},h('input',{type:'checkbox',checked:p.enabled!==false,onChange:e=>this.edit('lists',i,{enabled:e.target.checked})})),
   h('td',{key:'n'},h('input',{value:String(p.name||''),onChange:e=>this.edit('lists',i,{name:e.target.value})})),
   h('td',{key:'p'},h('select',{value:String(p.priorityMarket||''),onChange:e=>this.edit('lists',i,{priorityMarket:e.target.value})},opts)),
   h('td',{key:'x',className:'srm-x'},h('button',{onClick:()=>this.del('lists',i)},'×'))])))]),h('div',{key:'a',className:'srm-add'},[h('input',{key:'i',placeholder:t('Neue Liste in Alexa anlegen','Create a new Alexa list'),disabled:this.state.saving,value:this.state.newList,onChange:e=>this.setState({newList:e.target.value}),onKeyDown:e=>e.key==='Enter'&&this.addList()}),h('button',{key:'b',disabled:this.state.saving,onClick:()=>void this.addList()},t('In Alexa anlegen','Create in Alexa'))])]);
 }
 content(){const p={data:this.state.data,onChange:d=>this.setData(d),themeType:this.props.themeType};if(this.state.tab==='shopping')return h(ShoppingListEditor,{socket:this.props.socket,adapterName:this.props.adapterName,instance:this.props.instance,themeType:this.props.themeType});if(this.state.tab==='markets')return h(MarketsEditor,p);if(this.state.tab==='groups')return h(ProductGroupsEditor,p);if(this.state.tab==='routes')return h(RouteEditor,p);if(this.state.tab==='review')return h(ReviewEditor,p);if(this.state.tab==='lists')return this.lists();return this.products();}
 render(){if(this.state.loading)return h('div',{className:'srm'},t('Wird geladen …','Loading …'));if(!this.state.data)return h('div',{className:'srm srm-error'},this.state.error||'No data');const tabs=[['shopping','Einkaufsliste','Shopping list'],['products','Artikel','Products'],['markets','Märkte','Markets'],['groups','Produktgruppen','Product groups'],['routes','Laufwege','Routes'],['lists','Listen','Lists'],['review','Prüfung','Review']],changed=this.changed(),dark=String(this.props.themeType||'').toLowerCase()==='dark',headStyle={background:dark?'#1f1f1f':'#fff',color:dark?'#eee':'#222'};return h('div',{className:'srm'},[h('style',{key:'s'},css),h('header',{key:'head',className:'srm-head',style:headStyle},[
 h('div',{key:'grid',className:'srm-headgrid'},[
  h('div',{key:'logoWrap',className:'srm-logo-wrap'},h('img',{key:'logo',className:'srm-logo',src:'./adapter/shoppingroute/shoppingroute.png',alt:'ShoppingRoute'})),
  h('div',{key:'title',className:'srm-title'},[h('h2',{key:'h'},'ShoppingRoute'),h('div',{key:'sub',className:'srm-sub'},t('Kataloge, Listen und Einkauf direkt verwalten','Manage catalogues, lists and shopping directly'))]),
  h('nav',{key:'tabs',className:'srm-tabs'},tabs.map(([id,de,en])=>h('button',{key:id,className:this.state.tab===id?'active':'',onClick:()=>this.setState({tab:id})},t(de,en)))),
  h('div',{key:'tools',className:'srm-tools'},[
  h('button',{key:'save',disabled:!changed||this.state.saving,onClick:()=>void this.save()},this.state.saving?t('Speichert …','Saving …'):t('Speichern','Save')),
  h('button',{key:'discard',disabled:!changed||this.state.saving,onClick:()=>this.setState({data:clone(this.state.base),error:''})},t('Verwerfen','Discard')),
  h('button',{key:'reload',disabled:this.state.saving,onClick:()=>void this.load()},t('Neu laden','Reload')),
  h('button',{key:'manual',onClick:()=>this.openManual()},adminLanguage(this.props).startsWith('de')?'Bedienungsanleitung':'User guide'),
  h('span',{key:'st',className:'srm-status '+(this.state.error?'srm-error':'' )},this.state.error||(changed?t('Ungespeicherte Änderungen','Unsaved changes'):(this.state.savedAt?t('Gespeichert: ','Saved: ')+new Date(this.state.savedAt).toLocaleString():t('Gespeichert','Saved'))))
 ])
 ])
]),h('main',{key:'c',className:'srm-content'},this.content())]);}
}
module.exports={Components:{CatalogManager}};
