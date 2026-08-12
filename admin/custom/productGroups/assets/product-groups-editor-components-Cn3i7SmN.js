import"./hostInit-BHEE7C9D.js";import{i as P,S as C}from"./ShoppingRouteProductGroupsSet__mf_v__runtimeInit__mf_v__-Be3p3_Gt.js";import{g as $}from"./_commonjsHelpers-CqkleIqs.js";import"./preload-helper-Dp1pzeXC.js";function G(e,t){for(var o=0;o<t.length;o++){const r=t[o];if(typeof r!="string"&&!Array.isArray(r)){for(const n in r)if(n!=="default"&&!(n in e)){const p=Object.getOwnPropertyDescriptor(r,n);p&&Object.defineProperty(e,n,p.get?p:{enumerable:!0,get:()=>r[n]})}}}return Object.freeze(Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}))}const{loadShare:R}=P,{initPromise:A}=C,B=A.then(e=>R("react",{customShareInfo:{shareConfig:{singleton:!0,strictVersion:!1,requiredVersion:">=18"}}})),E=await B.then(e=>e());var f=E;const g=$(f),b=G({__proto__:null,default:g},[f]);var u={exports:{}};const x=g||b,i=x.createElement,j=`
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
`;function I(e,t){return(typeof navigator<"u"?String(navigator.language||"").toLowerCase():"de").startsWith("de")?e:t}function T(e){const t=String(e||"").toLowerCase()==="dark";return{border:t?"#555":"#d5d5d5",background:t?"#2b2b2b":"#fff",muted:t?"#bbb":"#666",buttonBackground:t?"#3b3b3b":"#f4f4f4"}}function z({children:e}){return i(x.Fragment,null,[i("style",{key:"responsive-styles"},j),i("div",{key:"content",style:{width:"100%"}},e)])}function L({title:e,hint:t,tokens:o,titleKey:r="title",hintKey:n="hint"}){return[i("h3",{key:r,style:{margin:"0 0 6px"}},e),t?i("div",{key:n,style:{color:o.muted,marginBottom:"10px",fontSize:"0.92rem"}},t):null]}function F({children:e,tokens:t,marginBottom:o="18px"}){return i("div",{style:{border:`1px solid ${t.border}`,borderRadius:"6px",overflow:"hidden",marginBottom:o}},e)}function O({position:e,children:t,actions:o,last:r,tokens:n}){return i("div",{className:"shoppingroute-editor-row",style:{borderBottom:r?"none":`1px solid ${n.border}`,background:n.background}},[i("div",{key:"position",style:{color:n.muted,textAlign:"right",paddingRight:"6px"}},String(e)),i("div",{key:"content",style:{minWidth:0}},t),i("div",{key:"actions",className:"shoppingroute-editor-row-actions"},o)])}function M({children:e,disabled:t=!1,onClick:o,title:r,tokens:n}){return i("button",{className:"shoppingroute-editor-button",type:"button",disabled:t,title:r,"aria-label":r,onClick:o,style:{width:"38px",height:"32px",border:`1px solid ${n.border}`,borderRadius:"4px",background:n.buttonBackground,color:"inherit",cursor:t?"default":"pointer",opacity:t?.4:1}},e)}function H({ariaLabel:e,onChange:t,onKeyDown:o,placeholder:r,tokens:n,value:p}){return i("input",{className:"shoppingroute-editor-control",type:"text",value:p,placeholder:r,"aria-label":e,onChange:t,onKeyDown:o,style:{width:"100%",padding:"9px 12px",borderRadius:"4px",border:`1px solid ${n.border}`,background:n.background,color:"inherit"}})}function D({ariaLabel:e,onChange:t,placeholder:o,tokens:r,value:n}){return i("textarea",{className:"shoppingroute-editor-control shoppingroute-editor-textarea",value:n,placeholder:o,"aria-label":e,onChange:t,style:{width:"100%",padding:"9px 12px",borderRadius:"4px",border:`1px solid ${r.border}`,background:r.background,color:"inherit"}})}function J({ariaLabel:e,min:t,max:o,onChange:r,tokens:n,value:p}){return i("input",{className:"shoppingroute-editor-control",type:"number",value:p,min:t,max:o,"aria-label":e,onChange:r,style:{width:"100%",padding:"9px 12px",borderRadius:"4px",border:`1px solid ${n.border}`,background:n.background,color:"inherit"}})}function K({ariaLabel:e,onChange:t,options:o,tokens:r,value:n}){return i("select",{className:"shoppingroute-editor-control","aria-label":e,onChange:t,value:n,style:{width:"100%",padding:"9px 12px",borderRadius:"4px",border:`1px solid ${r.border}`,background:r.background,color:"inherit"}},o.map(p=>i("option",{key:`${p.value}`,value:p.value},p.label)))}function W({checked:e,label:t,onChange:o}){return i("label",{className:"shoppingroute-editor-inline-checkbox"},[i("input",{key:"input",className:"shoppingroute-editor-checkbox",type:"checkbox",checked:e,onChange:o}),i("span",{key:"label"},t)])}function V({children:e,label:t,tokens:o,span:r=12}){return i("div",{className:"shoppingroute-editor-form-field",style:{gridColumn:`span ${r}`}},[t?i("div",{key:"label",className:"shoppingroute-editor-field-label",style:{color:o.muted}},t):null,e])}function q({children:e}){return i("div",{className:"shoppingroute-editor-form-grid"},e)}function Z({children:e}){return i("div",{className:"shoppingroute-editor-pill-list"},e)}function Q({children:e,tokens:t}){return i("span",{className:"shoppingroute-editor-pill",style:{borderColor:t.border,background:t.buttonBackground}},e)}function U({children:e,disabled:t=!1,onClick:o,tokens:r}){return i("button",{className:"shoppingroute-editor-button",type:"button",disabled:t,onClick:o,style:{minHeight:"38px",padding:"7px 16px",border:`1px solid ${r.border}`,borderRadius:"4px",background:r.buttonBackground,color:"inherit",cursor:t?"default":"pointer",fontWeight:600,opacity:t?.4:1}},e)}function X({children:e}){return i("div",{className:"shoppingroute-editor-add-controls"},e)}u.exports={ActionButton:U,AddControls:X,BorderedList:F,CheckboxInput:W,EditorFrame:z,EditorRow:O,Field:V,FormGrid:q,IconButton:M,NumberInput:J,Pill:Q,PillList:Z,SectionHeading:L,SelectInput:K,TextInput:H,TextAreaInput:D,text:I,themeTokens:T};const y=(u.exports==null?{}:u.exports).default||u.exports,Y=Object.freeze(Object.defineProperty({__proto__:null,default:y},Symbol.toStringTag,{value:"Module"}));var l={exports:{}};const _=g||b,{ActionButton:tt,AddControls:et,BorderedList:ot,EditorFrame:rt,EditorRow:nt,IconButton:c,SectionHeading:h,TextInput:m,text:a,themeTokens:it}=y||Y,s=_.createElement;function d(e){return(Array.isArray(e)?e:[]).map(t=>t&&typeof t=="object"&&!Array.isArray(t)?{...t}:{name:String(t||"")})}function k(e,t){const o=String(t||"").trim(),r=d(e);return o&&r.push({name:o}),r}function v(e,t,o){const r=d(e);return t>=0&&t<r.length&&(r[t]={...r[t],name:String(o??"")}),r}function w(e,t){const o=d(e);return t>=0&&t<o.length&&o.splice(t,1),o}function S(e,t,o){const r=d(e),n=t+o;return t>=0&&t<r.length&&n>=0&&n<r.length&&([r[t],r[n]]=[r[n],r[t]]),r}class pt extends _.Component{constructor(t){super(t),this.state={newName:""}}updateProductGroups(t){this.props.onChange({...this.props.data||{},productGroups:t},!0)}add(){const t=k(this.props.data&&this.props.data.productGroups,this.state.newName);t.length!==d(this.props.data&&this.props.data.productGroups).length&&(this.updateProductGroups(t),this.setState({newName:""}))}edit(t,o){this.updateProductGroups(v(this.props.data&&this.props.data.productGroups,t,o))}remove(t){this.updateProductGroups(w(this.props.data&&this.props.data.productGroups,t))}move(t,o){this.updateProductGroups(S(this.props.data&&this.props.data.productGroups,t,o))}render(){const t=d(this.props.data&&this.props.data.productGroups),o=it(this.props.themeType),r=[...h({title:a("Produktgruppen","Product groups"),hint:a("Zentraler Katalog aller Produktgruppen. Änderungen werden erst mit dem Instanzdialog gespeichert.","Central catalogue of all product groups. Changes are saved only with the instance dialog."),tokens:o})];return t.length?r.push(s(ot,{key:"groups",tokens:o},t.map((n,p)=>s(nt,{key:p,position:p+1,last:p===t.length-1,tokens:o,actions:[s(c,{key:"up",disabled:p===0,onClick:()=>this.move(p,-1),title:a("Nach oben","Move up"),tokens:o},"↑"),s(c,{key:"down",disabled:p===t.length-1,onClick:()=>this.move(p,1),title:a("Nach unten","Move down"),tokens:o},"↓"),s(c,{key:"remove",onClick:()=>this.remove(p),title:a("Produktgruppe löschen","Delete product group"),tokens:o},"×")]},s(m,{ariaLabel:a("Produktgruppe bearbeiten","Edit product group"),onChange:N=>this.edit(p,N.target.value),tokens:o,value:String(n.name||"")}))))):r.push(s("div",{key:"empty",style:{color:o.muted,padding:"12px 0",marginBottom:"18px"}},a("Noch keine Produktgruppen vorhanden.","No product groups configured yet."))),r.push(...h({title:a("Produktgruppe hinzufügen","Add product group"),tokens:o,titleKey:"add-title",hintKey:"add-hint"})),r.push(s(et,{key:"add-controls"},[s(m,{key:"name",ariaLabel:a("Neue Produktgruppe","New product group"),onChange:n=>this.setState({newName:n.target.value}),onKeyDown:n=>{n.key==="Enter"&&this.add()},placeholder:a("Name der Produktgruppe","Product group name"),tokens:o,value:this.state.newName}),s(tt,{key:"add",disabled:!this.state.newName.trim(),onClick:()=>this.add(),tokens:o},a("Hinzufügen","Add"))])),s(rt,null,r)}}l.exports={Components:{ProductGroupsEditor:pt},ProductGroupsEditorModel:{addProductGroup:k,editProductGroup:v,moveProductGroup:S,productGroupRows:d,removeProductGroup:w}};const at=(l.exports==null?{}:l.exports).default||l.exports,ct=at.Components;export{ct as default};
