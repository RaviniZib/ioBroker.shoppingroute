import{a as b,_ as f}from"./_virtual_mf___mfe_internal__ShoppingRouteMarketsSet__mf_owner__240489627525110__loadShare__react__loadShare__.js-Bdlvn8vS.js";import"./vite-preload-helper-Dp1pzeXC.js";var p={exports:{}};const k=b||f,d=k.createElement,E=`
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
`;function R(o,e){return(typeof navigator<"u"?String(navigator.language||"").toLowerCase():"de").startsWith("de")?o:e}function B(o){const e=String(o||"").toLowerCase()==="dark";return{border:e?"#555":"#d5d5d5",background:e?"#2b2b2b":"#fff",muted:e?"#bbb":"#666",buttonBackground:e?"#3b3b3b":"#f4f4f4"}}function D({children:o}){return d(k.Fragment,null,[d("style",{key:"responsive-styles"},E),d("div",{key:"content",style:{width:"100%"}},o)])}function L({title:o,hint:e,tokens:t,titleKey:r="title",hintKey:a="hint"}){return[d("h3",{key:r,style:{margin:"0 0 6px"}},o),e?d("div",{key:a,style:{color:t.muted,marginBottom:"10px",fontSize:"0.92rem"}},e):null]}function T({children:o,tokens:e,marginBottom:t="18px"}){return d("div",{style:{border:`1px solid ${e.border}`,borderRadius:"6px",overflow:"hidden",marginBottom:t}},o)}function F({position:o,children:e,actions:t,last:r,tokens:a,draggable:i=!1,onDragStart:N,onDragOver:A,onDrop:$}){return d("div",{className:"shoppingroute-editor-row",draggable:i,onDragStart:N,onDragOver:A,onDrop:$,style:{borderBottom:r?"none":`1px solid ${a.border}`,background:a.background}},[d("div",{key:"position",style:{color:a.muted,textAlign:"right",paddingRight:"6px"}},(i?"⋮⋮ ":"")+String(o)),d("div",{key:"content",style:{minWidth:0}},e),d("div",{key:"actions",className:"shoppingroute-editor-row-actions"},t)])}function H({children:o,disabled:e=!1,onClick:t,title:r,tokens:a}){return d("button",{className:"shoppingroute-editor-button",type:"button",disabled:e,title:r,"aria-label":r,onClick:t,style:{width:"38px",height:"32px",border:`1px solid ${a.border}`,borderRadius:"4px",background:a.buttonBackground,color:"inherit",cursor:e?"default":"pointer",opacity:e?.4:1}},o)}function z({ariaLabel:o,onChange:e,onKeyDown:t,placeholder:r,tokens:a,value:i}){return d("input",{className:"shoppingroute-editor-control",type:"text",value:i,placeholder:r,"aria-label":o,onChange:e,onKeyDown:t,style:{width:"100%",padding:"9px 12px",borderRadius:"4px",border:`1px solid ${a.border}`,background:a.background,color:"inherit"}})}function j({children:o,disabled:e=!1,onClick:t,tokens:r}){return d("button",{className:"shoppingroute-editor-button",type:"button",disabled:e,onClick:t,style:{minHeight:"38px",padding:"7px 16px",border:`1px solid ${r.border}`,borderRadius:"4px",background:r.buttonBackground,color:"inherit",cursor:e?"default":"pointer",fontWeight:600,opacity:e?.4:1}},o)}function O({children:o}){return d("div",{className:"shoppingroute-editor-add-controls"},o)}p.exports={ActionButton:j,AddControls:O,BorderedList:T,EditorFrame:D,EditorRow:F,IconButton:H,SectionHeading:L,TextInput:z,text:R,themeTokens:B};const x=(p.exports==null?{}:p.exports).default||p.exports,I=Object.freeze(Object.defineProperty({__proto__:null,default:x},Symbol.toStringTag,{value:"Module"}));var u={exports:{}};const y=b||f,{ActionButton:J,AddControls:K,BorderedList:W,EditorFrame:U,EditorRow:G,IconButton:c,SectionHeading:g,TextInput:m,text:s,themeTokens:P}=x||I,n=y.createElement,q=`
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
`;function Q({children:o}){return n("div",{className:"shoppingroute-markets-fields"},o)}function h({children:o,className:e,label:t,tokens:r}){return n("label",{className:e,style:{display:"flex",minWidth:0,flexDirection:"column",gap:"4px"}},[n("span",{key:"label",style:{color:r.muted,fontSize:"0.78rem"}},t),o])}function V({checked:o,label:e,onChange:t,tokens:r}){return n("label",{style:{display:"flex",alignItems:"center",gap:"8px",minHeight:"38px",color:"inherit"}},[n("input",{key:"input",type:"checkbox",checked:o,onChange:t,style:{width:"18px",height:"18px",accentColor:"#3399cc"}}),n("span",{key:"label",style:{color:r.muted}},e)])}function X({ariaLabel:o,onChange:e,tokens:t,value:r}){return n("input",{className:"shoppingroute-editor-control",type:"number",value:r,"aria-label":o,onChange:e,style:{width:"100%",padding:"9px 12px",borderRadius:"4px",border:`1px solid ${t.border}`,background:t.background,color:"inherit"}})}function l(o){return(Array.isArray(o)?o:[]).map(e=>e&&typeof e=="object"&&!Array.isArray(e)?{...e}:{enabled:!0,order:999,name:String(e||""),aliases:""})}function v(o){const e=l(o).map(t=>Number(t.order)).filter(Number.isFinite);return e.length?Math.max(...e)+10:10}function w(o,e){const t=String(e||"").trim().toLocaleUpperCase("de-DE"),r=l(o);return t&&r.push({enabled:!0,order:v(r),name:t,aliases:""}),r}function _(o,e,t){const r=l(o);return e>=0&&e<r.length&&(r[e]={...r[e],...t},"name"in t&&(r[e].name=String(r[e].name||"").trim().toLocaleUpperCase("de-DE"))),r}function M(o,e){const t=l(o);return e>=0&&e<t.length&&t.splice(e,1),t}function C(o,e,t){const r=l(o),a=e+t;return e>=0&&e<r.length&&a>=0&&a<r.length&&([r[e],r[a]]=[r[a],r[e]]),r}function S(o,e,t){const r=l(o);if(e<0||t<0||e>=r.length||t>=r.length||e===t)return r;const[a]=r.splice(e,1);return r.splice(t,0,a),r}class Y extends y.Component{constructor(e){super(e),this.state={newName:"",dragIndex:-1}}updateMarkets(e,t=!0){this.props.onChange({...this.props.data||{},markets:e},t)}add(){const e=w(this.props.data&&this.props.data.markets,this.state.newName);e.length!==l(this.props.data&&this.props.data.markets).length&&(this.updateMarkets(e,!0),this.setState({newName:""}))}edit(e,t){this.updateMarkets(_(this.props.data&&this.props.data.markets,e,t),!1)}remove(e){this.updateMarkets(M(this.props.data&&this.props.data.markets,e),!0)}move(e,t){this.updateMarkets(C(this.props.data&&this.props.data.markets,e,t),!0)}drop(e){this.state.dragIndex<0||(this.updateMarkets(S(this.props.data&&this.props.data.markets,this.state.dragIndex,e),!0),this.setState({dragIndex:-1}))}renderMarketRow(e,t,r,a){return n(G,{key:t,position:t+1,last:t===r.length-1,tokens:a,draggable:!0,onDragStart:i=>{this.setState({dragIndex:t}),i.dataTransfer.effectAllowed="move"},onDragOver:i=>i.preventDefault(),onDrop:i=>{i.preventDefault(),this.drop(t)},actions:[n(c,{key:"up",disabled:t===0,onClick:()=>this.move(t,-1),title:s("Nach oben","Move up"),tokens:a},"↑"),n(c,{key:"down",disabled:t===r.length-1,onClick:()=>this.move(t,1),title:s("Nach unten","Move down"),tokens:a},"↓"),n(c,{key:"remove",onClick:()=>this.remove(t),title:s("Markt löschen","Delete market"),tokens:a},"×")]},n(Q,null,[n(V,{key:"enabled",checked:e.enabled!==!1,label:s("Aktiv","Active"),onChange:i=>this.edit(t,{enabled:i.target.checked}),tokens:a}),n(h,{key:"order",label:s("Reihenfolge","Order"),tokens:a},n(X,{ariaLabel:s("Reihenfolge bearbeiten","Edit order"),onChange:i=>this.edit(t,{order:Number(i.target.value)}),tokens:a,value:e.order==null?"":String(e.order)})),n(h,{key:"name",label:s("Markt","Market"),tokens:a},n(m,{ariaLabel:s("Marktnamen bearbeiten","Edit market name"),onChange:i=>this.edit(t,{name:i.target.value}),tokens:a,value:String(e.name||"")})),n(h,{key:"aliases",className:"shoppingroute-markets-aliases",label:s("Aliase","Aliases"),tokens:a},n(m,{ariaLabel:s("Aliase bearbeiten","Edit aliases"),onChange:i=>this.edit(t,{aliases:i.target.value}),placeholder:s("Kommagetrennte Namen","Comma-separated names"),tokens:a,value:String(e.aliases||"")}))]))}render(){const e=l(this.props.data&&this.props.data.markets),t=P(this.props.themeType),r=[n("style",{key:"markets-responsive-styles"},q),...g({title:s("Märkte / Hauptkategorien","Markets / main categories"),hint:s("Die Marktreihenfolge ist die oberste Sortierebene. Aliase werden kommagetrennt angegeben.","Market order is the top sorting level. Aliases are entered comma-separated."),tokens:t})];return e.length?r.push(n(W,{key:"markets",tokens:t},e.map((a,i)=>this.renderMarketRow(a,i,e,t)))):r.push(n("div",{key:"empty",style:{color:t.muted,padding:"12px 0",marginBottom:"18px"}},s("Noch keine Märkte vorhanden.","No markets configured yet."))),r.push(...g({title:s("Markt hinzufügen","Add market"),tokens:t,titleKey:"add-title",hintKey:"add-hint"})),r.push(n(K,{key:"add-controls"},[n(m,{key:"name",ariaLabel:s("Neuer Markt","New market"),onChange:a=>this.setState({newName:a.target.value}),onKeyDown:a=>{a.key==="Enter"&&this.add()},placeholder:s("Name des Marktes","Market name"),tokens:t,value:this.state.newName}),n(J,{key:"add",disabled:!this.state.newName.trim(),onClick:()=>this.add(),tokens:t},s("Hinzufügen","Add"))])),n(U,null,r)}}u.exports={Components:{MarketsEditor:Y},MarketsEditorModel:{addMarket:w,editMarket:_,marketRows:l,moveMarket:C,moveMarketTo:S,nextMarketOrder:v,removeMarket:M}};const Z=(u.exports==null?{}:u.exports).default||u.exports,re=Z.Components;export{re as default};
