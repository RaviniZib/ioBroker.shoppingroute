import"./hostInit-DeIlwHf1.js";import{i as C,S as $}from"./ShoppingRouteMarketsSet__mf_v__runtimeInit__mf_v__-Dx7i8THH.js";import{g as A}from"./_commonjsHelpers-CqkleIqs.js";import"./preload-helper-Dp1pzeXC.js";function R(r,e){for(var t=0;t<e.length;t++){const o=e[t];if(typeof o!="string"&&!Array.isArray(o)){for(const i in o)if(i!=="default"&&!(i in r)){const s=Object.getOwnPropertyDescriptor(o,i);s&&Object.defineProperty(r,i,s.get?s:{enumerable:!0,get:()=>o[i]})}}}return Object.freeze(Object.defineProperty(r,Symbol.toStringTag,{value:"Module"}))}const{loadShare:B}=C,{initPromise:E}=$,F=E.then(r=>B("react",{customShareInfo:{shareConfig:{singleton:!0,strictVersion:!1,requiredVersion:">=18"}}})),I=await F.then(r=>r());var x=I;const h=A(x),f=R({__proto__:null,default:h},[x]);var d={exports:{}};const y=h||f,a=y.createElement,j=`
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
    .shoppingroute-editor-form-grid {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 18px;
    }
    .shoppingroute-editor-form-field {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 6px;
    }
    .shoppingroute-editor-form-field label {
        color: inherit;
    }
    .shoppingroute-editor-field-label {
        font-size: 0.8rem;
        font-weight: 600;
    }
    .shoppingroute-editor-control {
        box-sizing: border-box;
        min-width: 240px;
        max-width: 100%;
    }
    .shoppingroute-editor-textarea {
        min-height: 78px;
        resize: vertical;
    }
    .shoppingroute-editor-checkbox {
        width: 18px;
        height: 18px;
        accent-color: #3399cc;
    }
    .shoppingroute-editor-inline-checkbox {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 38px;
    }
    .shoppingroute-editor-pill-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .shoppingroute-editor-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid currentColor;
        opacity: 0.88;
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
        .shoppingroute-editor-form-grid {
            gap: 10px;
        }
    }
`;function L(r,e){return(typeof navigator<"u"?String(navigator.language||"").toLowerCase():"de").startsWith("de")?r:e}function T(r){const e=String(r||"").toLowerCase()==="dark";return{border:e?"#555":"#d5d5d5",background:e?"#2b2b2b":"#fff",muted:e?"#bbb":"#666",buttonBackground:e?"#3b3b3b":"#f4f4f4"}}function z({children:r}){return a(y.Fragment,null,[a("style",{key:"responsive-styles"},j),a("div",{key:"content",style:{width:"100%"}},r)])}function O({title:r,hint:e,tokens:t,titleKey:o="title",hintKey:i="hint"}){return[a("h3",{key:o,style:{margin:"0 0 6px"}},r),e?a("div",{key:i,style:{color:t.muted,marginBottom:"10px",fontSize:"0.92rem"}},e):null]}function H({children:r,tokens:e,marginBottom:t="18px"}){return a("div",{style:{border:`1px solid ${e.border}`,borderRadius:"6px",overflow:"hidden",marginBottom:t}},r)}function P({position:r,children:e,actions:t,last:o,tokens:i}){return a("div",{className:"shoppingroute-editor-row",style:{borderBottom:o?"none":`1px solid ${i.border}`,background:i.background}},[a("div",{key:"position",style:{color:i.muted,textAlign:"right",paddingRight:"6px"}},String(r)),a("div",{key:"content",style:{minWidth:0}},e),a("div",{key:"actions",className:"shoppingroute-editor-row-actions"},t)])}function D({children:r,disabled:e=!1,onClick:t,title:o,tokens:i}){return a("button",{className:"shoppingroute-editor-button",type:"button",disabled:e,title:o,"aria-label":o,onClick:t,style:{width:"38px",height:"32px",border:`1px solid ${i.border}`,borderRadius:"4px",background:i.buttonBackground,color:"inherit",cursor:e?"default":"pointer",opacity:e?.4:1}},r)}function J({ariaLabel:r,onChange:e,onKeyDown:t,placeholder:o,tokens:i,value:s}){return a("input",{className:"shoppingroute-editor-control",type:"text",value:s,placeholder:o,"aria-label":r,onChange:e,onKeyDown:t,style:{width:"100%",padding:"9px 12px",borderRadius:"4px",border:`1px solid ${i.border}`,background:i.background,color:"inherit"}})}function K({ariaLabel:r,onChange:e,placeholder:t,tokens:o,value:i}){return a("textarea",{className:"shoppingroute-editor-control shoppingroute-editor-textarea",value:i,placeholder:t,"aria-label":r,onChange:e,style:{width:"100%",padding:"9px 12px",borderRadius:"4px",border:`1px solid ${o.border}`,background:o.background,color:"inherit"}})}function W({ariaLabel:r,min:e,max:t,onChange:o,tokens:i,value:s}){return a("input",{className:"shoppingroute-editor-control",type:"number",value:s,min:e,max:t,"aria-label":r,onChange:o,style:{width:"100%",padding:"9px 12px",borderRadius:"4px",border:`1px solid ${i.border}`,background:i.background,color:"inherit"}})}function G({ariaLabel:r,onChange:e,options:t,tokens:o,value:i}){return a("select",{className:"shoppingroute-editor-control","aria-label":r,onChange:e,value:i,style:{width:"100%",padding:"9px 12px",borderRadius:"4px",border:`1px solid ${o.border}`,background:o.background,color:"inherit"}},t.map(s=>a("option",{key:`${s.value}`,value:s.value},s.label)))}function V({checked:r,label:e,onChange:t}){return a("label",{className:"shoppingroute-editor-inline-checkbox"},[a("input",{key:"input",className:"shoppingroute-editor-checkbox",type:"checkbox",checked:r,onChange:t}),a("span",{key:"label"},e)])}function q({children:r,label:e,tokens:t,span:o=12}){return a("div",{className:"shoppingroute-editor-form-field",style:{gridColumn:`span ${o}`}},[e?a("div",{key:"label",className:"shoppingroute-editor-field-label",style:{color:t.muted}},e):null,r])}function Q({children:r}){return a("div",{className:"shoppingroute-editor-form-grid"},r)}function U({children:r}){return a("div",{className:"shoppingroute-editor-pill-list"},r)}function X({children:r,tokens:e}){return a("span",{className:"shoppingroute-editor-pill",style:{borderColor:e.border,background:e.buttonBackground}},r)}function Y({children:r,disabled:e=!1,onClick:t,tokens:o}){return a("button",{className:"shoppingroute-editor-button",type:"button",disabled:e,onClick:t,style:{minHeight:"38px",padding:"7px 16px",border:`1px solid ${o.border}`,borderRadius:"4px",background:o.buttonBackground,color:"inherit",cursor:e?"default":"pointer",fontWeight:600,opacity:e?.4:1}},r)}function Z({children:r}){return a("div",{className:"shoppingroute-editor-add-controls"},r)}d.exports={ActionButton:Y,AddControls:Z,BorderedList:H,CheckboxInput:V,EditorFrame:z,EditorRow:P,Field:q,FormGrid:Q,IconButton:D,NumberInput:W,Pill:X,PillList:U,SectionHeading:O,SelectInput:G,TextInput:J,TextAreaInput:K,text:L,themeTokens:T};const k=(d.exports==null?{}:d.exports).default||d.exports,ee=Object.freeze(Object.defineProperty({__proto__:null,default:k},Symbol.toStringTag,{value:"Module"}));var u={exports:{}};const _=h||f,{ActionButton:te,AddControls:re,BorderedList:oe,EditorFrame:ie,EditorRow:ne,IconButton:c,SectionHeading:b,TextInput:m,text:p,themeTokens:ae}=k||ee,n=_.createElement,se=`
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
`;function pe({children:r}){return n("div",{className:"shoppingroute-markets-fields"},r)}function g({children:r,className:e,label:t,tokens:o}){return n("label",{className:e,style:{display:"flex",minWidth:0,flexDirection:"column",gap:"4px"}},[n("span",{key:"label",style:{color:o.muted,fontSize:"0.78rem"}},t),r])}function le({checked:r,label:e,onChange:t,tokens:o}){return n("label",{style:{display:"flex",alignItems:"center",gap:"8px",minHeight:"38px",color:"inherit"}},[n("input",{key:"input",type:"checkbox",checked:r,onChange:t,style:{width:"18px",height:"18px",accentColor:"#3399cc"}}),n("span",{key:"label",style:{color:o.muted}},e)])}function de({ariaLabel:r,onChange:e,tokens:t,value:o}){return n("input",{className:"shoppingroute-editor-control",type:"number",value:o,"aria-label":r,onChange:e,style:{width:"100%",padding:"9px 12px",borderRadius:"4px",border:`1px solid ${t.border}`,background:t.background,color:"inherit"}})}function l(r){return(Array.isArray(r)?r:[]).map(e=>e&&typeof e=="object"&&!Array.isArray(e)?{...e}:{enabled:!0,order:999,name:String(e||""),aliases:""})}function v(r){const e=l(r).map(t=>Number(t.order)).filter(Number.isFinite);return e.length?Math.max(...e)+10:10}function w(r,e){const t=String(e||"").trim(),o=l(r);return t&&o.push({enabled:!0,order:v(o),name:t,aliases:""}),o}function N(r,e,t){const o=l(r);return e>=0&&e<o.length&&(o[e]={...o[e],...t}),o}function S(r,e){const t=l(r);return e>=0&&e<t.length&&t.splice(e,1),t}function M(r,e,t){const o=l(r),i=e+t;return e>=0&&e<o.length&&i>=0&&i<o.length&&([o[e],o[i]]=[o[i],o[e]]),o}class ue extends _.Component{constructor(e){super(e),this.state={newName:""}}updateMarkets(e){this.props.onChange({...this.props.data||{},markets:e},!0)}add(){const e=w(this.props.data&&this.props.data.markets,this.state.newName);e.length!==l(this.props.data&&this.props.data.markets).length&&(this.updateMarkets(e),this.setState({newName:""}))}edit(e,t){this.updateMarkets(N(this.props.data&&this.props.data.markets,e,t))}remove(e){this.updateMarkets(S(this.props.data&&this.props.data.markets,e))}move(e,t){this.updateMarkets(M(this.props.data&&this.props.data.markets,e,t))}renderMarketRow(e,t,o,i){return n(ne,{key:t,position:t+1,last:t===o.length-1,tokens:i,actions:[n(c,{key:"up",disabled:t===0,onClick:()=>this.move(t,-1),title:p("Nach oben","Move up"),tokens:i},"↑"),n(c,{key:"down",disabled:t===o.length-1,onClick:()=>this.move(t,1),title:p("Nach unten","Move down"),tokens:i},"↓"),n(c,{key:"remove",onClick:()=>this.remove(t),title:p("Markt löschen","Delete market"),tokens:i},"×")]},n(pe,null,[n(le,{key:"enabled",checked:e.enabled!==!1,label:p("Aktiv","Active"),onChange:s=>this.edit(t,{enabled:s.target.checked}),tokens:i}),n(g,{key:"order",label:p("Reihenfolge","Order"),tokens:i},n(de,{ariaLabel:p("Reihenfolge bearbeiten","Edit order"),onChange:s=>this.edit(t,{order:Number(s.target.value)}),tokens:i,value:e.order==null?"":String(e.order)})),n(g,{key:"name",label:p("Markt","Market"),tokens:i},n(m,{ariaLabel:p("Marktnamen bearbeiten","Edit market name"),onChange:s=>this.edit(t,{name:s.target.value}),tokens:i,value:String(e.name||"")})),n(g,{key:"aliases",className:"shoppingroute-markets-aliases",label:p("Aliase","Aliases"),tokens:i},n(m,{ariaLabel:p("Aliase bearbeiten","Edit aliases"),onChange:s=>this.edit(t,{aliases:s.target.value}),placeholder:p("Kommagetrennte Namen","Comma-separated names"),tokens:i,value:String(e.aliases||"")}))]))}render(){const e=l(this.props.data&&this.props.data.markets),t=ae(this.props.themeType),o=[n("style",{key:"markets-responsive-styles"},se),...b({title:p("Märkte / Hauptkategorien","Markets / main categories"),hint:p("Die Marktreihenfolge ist die oberste Sortierebene. Aliase werden kommagetrennt angegeben.","Market order is the top sorting level. Aliases are entered comma-separated."),tokens:t})];return e.length?o.push(n(oe,{key:"markets",tokens:t},e.map((i,s)=>this.renderMarketRow(i,s,e,t)))):o.push(n("div",{key:"empty",style:{color:t.muted,padding:"12px 0",marginBottom:"18px"}},p("Noch keine Märkte vorhanden.","No markets configured yet."))),o.push(...b({title:p("Markt hinzufügen","Add market"),tokens:t,titleKey:"add-title",hintKey:"add-hint"})),o.push(n(re,{key:"add-controls"},[n(m,{key:"name",ariaLabel:p("Neuer Markt","New market"),onChange:i=>this.setState({newName:i.target.value}),onKeyDown:i=>{i.key==="Enter"&&this.add()},placeholder:p("Name des Marktes","Market name"),tokens:t,value:this.state.newName}),n(te,{key:"add",disabled:!this.state.newName.trim(),onClick:()=>this.add(),tokens:t},p("Hinzufügen","Add"))])),n(ie,null,o)}}u.exports={Components:{MarketsEditor:ue},MarketsEditorModel:{addMarket:w,editMarket:N,marketRows:l,moveMarket:M,nextMarketOrder:v,removeMarket:S}};const ce=(u.exports==null?{}:u.exports).default||u.exports,xe=ce.Components;export{xe as default};
