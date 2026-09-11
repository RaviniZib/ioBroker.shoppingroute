import"../shoppingListEditor.js";import{_ as m,a as b}from"./_virtual_mf___mfe_internal__ShoppingRouteShoppingListSet__mf_owner__1__loadShare__react__loadShare__.js-DKxc1wk0.js";import"./vite-preload-helper-Dp1pzeXC.js";import"./index-2HOz3j7B.js";var p={exports:{}};const g=m||b,o=g.createElement,i=(u,t)=>(typeof navigator<"u"?String(navigator.language||"").toLowerCase():"de").startsWith("de")?u:t,y=`
    .shoppingroute-list-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin-bottom: 14px;
    }
    .shoppingroute-list-toolbar select,
    .shoppingroute-list-toolbar button,
    .shoppingroute-card select {
        min-height: 38px;
        box-sizing: border-box;
    }
    .shoppingroute-market-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
        align-items: start;
    }
    .shoppingroute-market-column {
        min-width: 0;
        border: 1px solid currentColor;
        border-radius: 8px;
        padding: 10px;
        opacity: 0.94;
    }
    .shoppingroute-card {
        border: 1px solid currentColor;
        border-radius: 6px;
        padding: 9px;
        margin: 8px 0;
        background: rgba(127, 127, 127, 0.08);
        cursor: grab;
    }
    .shoppingroute-card-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
        align-items: center;
    }
    .shoppingroute-card-controls select {
        min-width: 0;
        flex: 1 1 130px;
    }
    .shoppingroute-list-button {
        min-width: 38px;
        min-height: 34px;
        border: 1px solid currentColor;
        border-radius: 4px;
        background: transparent;
        color: inherit;
        cursor: pointer;
    }
    .shoppingroute-list-button:disabled {
        cursor: default;
        opacity: 0.4;
    }
    @media (max-width: 600px) {
        .shoppingroute-market-grid {
            grid-template-columns: 1fr;
        }
        .shoppingroute-list-toolbar > * {
            width: 100%;
            max-width: none;
        }
        .shoppingroute-card {
            cursor: default;
        }
    }
`;class c extends g.Component{constructor(t){super(t),this.state={view:null,loading:!0,busy:"",error:""}}componentDidMount(){this.load()}instanceName(){const t=String(this.props.adapterName||"shoppingroute"),e=Number.isFinite(Number(this.props.instance))?Number(this.props.instance):0;return`${t}.${e}`}async send(t,e){var s;if(!((s=this.props.socket)!=null&&s.sendTo))throw new Error("Admin socket is unavailable.");return this.props.socket.sendTo(this.instanceName(),t,e||{})}async load(t){this.setState({loading:!0,error:""});try{const e=await this.send("getShoppingList",{listName:t});if(!e||e.error)throw new Error((e==null?void 0:e.error)||"Shopping list could not be loaded.");this.setState({view:e,loading:!1,busy:""})}catch(e){this.setState({loading:!1,busy:"",error:e instanceof Error?e.message:String(e)})}}async move(t,e,s){const n=this.state.view;if(!(!n||this.state.busy)){this.setState({busy:t,error:""});try{const r=await this.send("moveShoppingItem",{listName:n.listName,itemId:t,targetMarket:e,targetPosition:s});if(r!=null&&r.view&&this.setState({view:r.view}),!(r!=null&&r.ok))throw new Error((r==null?void 0:r.error)||"The item could not be moved.");this.setState({busy:""})}catch(r){this.setState({busy:"",error:r instanceof Error?r.message:String(r)}),await this.load(n.listName)}}}async clearManual(){const t=this.state.view;if(!(!t||this.state.busy)){this.setState({busy:"__clear__",error:""});try{const e=await this.send("clearManualShoppingOrder",{listName:t.listName});if(e!=null&&e.view&&this.setState({view:e.view}),!(e!=null&&e.ok))throw new Error((e==null?void 0:e.error)||"Manual order could not be cleared.");this.setState({busy:""})}catch(e){this.setState({busy:"",error:e instanceof Error?e.message:String(e)}),await this.load(t.listName)}}}onDragStart(t,e){t.dataTransfer.effectAllowed="move",t.dataTransfer.setData("text/plain",e)}onDrop(t,e,s){t.preventDefault();const n=t.dataTransfer.getData("text/plain");n&&this.move(n,e,s)}renderCard(t,e,s,n){const r=!!this.state.busy;return o("div",{key:t.id,className:"shoppingroute-card",draggable:!r,onDragStart:a=>this.onDragStart(a,t.id),onDragOver:a=>a.preventDefault(),onDrop:a=>this.onDrop(a,t.market,s),title:i("Ziehen oder die Schaltflächen benutzen","Drag or use the buttons")},[o("div",{key:"text",style:{fontWeight:600,wordBreak:"break-word"}},t.text),o("div",{key:"meta",style:{fontSize:"0.82rem",opacity:.72,marginTop:"3px"}},(t.category||i("Ohne Produktgruppe","No product group"))+(t.manual?` · ${i("manuell","manual")}`:"")),o("div",{key:"controls",className:"shoppingroute-card-controls"},[o("button",{key:"up",type:"button",className:"shoppingroute-list-button",disabled:r||s===0,title:i("Nach oben","Move up"),onClick:()=>void this.move(t.id,t.market,s-1)},"↑"),o("button",{key:"down",type:"button",className:"shoppingroute-list-button",disabled:r||s===e.length-1,title:i("Nach unten","Move down"),onClick:()=>void this.move(t.id,t.market,s+1)},"↓"),o("select",{key:"market",value:t.market,disabled:r,"aria-label":i("In einen anderen Markt verschieben","Move to another market"),onChange:a=>{const l=a.target.value,d=n.items.filter(h=>h.market===l&&h.id!==t.id).length;this.move(t.id,l,d)}},n.markets.map(a=>o("option",{key:a,value:a},a)))])])}render(){const t=this.state.view,e=!!this.state.busy,s=[o("style",{key:"styles"},y)];if(s.push(o("div",{key:"intro",style:{marginBottom:"12px",lineHeight:1.45}},[o("strong",{key:"title"},i("Aktuelle Einkaufsliste","Current shopping list")),o("div",{key:"hint",style:{opacity:.75,marginTop:"3px"}},i("Artikel können gezogen oder mit Pfeilen und Marktauswahl verschoben werden. Änderungen werden direkt in Alexa bestätigt.","Items can be dragged or moved with the arrows and market selector. Changes are confirmed directly in Alexa."))])),this.state.error&&s.push(o("div",{key:"error",style:{padding:"9px",border:"1px solid currentColor",borderRadius:"6px",marginBottom:"10px"}},this.state.error)),this.state.loading||!t)return s.push(o("div",{key:"loading"},i("Liste wird geladen …","Loading list …"))),o("div",{style:{width:"100%"}},s);s.push(o("div",{key:"toolbar",className:"shoppingroute-list-toolbar"},[o("select",{key:"list",value:t.listName,disabled:e,onChange:r=>void this.load(r.target.value),"aria-label":i("Einkaufsliste auswählen","Select shopping list")},t.lists.map(r=>o("option",{key:r,value:r},r))),o("button",{key:"refresh",type:"button",className:"shoppingroute-list-button",disabled:e,onClick:()=>void this.load(t.listName)},i("Aktualisieren","Refresh")),o("button",{key:"clear",type:"button",className:"shoppingroute-list-button",disabled:e,onClick:()=>void this.clearManual()},i("Manuelle Reihenfolge zurücksetzen","Reset manual order")),t.dryRun?o("strong",{key:"dry",style:{marginLeft:"auto"}},i("Dry Run aktiv – Verschieben gesperrt","Dry Run active – moving is disabled")):null]));const n=t.markets.map(r=>{const a=t.items.filter(l=>l.market===r);return o("section",{key:r,className:"shoppingroute-market-column",onDragOver:l=>l.preventDefault(),onDrop:l=>this.onDrop(l,r,a.length)},[o("h3",{key:"title",style:{margin:"0 0 6px"}},`${r} (${a.length})`),a.length?a.map((l,d)=>this.renderCard(l,a,d,t)):o("div",{key:"empty",style:{opacity:.62,padding:"12px 0"}},i("Hierher ziehen","Drop here"))])});return s.push(o("div",{key:"grid",className:"shoppingroute-market-grid"},n)),o("div",{style:{width:"100%"}},s)}}p.exports={Components:{ShoppingListEditor:c},ShoppingListEditor:c};const v=(p.exports==null?{}:p.exports).default||p.exports,S=v.Components;export{S as default};
