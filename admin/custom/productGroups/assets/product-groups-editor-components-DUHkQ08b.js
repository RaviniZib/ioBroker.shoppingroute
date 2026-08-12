import"./hostInit-BHEE7C9D.js";import{i as C,S as G}from"./ShoppingRouteProductGroupsSet__mf_v__runtimeInit__mf_v__-Be3p3_Gt.js";import{g as N}from"./_commonjsHelpers-CqkleIqs.js";import"./preload-helper-Dp1pzeXC.js";function $(r,t){for(var e=0;e<t.length;e++){const o=t[e];if(typeof o!="string"&&!Array.isArray(o)){for(const n in o)if(n!=="default"&&!(n in r)){const i=Object.getOwnPropertyDescriptor(o,n);i&&Object.defineProperty(r,n,i.get?i:{enumerable:!0,get:()=>o[n]})}}}return Object.freeze(Object.defineProperty(r,Symbol.toStringTag,{value:"Module"}))}const{loadShare:A}=C,{initPromise:B}=G,E=B.then(r=>A("react",{customShareInfo:{shareConfig:{singleton:!0,strictVersion:!1,requiredVersion:">=18"}}})),R=await E.then(r=>r());var f=R;const g=N(f),_=$({__proto__:null,default:g},[f]);var d={exports:{}};const y=g||_,s=y.createElement,j=`
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
`;function T(r,t){return(typeof navigator<"u"?String(navigator.language||"").toLowerCase():"de").startsWith("de")?r:t}function z(r){const t=String(r||"").toLowerCase()==="dark";return{border:t?"#555":"#d5d5d5",background:t?"#2b2b2b":"#fff",muted:t?"#bbb":"#666",buttonBackground:t?"#3b3b3b":"#f4f4f4"}}function L({children:r}){return s(y.Fragment,null,[s("style",{key:"responsive-styles"},j),s("div",{key:"content",style:{width:"100%"}},r)])}function O({title:r,hint:t,tokens:e,titleKey:o="title",hintKey:n="hint"}){return[s("h3",{key:o,style:{margin:"0 0 6px"}},r),t?s("div",{key:n,style:{color:e.muted,marginBottom:"10px",fontSize:"0.92rem"}},t):null]}function I({children:r,tokens:t,marginBottom:e="18px"}){return s("div",{style:{border:`1px solid ${t.border}`,borderRadius:"6px",overflow:"hidden",marginBottom:e}},r)}function M({position:r,children:t,actions:e,last:o,tokens:n}){return s("div",{className:"shoppingroute-editor-row",style:{borderBottom:o?"none":`1px solid ${n.border}`,background:n.background}},[s("div",{key:"position",style:{color:n.muted,textAlign:"right",paddingRight:"6px"}},String(r)),s("div",{key:"content",style:{minWidth:0}},t),s("div",{key:"actions",className:"shoppingroute-editor-row-actions"},e)])}function F({children:r,disabled:t=!1,onClick:e,title:o,tokens:n}){return s("button",{className:"shoppingroute-editor-button",type:"button",disabled:t,title:o,"aria-label":o,onClick:e,style:{width:"38px",height:"32px",border:`1px solid ${n.border}`,borderRadius:"4px",background:n.buttonBackground,color:"inherit",cursor:t?"default":"pointer",opacity:t?.4:1}},r)}function H({ariaLabel:r,onChange:t,onKeyDown:e,placeholder:o,tokens:n,value:i}){return s("input",{className:"shoppingroute-editor-control",type:"text",value:i,placeholder:o,"aria-label":r,onChange:t,onKeyDown:e,style:{width:"100%",padding:"9px 12px",borderRadius:"4px",border:`1px solid ${n.border}`,background:n.background,color:"inherit"}})}function D({children:r,disabled:t=!1,onClick:e,tokens:o}){return s("button",{className:"shoppingroute-editor-button",type:"button",disabled:t,onClick:e,style:{minHeight:"38px",padding:"7px 16px",border:`1px solid ${o.border}`,borderRadius:"4px",background:o.buttonBackground,color:"inherit",cursor:t?"default":"pointer",fontWeight:600,opacity:t?.4:1}},r)}function J({children:r}){return s("div",{className:"shoppingroute-editor-add-controls"},r)}d.exports={ActionButton:D,AddControls:J,BorderedList:I,EditorFrame:L,EditorRow:M,IconButton:F,SectionHeading:O,TextInput:H,text:T,themeTokens:z};const b=(d.exports==null?{}:d.exports).default||d.exports,K=Object.freeze(Object.defineProperty({__proto__:null,default:b},Symbol.toStringTag,{value:"Module"}));var c={exports:{}};const x=g||_,{ActionButton:W,AddControls:V,BorderedList:q,EditorFrame:Z,EditorRow:Q,IconButton:l,SectionHeading:h,TextInput:m,text:a,themeTokens:U}=b||K,p=x.createElement;function u(r){return(Array.isArray(r)?r:[]).map(t=>t&&typeof t=="object"&&!Array.isArray(t)?{...t}:{name:String(t||"")})}function k(r,t){const e=String(t||"").trim(),o=u(r);return e&&o.push({name:e}),o}function v(r,t,e){const o=u(r);return t>=0&&t<o.length&&(o[t]={...o[t],name:String(e??"")}),o}function w(r,t){const e=u(r);return t>=0&&t<e.length&&e.splice(t,1),e}function S(r,t,e){const o=u(r),n=t+e;return t>=0&&t<o.length&&n>=0&&n<o.length&&([o[t],o[n]]=[o[n],o[t]]),o}class X extends x.Component{constructor(t){super(t),this.state={newName:""}}updateProductGroups(t){this.props.onChange({...this.props.data||{},productGroups:t},!0)}add(){const t=k(this.props.data&&this.props.data.productGroups,this.state.newName);t.length!==u(this.props.data&&this.props.data.productGroups).length&&(this.updateProductGroups(t),this.setState({newName:""}))}edit(t,e){this.updateProductGroups(v(this.props.data&&this.props.data.productGroups,t,e))}remove(t){this.updateProductGroups(w(this.props.data&&this.props.data.productGroups,t))}move(t,e){this.updateProductGroups(S(this.props.data&&this.props.data.productGroups,t,e))}render(){const t=u(this.props.data&&this.props.data.productGroups),e=U(this.props.themeType),o=[...h({title:a("Produktgruppen","Product groups"),hint:a("Zentraler Katalog aller Produktgruppen. Änderungen werden erst mit dem Instanzdialog gespeichert.","Central catalogue of all product groups. Changes are saved only with the instance dialog."),tokens:e})];return t.length?o.push(p(q,{key:"groups",tokens:e},t.map((n,i)=>p(Q,{key:i,position:i+1,last:i===t.length-1,tokens:e,actions:[p(l,{key:"up",disabled:i===0,onClick:()=>this.move(i,-1),title:a("Nach oben","Move up"),tokens:e},"↑"),p(l,{key:"down",disabled:i===t.length-1,onClick:()=>this.move(i,1),title:a("Nach unten","Move down"),tokens:e},"↓"),p(l,{key:"remove",onClick:()=>this.remove(i),title:a("Produktgruppe löschen","Delete product group"),tokens:e},"×")]},p(m,{ariaLabel:a("Produktgruppe bearbeiten","Edit product group"),onChange:P=>this.edit(i,P.target.value),tokens:e,value:String(n.name||"")}))))):o.push(p("div",{key:"empty",style:{color:e.muted,padding:"12px 0",marginBottom:"18px"}},a("Noch keine Produktgruppen vorhanden.","No product groups configured yet."))),o.push(...h({title:a("Produktgruppe hinzufügen","Add product group"),tokens:e,titleKey:"add-title",hintKey:"add-hint"})),o.push(p(V,{key:"add-controls"},[p(m,{key:"name",ariaLabel:a("Neue Produktgruppe","New product group"),onChange:n=>this.setState({newName:n.target.value}),onKeyDown:n=>{n.key==="Enter"&&this.add()},placeholder:a("Name der Produktgruppe","Product group name"),tokens:e,value:this.state.newName}),p(W,{key:"add",disabled:!this.state.newName.trim(),onClick:()=>this.add(),tokens:e},a("Hinzufügen","Add"))])),p(Z,null,o)}}c.exports={Components:{ProductGroupsEditor:X},ProductGroupsEditorModel:{addProductGroup:k,editProductGroup:v,moveProductGroup:S,productGroupRows:u,removeProductGroup:w}};const Y=(c.exports==null?{}:c.exports).default||c.exports,nt=Y.Components;export{nt as default};
