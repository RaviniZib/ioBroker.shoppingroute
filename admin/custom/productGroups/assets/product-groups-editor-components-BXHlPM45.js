import"../productGroupsEditor.js";import{_ as m,a as f}from"./_virtual_mf___mfe_internal__ShoppingRouteProductGroupsSet__mf_owner__260837768108578__loadShare__react__loadShare__.js-BDIYtmgW.js";import"./vite-preload-helper-Dp1pzeXC.js";import"./index-2HOz3j7B.js";var u={exports:{}};const b=m||f,i=b.createElement,P=`
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
`;function S(r,t){return(typeof navigator<"u"?String(navigator.language||"").toLowerCase():"de").startsWith("de")?r:t}function $(r){const t=String(r||"").toLowerCase()==="dark";return{border:t?"#555":"#d5d5d5",background:t?"#2b2b2b":"#fff",muted:t?"#bbb":"#666",buttonBackground:t?"#3b3b3b":"#f4f4f4"}}function N({children:r}){return i(b.Fragment,null,[i("style",{key:"responsive-styles"},P),i("div",{key:"content",style:{width:"100%"}},r)])}function G({title:r,hint:t,tokens:o,titleKey:e="title",hintKey:n="hint"}){return[i("h3",{key:e,style:{margin:"0 0 6px"}},r),t?i("div",{key:n,style:{color:o.muted,marginBottom:"10px",fontSize:"0.92rem"}},t):null]}function B({children:r,tokens:t,marginBottom:o="18px"}){return i("div",{style:{border:`1px solid ${t.border}`,borderRadius:"6px",overflow:"hidden",marginBottom:o}},r)}function A({position:r,children:t,actions:o,last:e,tokens:n}){return i("div",{className:"shoppingroute-editor-row",style:{borderBottom:e?"none":`1px solid ${n.border}`,background:n.background}},[i("div",{key:"position",style:{color:n.muted,textAlign:"right",paddingRight:"6px"}},String(r)),i("div",{key:"content",style:{minWidth:0}},t),i("div",{key:"actions",className:"shoppingroute-editor-row-actions"},o)])}function E({children:r,disabled:t=!1,onClick:o,title:e,tokens:n}){return i("button",{className:"shoppingroute-editor-button",type:"button",disabled:t,title:e,"aria-label":e,onClick:o,style:{width:"38px",height:"32px",border:`1px solid ${n.border}`,borderRadius:"4px",background:n.buttonBackground,color:"inherit",cursor:t?"default":"pointer",opacity:t?.4:1}},r)}function R({ariaLabel:r,onChange:t,onKeyDown:o,placeholder:e,tokens:n,value:s}){return i("input",{className:"shoppingroute-editor-control",type:"text",value:s,placeholder:e,"aria-label":r,onChange:t,onKeyDown:o,style:{width:"100%",padding:"9px 12px",borderRadius:"4px",border:`1px solid ${n.border}`,background:n.background,color:"inherit"}})}function T({children:r,disabled:t=!1,onClick:o,tokens:e}){return i("button",{className:"shoppingroute-editor-button",type:"button",disabled:t,onClick:o,style:{minHeight:"38px",padding:"7px 16px",border:`1px solid ${e.border}`,borderRadius:"4px",background:e.buttonBackground,color:"inherit",cursor:t?"default":"pointer",fontWeight:600,opacity:t?.4:1}},r)}function L({children:r}){return i("div",{className:"shoppingroute-editor-add-controls"},r)}u.exports={ActionButton:T,AddControls:L,BorderedList:B,EditorFrame:N,EditorRow:A,IconButton:E,SectionHeading:G,TextInput:R,text:S,themeTokens:$};const y=(u.exports==null?{}:u.exports).default||u.exports,z=Object.freeze(Object.defineProperty({__proto__:null,default:y},Symbol.toStringTag,{value:"Module"}));var l={exports:{}};const x=m||f,{ActionButton:j,AddControls:H,BorderedList:F,EditorFrame:I,EditorRow:J,IconButton:c,SectionHeading:g,TextInput:h,text:p,themeTokens:K}=y||z,d=x.createElement;function a(r){return(Array.isArray(r)?r:[]).map(t=>t&&typeof t=="object"&&!Array.isArray(t)?{...t}:{name:String(t||"")})}function k(r,t){const o=String(t||"").trim(),e=a(r);return o&&e.push({name:o}),e}function _(r,t,o){const e=a(r);return t>=0&&t<e.length&&(e[t]={...e[t],name:String(o??"")}),e}function v(r,t){const o=a(r);return t>=0&&t<o.length&&o.splice(t,1),o}function w(r,t,o){const e=a(r),n=t+o;return t>=0&&t<e.length&&n>=0&&n<e.length&&([e[t],e[n]]=[e[n],e[t]]),e}class M extends x.Component{constructor(t){super(t),this.state={newName:""}}updateProductGroups(t){this.props.onChange({...this.props.data||{},productGroups:t},!0)}add(){const t=k(this.props.data&&this.props.data.productGroups,this.state.newName);t.length!==a(this.props.data&&this.props.data.productGroups).length&&(this.updateProductGroups(t),this.setState({newName:""}))}edit(t,o){this.updateProductGroups(_(this.props.data&&this.props.data.productGroups,t,o))}remove(t){this.updateProductGroups(v(this.props.data&&this.props.data.productGroups,t))}move(t,o){this.updateProductGroups(w(this.props.data&&this.props.data.productGroups,t,o))}render(){const t=a(this.props.data&&this.props.data.productGroups),o=K(this.props.themeType),e=[...g({title:p("Produktgruppen","Product groups"),hint:p("Zentraler Katalog aller Produktgruppen. Änderungen werden erst mit dem Instanzdialog gespeichert.","Central catalogue of all product groups. Changes are saved only with the instance dialog."),tokens:o})];return t.length?e.push(d(F,{key:"groups",tokens:o},t.map((n,s)=>d(J,{key:s,position:s+1,last:s===t.length-1,tokens:o,actions:[d(c,{key:"up",disabled:s===0,onClick:()=>this.move(s,-1),title:p("Nach oben","Move up"),tokens:o},"↑"),d(c,{key:"down",disabled:s===t.length-1,onClick:()=>this.move(s,1),title:p("Nach unten","Move down"),tokens:o},"↓"),d(c,{key:"remove",onClick:()=>this.remove(s),title:p("Produktgruppe löschen","Delete product group"),tokens:o},"×")]},d(h,{ariaLabel:p("Produktgruppe bearbeiten","Edit product group"),onChange:C=>this.edit(s,C.target.value),tokens:o,value:String(n.name||"")}))))):e.push(d("div",{key:"empty",style:{color:o.muted,padding:"12px 0",marginBottom:"18px"}},p("Noch keine Produktgruppen vorhanden.","No product groups configured yet."))),e.push(...g({title:p("Produktgruppe hinzufügen","Add product group"),tokens:o,titleKey:"add-title",hintKey:"add-hint"})),e.push(d(H,{key:"add-controls"},[d(h,{key:"name",ariaLabel:p("Neue Produktgruppe","New product group"),onChange:n=>this.setState({newName:n.target.value}),onKeyDown:n=>{n.key==="Enter"&&this.add()},placeholder:p("Name der Produktgruppe","Product group name"),tokens:o,value:this.state.newName}),d(j,{key:"add",disabled:!this.state.newName.trim(),onClick:()=>this.add(),tokens:o},p("Hinzufügen","Add"))])),d(I,null,e)}}l.exports={Components:{ProductGroupsEditor:M},ProductGroupsEditorModel:{addProductGroup:k,editProductGroup:_,moveProductGroup:w,productGroupRows:a,removeProductGroup:v}};const W=(l.exports==null?{}:l.exports).default||l.exports,Q=W.Components;export{Q as default};
