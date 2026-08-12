import"./hostInit-DeIlwHf1.js";import{i as N,S as A}from"./ShoppingRouteMarketsSet__mf_v__runtimeInit__mf_v__-Dx7i8THH.js";import{g as $}from"./_commonjsHelpers-CqkleIqs.js";import"./preload-helper-Dp1pzeXC.js";function R(o,e){for(var t=0;t<e.length;t++){const r=e[t];if(typeof r!="string"&&!Array.isArray(r)){for(const n in r)if(n!=="default"&&!(n in o)){const s=Object.getOwnPropertyDescriptor(r,n);s&&Object.defineProperty(o,n,s.get?s:{enumerable:!0,get:()=>r[n]})}}}return Object.freeze(Object.defineProperty(o,Symbol.toStringTag,{value:"Module"}))}const{loadShare:E}=N,{initPromise:B}=A,j=B.then(o=>E("react",{customShareInfo:{shareConfig:{singleton:!0,strictVersion:!1,requiredVersion:">=18"}}})),F=await j.then(o=>o());var b=F;const g=$(b),x=R({__proto__:null,default:g},[b]);var p={exports:{}};const k=g||x,d=k.createElement,L=`
    .shoppingroute-editor-row {
        display: grid;
        grid-template-columns: 48px minmax(160px, 1fr) 144px;
        align-items: center;
        gap: 8px;
        padding: 9px 12px;
    }
    .shoppingroute-editor-row-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
    }
    .shoppingroute-editor-add-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
    }
    .shoppingroute-editor-control {
        box-sizing: border-box;
        min-width: 240px;
        max-width: 100%;
    }
    .shoppingroute-editor-button:hover:not(:disabled) {
        filter: brightness(0.96);
    }
    @media (max-width: 600px) {
        .shoppingroute-editor-row {
            grid-template-columns: 32px minmax(0, 1fr);
        }
        .shoppingroute-editor-row-actions {
            grid-column: 2;
            justify-content: flex-start;
        }
        .shoppingroute-editor-add-controls {
            align-items: stretch;
        }
        .shoppingroute-editor-control {
            min-width: 0;
            width: 100%;
        }
    }
`;function O(o,e){return(typeof navigator<"u"?String(navigator.language||"").toLowerCase():"de").startsWith("de")?o:e}function T(o){const e=String(o||"").toLowerCase()==="dark";return{border:e?"#555":"#d5d5d5",background:e?"#2b2b2b":"#fff",muted:e?"#bbb":"#666",buttonBackground:e?"#3b3b3b":"#f4f4f4"}}function z({children:o}){return d(k.Fragment,null,[d("style",{key:"responsive-styles"},L),d("div",{key:"content",style:{width:"100%"}},o)])}function H({title:o,hint:e,tokens:t,titleKey:r="title",hintKey:n="hint"}){return[d("h3",{key:r,style:{margin:"0 0 6px"}},o),e?d("div",{key:n,style:{color:t.muted,marginBottom:"10px",fontSize:"0.92rem"}},e):null]}function I({children:o,tokens:e,marginBottom:t="18px"}){return d("div",{style:{border:`1px solid ${e.border}`,borderRadius:"6px",overflow:"hidden",marginBottom:t}},o)}function D({position:o,children:e,actions:t,last:r,tokens:n}){return d("div",{className:"shoppingroute-editor-row",style:{borderBottom:r?"none":`1px solid ${n.border}`,background:n.background}},[d("div",{key:"position",style:{color:n.muted,textAlign:"right",paddingRight:"6px"}},String(o)),d("div",{key:"content",style:{minWidth:0}},e),d("div",{key:"actions",className:"shoppingroute-editor-row-actions"},t)])}function P({children:o,disabled:e=!1,onClick:t,title:r,tokens:n}){return d("button",{className:"shoppingroute-editor-button",type:"button",disabled:e,title:r,"aria-label":r,onClick:t,style:{width:"38px",height:"32px",border:`1px solid ${n.border}`,borderRadius:"4px",background:n.buttonBackground,color:"inherit",cursor:e?"default":"pointer",opacity:e?.4:1}},o)}function J({ariaLabel:o,onChange:e,onKeyDown:t,placeholder:r,tokens:n,value:s}){return d("input",{className:"shoppingroute-editor-control",type:"text",value:s,placeholder:r,"aria-label":o,onChange:e,onKeyDown:t,style:{width:"100%",padding:"9px 12px",borderRadius:"4px",border:`1px solid ${n.border}`,background:n.background,color:"inherit"}})}function K({children:o,disabled:e=!1,onClick:t,tokens:r}){return d("button",{className:"shoppingroute-editor-button",type:"button",disabled:e,onClick:t,style:{minHeight:"38px",padding:"7px 16px",border:`1px solid ${r.border}`,borderRadius:"4px",background:r.buttonBackground,color:"inherit",cursor:e?"default":"pointer",fontWeight:600,opacity:e?.4:1}},o)}function W({children:o}){return d("div",{className:"shoppingroute-editor-add-controls"},o)}p.exports={ActionButton:K,AddControls:W,BorderedList:I,EditorFrame:z,EditorRow:D,IconButton:P,SectionHeading:H,TextInput:J,text:O,themeTokens:T};const y=(p.exports==null?{}:p.exports).default||p.exports,V=Object.freeze(Object.defineProperty({__proto__:null,default:y},Symbol.toStringTag,{value:"Module"}));var u={exports:{}};const _=g||x,{ActionButton:q,AddControls:G,BorderedList:Q,EditorFrame:U,EditorRow:X,IconButton:c,SectionHeading:f,TextInput:m,text:i,themeTokens:Y}=y||V,a=_.createElement,Z=`
    .shoppingroute-markets-fields {
        display: grid;
        grid-template-columns: minmax(72px, 96px) minmax(96px, 128px) minmax(180px, 1fr) minmax(180px, 1.4fr);
        gap: 10px;
        align-items: center;
    }
    @media (max-width: 900px) {
        .shoppingroute-markets-fields {
            grid-template-columns: minmax(72px, 96px) minmax(96px, 128px) minmax(180px, 1fr);
        }
        .shoppingroute-markets-aliases {
            grid-column: 1 / -1;
        }
    }
    @media (max-width: 600px) {
        .shoppingroute-markets-fields {
            grid-template-columns: 1fr;
        }
        .shoppingroute-markets-aliases {
            grid-column: auto;
        }
    }
`;function ee({children:o}){return a("div",{className:"shoppingroute-markets-fields"},o)}function h({children:o,className:e,label:t,tokens:r}){return a("label",{className:e,style:{display:"flex",minWidth:0,flexDirection:"column",gap:"4px"}},[a("span",{key:"label",style:{color:r.muted,fontSize:"0.78rem"}},t),o])}function te({checked:o,label:e,onChange:t,tokens:r}){return a("label",{style:{display:"flex",alignItems:"center",gap:"8px",minHeight:"38px",color:"inherit"}},[a("input",{key:"input",type:"checkbox",checked:o,onChange:t,style:{width:"18px",height:"18px",accentColor:"#3399cc"}}),a("span",{key:"label",style:{color:r.muted}},e)])}function re({ariaLabel:o,onChange:e,tokens:t,value:r}){return a("input",{className:"shoppingroute-editor-control",type:"number",value:r,"aria-label":o,onChange:e,style:{width:"100%",padding:"9px 12px",borderRadius:"4px",border:`1px solid ${t.border}`,background:t.background,color:"inherit"}})}function l(o){return(Array.isArray(o)?o:[]).map(e=>e&&typeof e=="object"&&!Array.isArray(e)?{...e}:{enabled:!0,order:999,name:String(e||""),aliases:""})}function v(o){const e=l(o).map(t=>Number(t.order)).filter(Number.isFinite);return e.length?Math.max(...e)+10:10}function w(o,e){const t=String(e||"").trim(),r=l(o);return t&&r.push({enabled:!0,order:v(r),name:t,aliases:""}),r}function S(o,e,t){const r=l(o);return e>=0&&e<r.length&&(r[e]={...r[e],...t}),r}function M(o,e){const t=l(o);return e>=0&&e<t.length&&t.splice(e,1),t}function C(o,e,t){const r=l(o),n=e+t;return e>=0&&e<r.length&&n>=0&&n<r.length&&([r[e],r[n]]=[r[n],r[e]]),r}class oe extends _.Component{constructor(e){super(e),this.state={newName:""}}updateMarkets(e){this.props.onChange({...this.props.data||{},markets:e},!0)}add(){const e=w(this.props.data&&this.props.data.markets,this.state.newName);e.length!==l(this.props.data&&this.props.data.markets).length&&(this.updateMarkets(e),this.setState({newName:""}))}edit(e,t){this.updateMarkets(S(this.props.data&&this.props.data.markets,e,t))}remove(e){this.updateMarkets(M(this.props.data&&this.props.data.markets,e))}move(e,t){this.updateMarkets(C(this.props.data&&this.props.data.markets,e,t))}renderMarketRow(e,t,r,n){return a(X,{key:t,position:t+1,last:t===r.length-1,tokens:n,actions:[a(c,{key:"up",disabled:t===0,onClick:()=>this.move(t,-1),title:i("Nach oben","Move up"),tokens:n},"↑"),a(c,{key:"down",disabled:t===r.length-1,onClick:()=>this.move(t,1),title:i("Nach unten","Move down"),tokens:n},"↓"),a(c,{key:"remove",onClick:()=>this.remove(t),title:i("Markt löschen","Delete market"),tokens:n},"×")]},a(ee,null,[a(te,{key:"enabled",checked:e.enabled!==!1,label:i("Aktiv","Active"),onChange:s=>this.edit(t,{enabled:s.target.checked}),tokens:n}),a(h,{key:"order",label:i("Reihenfolge","Order"),tokens:n},a(re,{ariaLabel:i("Reihenfolge bearbeiten","Edit order"),onChange:s=>this.edit(t,{order:Number(s.target.value)}),tokens:n,value:e.order==null?"":String(e.order)})),a(h,{key:"name",label:i("Markt","Market"),tokens:n},a(m,{ariaLabel:i("Marktnamen bearbeiten","Edit market name"),onChange:s=>this.edit(t,{name:s.target.value}),tokens:n,value:String(e.name||"")})),a(h,{key:"aliases",className:"shoppingroute-markets-aliases",label:i("Aliase","Aliases"),tokens:n},a(m,{ariaLabel:i("Aliase bearbeiten","Edit aliases"),onChange:s=>this.edit(t,{aliases:s.target.value}),placeholder:i("Kommagetrennte Namen","Comma-separated names"),tokens:n,value:String(e.aliases||"")}))]))}render(){const e=l(this.props.data&&this.props.data.markets),t=Y(this.props.themeType),r=[a("style",{key:"markets-responsive-styles"},Z),...f({title:i("Märkte / Hauptkategorien","Markets / main categories"),hint:i("Die Marktreihenfolge ist die oberste Sortierebene. Aliase werden kommagetrennt angegeben.","Market order is the top sorting level. Aliases are entered comma-separated."),tokens:t})];return e.length?r.push(a(Q,{key:"markets",tokens:t},e.map((n,s)=>this.renderMarketRow(n,s,e,t)))):r.push(a("div",{key:"empty",style:{color:t.muted,padding:"12px 0",marginBottom:"18px"}},i("Noch keine Märkte vorhanden.","No markets configured yet."))),r.push(...f({title:i("Markt hinzufügen","Add market"),tokens:t,titleKey:"add-title",hintKey:"add-hint"})),r.push(a(G,{key:"add-controls"},[a(m,{key:"name",ariaLabel:i("Neuer Markt","New market"),onChange:n=>this.setState({newName:n.target.value}),onKeyDown:n=>{n.key==="Enter"&&this.add()},placeholder:i("Name des Marktes","Market name"),tokens:t,value:this.state.newName}),a(q,{key:"add",disabled:!this.state.newName.trim(),onClick:()=>this.add(),tokens:t},i("Hinzufügen","Add"))])),a(U,null,r)}}u.exports={Components:{MarketsEditor:oe},MarketsEditorModel:{addMarket:w,editMarket:S,marketRows:l,moveMarket:C,nextMarketOrder:v,removeMarket:M}};const ne=(u.exports==null?{}:u.exports).default||u.exports,le=ne.Components;export{le as default};
