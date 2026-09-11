import"../marketsEditor.js";import{_ as b,a as x}from"./_virtual_mf___mfe_internal__ShoppingRouteMarketsSet__mf_owner__1__loadShare__react__loadShare__.js-v8gr9ECk.js";import"./vite-preload-helper-Dp1pzeXC.js";import"./index-2HOz3j7B.js";var p={exports:{}};const f=b||x,s=f.createElement,C=`
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
`;function S(o,e){return(typeof navigator<"u"?String(navigator.language||"").toLowerCase():"de").startsWith("de")?o:e}function $(o){const e=String(o||"").toLowerCase()==="dark";return{border:e?"#555":"#d5d5d5",background:e?"#2b2b2b":"#fff",muted:e?"#bbb":"#666",buttonBackground:e?"#3b3b3b":"#f4f4f4"}}function A({children:o}){return s(f.Fragment,null,[s("style",{key:"responsive-styles"},C),s("div",{key:"content",style:{width:"100%"}},o)])}function R({title:o,hint:e,tokens:t,titleKey:r="title",hintKey:a="hint"}){return[s("h3",{key:r,style:{margin:"0 0 6px"}},o),e?s("div",{key:a,style:{color:t.muted,marginBottom:"10px",fontSize:"0.92rem"}},e):null]}function E({children:o,tokens:e,marginBottom:t="18px"}){return s("div",{style:{border:`1px solid ${e.border}`,borderRadius:"6px",overflow:"hidden",marginBottom:t}},o)}function B({position:o,children:e,actions:t,last:r,tokens:a}){return s("div",{className:"shoppingroute-editor-row",style:{borderBottom:r?"none":`1px solid ${a.border}`,background:a.background}},[s("div",{key:"position",style:{color:a.muted,textAlign:"right",paddingRight:"6px"}},String(o)),s("div",{key:"content",style:{minWidth:0}},e),s("div",{key:"actions",className:"shoppingroute-editor-row-actions"},t)])}function L({children:o,disabled:e=!1,onClick:t,title:r,tokens:a}){return s("button",{className:"shoppingroute-editor-button",type:"button",disabled:e,title:r,"aria-label":r,onClick:t,style:{width:"38px",height:"32px",border:`1px solid ${a.border}`,borderRadius:"4px",background:a.buttonBackground,color:"inherit",cursor:e?"default":"pointer",opacity:e?.4:1}},o)}function F({ariaLabel:o,onChange:e,onKeyDown:t,placeholder:r,tokens:a,value:d}){return s("input",{className:"shoppingroute-editor-control",type:"text",value:d,placeholder:r,"aria-label":o,onChange:e,onKeyDown:t,style:{width:"100%",padding:"9px 12px",borderRadius:"4px",border:`1px solid ${a.border}`,background:a.background,color:"inherit"}})}function T({children:o,disabled:e=!1,onClick:t,tokens:r}){return s("button",{className:"shoppingroute-editor-button",type:"button",disabled:e,onClick:t,style:{minHeight:"38px",padding:"7px 16px",border:`1px solid ${r.border}`,borderRadius:"4px",background:r.buttonBackground,color:"inherit",cursor:e?"default":"pointer",fontWeight:600,opacity:e?.4:1}},o)}function H({children:o}){return s("div",{className:"shoppingroute-editor-add-controls"},o)}p.exports={ActionButton:T,AddControls:H,BorderedList:E,EditorFrame:A,EditorRow:B,IconButton:L,SectionHeading:R,TextInput:F,text:S,themeTokens:$};const k=(p.exports==null?{}:p.exports).default||p.exports,z=Object.freeze(Object.defineProperty({__proto__:null,default:k},Symbol.toStringTag,{value:"Module"}));var u={exports:{}};const y=b||x,{ActionButton:j,AddControls:D,BorderedList:I,EditorFrame:J,EditorRow:K,IconButton:c,SectionHeading:g,TextInput:m,text:i,themeTokens:O}=k||z,n=y.createElement,W=`
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
`;function G({children:o}){return n("div",{className:"shoppingroute-markets-fields"},o)}function h({children:o,className:e,label:t,tokens:r}){return n("label",{className:e,style:{display:"flex",minWidth:0,flexDirection:"column",gap:"4px"}},[n("span",{key:"label",style:{color:r.muted,fontSize:"0.78rem"}},t),o])}function P({checked:o,label:e,onChange:t,tokens:r}){return n("label",{style:{display:"flex",alignItems:"center",gap:"8px",minHeight:"38px",color:"inherit"}},[n("input",{key:"input",type:"checkbox",checked:o,onChange:t,style:{width:"18px",height:"18px",accentColor:"#3399cc"}}),n("span",{key:"label",style:{color:r.muted}},e)])}function q({ariaLabel:o,onChange:e,tokens:t,value:r}){return n("input",{className:"shoppingroute-editor-control",type:"number",value:r,"aria-label":o,onChange:e,style:{width:"100%",padding:"9px 12px",borderRadius:"4px",border:`1px solid ${t.border}`,background:t.background,color:"inherit"}})}function l(o){return(Array.isArray(o)?o:[]).map(e=>e&&typeof e=="object"&&!Array.isArray(e)?{...e}:{enabled:!0,order:999,name:String(e||""),aliases:""})}function v(o){const e=l(o).map(t=>Number(t.order)).filter(Number.isFinite);return e.length?Math.max(...e)+10:10}function w(o,e){const t=String(e||"").trim(),r=l(o);return t&&r.push({enabled:!0,order:v(r),name:t,aliases:""}),r}function _(o,e,t){const r=l(o);return e>=0&&e<r.length&&(r[e]={...r[e],...t}),r}function M(o,e){const t=l(o);return e>=0&&e<t.length&&t.splice(e,1),t}function N(o,e,t){const r=l(o),a=e+t;return e>=0&&e<r.length&&a>=0&&a<r.length&&([r[e],r[a]]=[r[a],r[e]]),r}class Q extends y.Component{constructor(e){super(e),this.state={newName:""}}updateMarkets(e){this.props.onChange({...this.props.data||{},markets:e},!0)}add(){const e=w(this.props.data&&this.props.data.markets,this.state.newName);e.length!==l(this.props.data&&this.props.data.markets).length&&(this.updateMarkets(e),this.setState({newName:""}))}edit(e,t){this.updateMarkets(_(this.props.data&&this.props.data.markets,e,t))}remove(e){this.updateMarkets(M(this.props.data&&this.props.data.markets,e))}move(e,t){this.updateMarkets(N(this.props.data&&this.props.data.markets,e,t))}renderMarketRow(e,t,r,a){return n(K,{key:t,position:t+1,last:t===r.length-1,tokens:a,actions:[n(c,{key:"up",disabled:t===0,onClick:()=>this.move(t,-1),title:i("Nach oben","Move up"),tokens:a},"↑"),n(c,{key:"down",disabled:t===r.length-1,onClick:()=>this.move(t,1),title:i("Nach unten","Move down"),tokens:a},"↓"),n(c,{key:"remove",onClick:()=>this.remove(t),title:i("Markt löschen","Delete market"),tokens:a},"×")]},n(G,null,[n(P,{key:"enabled",checked:e.enabled!==!1,label:i("Aktiv","Active"),onChange:d=>this.edit(t,{enabled:d.target.checked}),tokens:a}),n(h,{key:"order",label:i("Reihenfolge","Order"),tokens:a},n(q,{ariaLabel:i("Reihenfolge bearbeiten","Edit order"),onChange:d=>this.edit(t,{order:Number(d.target.value)}),tokens:a,value:e.order==null?"":String(e.order)})),n(h,{key:"name",label:i("Markt","Market"),tokens:a},n(m,{ariaLabel:i("Marktnamen bearbeiten","Edit market name"),onChange:d=>this.edit(t,{name:d.target.value}),tokens:a,value:String(e.name||"")})),n(h,{key:"aliases",className:"shoppingroute-markets-aliases",label:i("Aliase","Aliases"),tokens:a},n(m,{ariaLabel:i("Aliase bearbeiten","Edit aliases"),onChange:d=>this.edit(t,{aliases:d.target.value}),placeholder:i("Kommagetrennte Namen","Comma-separated names"),tokens:a,value:String(e.aliases||"")}))]))}render(){const e=l(this.props.data&&this.props.data.markets),t=O(this.props.themeType),r=[n("style",{key:"markets-responsive-styles"},W),...g({title:i("Märkte / Hauptkategorien","Markets / main categories"),hint:i("Die Marktreihenfolge ist die oberste Sortierebene. Aliase werden kommagetrennt angegeben.","Market order is the top sorting level. Aliases are entered comma-separated."),tokens:t})];return e.length?r.push(n(I,{key:"markets",tokens:t},e.map((a,d)=>this.renderMarketRow(a,d,e,t)))):r.push(n("div",{key:"empty",style:{color:t.muted,padding:"12px 0",marginBottom:"18px"}},i("Noch keine Märkte vorhanden.","No markets configured yet."))),r.push(...g({title:i("Markt hinzufügen","Add market"),tokens:t,titleKey:"add-title",hintKey:"add-hint"})),r.push(n(D,{key:"add-controls"},[n(m,{key:"name",ariaLabel:i("Neuer Markt","New market"),onChange:a=>this.setState({newName:a.target.value}),onKeyDown:a=>{a.key==="Enter"&&this.add()},placeholder:i("Name des Marktes","Market name"),tokens:t,value:this.state.newName}),n(j,{key:"add",disabled:!this.state.newName.trim(),onClick:()=>this.add(),tokens:t},i("Hinzufügen","Add"))])),n(J,null,r)}}u.exports={Components:{MarketsEditor:Q},MarketsEditorModel:{addMarket:w,editMarket:_,marketRows:l,moveMarket:N,nextMarketOrder:v,removeMarket:M}};const U=(u.exports==null?{}:u.exports).default||u.exports,ee=U.Components;export{ee as default};
