import{a as f,_ as b}from"./_virtual_mf___mfe_internal__ShoppingRouteProductGroupsSet__mf_owner__260837768108578__loadShare__react__loadShare__.js-BZoDZKLb.js";import"./vite-preload-helper-Dp1pzeXC.js";var l={exports:{}};const y=f||b,i=y.createElement,$=`
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
`;function N(r,t){return(typeof navigator<"u"?String(navigator.language||"").toLowerCase():"de").startsWith("de")?r:t}function B(r){const t=String(r||"").toLowerCase()==="dark";return{border:t?"#555":"#d5d5d5",background:t?"#2b2b2b":"#fff",muted:t?"#bbb":"#666",buttonBackground:t?"#3b3b3b":"#f4f4f4"}}function A({children:r}){return i(y.Fragment,null,[i("style",{key:"responsive-styles"},$),i("div",{key:"content",style:{width:"100%"}},r)])}function E({title:r,hint:t,tokens:e,titleKey:o="title",hintKey:n="hint"}){return[i("h3",{key:o,style:{margin:"0 0 6px"}},r),t?i("div",{key:n,style:{color:e.muted,marginBottom:"10px",fontSize:"0.92rem"}},t):null]}function R({children:r,tokens:t,marginBottom:e="18px"}){return i("div",{style:{border:`1px solid ${t.border}`,borderRadius:"6px",overflow:"hidden",marginBottom:e}},r)}function T({position:r,children:t,actions:e,last:o,tokens:n,draggable:s=!1,onDragStart:d,onDragOver:C,onDrop:G}){return i("div",{className:"shoppingroute-editor-row",draggable:s,onDragStart:d,onDragOver:C,onDrop:G,style:{borderBottom:o?"none":`1px solid ${n.border}`,background:n.background}},[i("div",{key:"position",style:{color:n.muted,textAlign:"right",paddingRight:"6px"}},(s?"⋮⋮ ":"")+String(r)),i("div",{key:"content",style:{minWidth:0}},t),i("div",{key:"actions",className:"shoppingroute-editor-row-actions"},e)])}function D({children:r,disabled:t=!1,onClick:e,title:o,tokens:n}){return i("button",{className:"shoppingroute-editor-button",type:"button",disabled:t,title:o,"aria-label":o,onClick:e,style:{width:"38px",height:"32px",border:`1px solid ${n.border}`,borderRadius:"4px",background:n.buttonBackground,color:"inherit",cursor:t?"default":"pointer",opacity:t?.4:1}},r)}function L({ariaLabel:r,onChange:t,onKeyDown:e,placeholder:o,tokens:n,value:s}){return i("input",{className:"shoppingroute-editor-control",type:"text",value:s,placeholder:o,"aria-label":r,onChange:t,onKeyDown:e,style:{width:"100%",padding:"9px 12px",borderRadius:"4px",border:`1px solid ${n.border}`,background:n.background,color:"inherit"}})}function z({children:r,disabled:t=!1,onClick:e,tokens:o}){return i("button",{className:"shoppingroute-editor-button",type:"button",disabled:t,onClick:e,style:{minHeight:"38px",padding:"7px 16px",border:`1px solid ${o.border}`,borderRadius:"4px",background:o.buttonBackground,color:"inherit",cursor:t?"default":"pointer",fontWeight:600,opacity:t?.4:1}},r)}function j({children:r}){return i("div",{className:"shoppingroute-editor-add-controls"},r)}l.exports={ActionButton:z,AddControls:j,BorderedList:R,EditorFrame:A,EditorRow:T,IconButton:D,SectionHeading:E,TextInput:L,text:N,themeTokens:B};const x=(l.exports==null?{}:l.exports).default||l.exports,H=Object.freeze(Object.defineProperty({__proto__:null,default:x},Symbol.toStringTag,{value:"Module"}));var c={exports:{}};const k=f||b,{ActionButton:F,AddControls:J,BorderedList:K,EditorFrame:M,EditorRow:I,IconButton:g,SectionHeading:h,TextInput:m,text:a,themeTokens:O}=x||H,p=k.createElement;function u(r){return(Array.isArray(r)?r:[]).map(t=>t&&typeof t=="object"&&!Array.isArray(t)?{...t}:{name:String(t||"")})}function v(r,t){const e=String(t||"").trim(),o=u(r);return e&&o.push({name:e}),o}function _(r,t,e){const o=u(r);return t>=0&&t<o.length&&(o[t]={...o[t],name:String(e??"")}),o}function w(r,t){const e=u(r);return t>=0&&t<e.length&&e.splice(t,1),e}function P(r,t,e){const o=u(r),n=t+e;return t>=0&&t<o.length&&n>=0&&n<o.length&&([o[t],o[n]]=[o[n],o[t]]),o}function S(r,t,e){const o=u(r);if(t<0||e<0||t>=o.length||e>=o.length||t===e)return o;const[n]=o.splice(t,1);return o.splice(e,0,n),o}class W extends k.Component{constructor(t){super(t),this.state={newName:"",dragIndex:-1}}updateProductGroups(t,e=!0){this.props.onChange({...this.props.data||{},productGroups:t},e)}add(){const t=v(this.props.data&&this.props.data.productGroups,this.state.newName);t.length!==u(this.props.data&&this.props.data.productGroups).length&&(this.updateProductGroups(t,!0),this.setState({newName:""}))}edit(t,e){this.updateProductGroups(_(this.props.data&&this.props.data.productGroups,t,e),!1)}remove(t){this.updateProductGroups(w(this.props.data&&this.props.data.productGroups,t),!0)}move(t,e){this.updateProductGroups(P(this.props.data&&this.props.data.productGroups,t,e),!0)}drop(t){this.state.dragIndex<0||(this.updateProductGroups(S(this.props.data&&this.props.data.productGroups,this.state.dragIndex,t)),this.setState({dragIndex:-1}))}render(){const t=u(this.props.data&&this.props.data.productGroups),e=O(this.props.themeType),o=[...h({title:a("Produktgruppen","Product groups"),hint:a("Zentraler Katalog aller Produktgruppen. Änderungen werden erst mit dem Instanzdialog gespeichert.","Central catalogue of all product groups. Changes are saved only with the instance dialog."),tokens:e})];return t.length?o.push(p(K,{key:"groups",tokens:e},t.map((n,s)=>p(I,{key:s,position:s+1,last:s===t.length-1,tokens:e,draggable:!0,onDragStart:d=>{this.setState({dragIndex:s}),d.dataTransfer.effectAllowed="move"},onDragOver:d=>d.preventDefault(),onDrop:d=>{d.preventDefault(),this.drop(s)},actions:[p(g,{key:"up",disabled:s===0,onClick:()=>this.move(s,-1),title:a("Nach oben","Move up"),tokens:e},"↑"),p(g,{key:"down",disabled:s===t.length-1,onClick:()=>this.move(s,1),title:a("Nach unten","Move down"),tokens:e},"↓"),p(g,{key:"remove",onClick:()=>this.remove(s),title:a("Produktgruppe löschen","Delete product group"),tokens:e},"×")]},p(m,{ariaLabel:a("Produktgruppe bearbeiten","Edit product group"),onChange:d=>this.edit(s,d.target.value),tokens:e,value:String(n.name||"")}))))):o.push(p("div",{key:"empty",style:{color:e.muted,padding:"12px 0",marginBottom:"18px"}},a("Noch keine Produktgruppen vorhanden.","No product groups configured yet."))),o.push(...h({title:a("Produktgruppe hinzufügen","Add product group"),tokens:e,titleKey:"add-title",hintKey:"add-hint"})),o.push(p(J,{key:"add-controls"},[p(m,{key:"name",ariaLabel:a("Neue Produktgruppe","New product group"),onChange:n=>this.setState({newName:n.target.value}),onKeyDown:n=>{n.key==="Enter"&&this.add()},placeholder:a("Name der Produktgruppe","Product group name"),tokens:e,value:this.state.newName}),p(F,{key:"add",disabled:!this.state.newName.trim(),onClick:()=>this.add(),tokens:e},a("Hinzufügen","Add"))])),p(M,null,o)}}c.exports={Components:{ProductGroupsEditor:W},ProductGroupsEditorModel:{addProductGroup:v,editProductGroup:_,moveProductGroup:P,moveProductGroupTo:S,productGroupRows:u,removeProductGroup:w}};const Z=(c.exports==null?{}:c.exports).default||c.exports,U=Z.Components;export{U as default};
