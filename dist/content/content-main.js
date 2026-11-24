var B=Object.defineProperty;var _=(e,t,n)=>t in e?B(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var u=(e,t,n)=>_(e,typeof t!="symbol"?t+"":t,n);const W=[/password/i,/passcode/i,/pin\b/i,/credit.?card/i,/card.?number/i,/cvv|cvc|csc/i,/expir/i,/otp/i,/one.?time/i,/verification.?code/i,/aadhaar|aadhar/i,/pan.?number/i,/ssn|social.?security/i,/passport.?number/i,/date.?of.?birth|dob\b/i],q=[/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,/(\+?\d[\s\-]?){9,13}/g,/\b\d{4}\s?\d{4}\s?\d{4}\b/g,/\b[A-Z]{5}\d{4}[A-Z]\b/g,/\b\d{3}-\d{2}-\d{4}\b/g],X="[REDACTED]";function G(e,t){const n=`${e} ${t??""}`;return W.some(i=>i.test(n))}function P(e){let t=e;for(const n of q)t=t.replace(n,X);return t.length>120?t.slice(0,120)+"…":t}const F=100;function A(){const e=[],t=new Set,n=window.innerHeight||800,i=window.innerWidth||1280;document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="link"], [role="textbox"], [role="combobox"], [role="searchbox"], [role="menuitem"], [role="tab"], [tabindex]').forEach(a=>{var M;if(a.closest("#pointwise-host")||!V(a))return;const s=a.getBoundingClientRect();if(s.width<2||s.height<2)return;const l=Y(a),p=a.name??"",g=(M=a.type)==null?void 0:M.toLowerCase();if(G(l,p)||g==="password"||g==="hidden")return;const h=a.tagName.toLowerCase();if(!l&&h!=="input"&&h!=="select"&&h!=="textarea")return;const b=j(a);if(!b||t.has(b))return;t.add(b);const x=s.bottom>=0&&s.right>=0&&s.top<=n&&s.left<=i,E=h==="input"||h==="button"||h==="select"||h==="textarea"||a.getAttribute("role")==="button",L=(x?10:0)+(E?5:0),C={selector:b,role:a.getAttribute("role")??h,label:P(l),tagName:h,rect:{x:Math.round(s.x),y:Math.round(s.y),width:Math.round(s.width),height:Math.round(s.height)},visible:!0,inViewport:x,disabled:a.disabled??!1,_priority:L};h==="input"&&g&&(C.inputType=g),g==="file"&&(C.hasFileInput=!0),e.push(C)}),e.sort((a,s)=>s._priority-a._priority);const o=e.slice(0,F).map(({_priority:a,...s})=>s);return{url:location.href,title:P(document.title),elements:o}}function V(e){if(e.getAttribute("aria-hidden")==="true")return!1;const t=window.getComputedStyle(e);return t.display!=="none"&&t.visibility!=="hidden"&&parseFloat(t.opacity||"1")>.05}function Y(e){var i,o,a,s;const t=e.id,n=t?(i=document.querySelector(`label[for="${CSS.escape(t)}"]`))==null?void 0:i.textContent:void 0;return e.getAttribute("aria-label")??e.getAttribute("placeholder")??(n==null?void 0:n.trim())??e.getAttribute("title")??((a=(o=e.value)==null?void 0:o.trim)==null?void 0:a.call(o))??((s=e.textContent)==null?void 0:s.replace(/\s+/g," ").trim().slice(0,80))??""}function H(e){try{return document.querySelectorAll(e).length===1}catch{return!1}}function U(e,t){const n=t.replace(/\\/g,"\\\\").replace(/"/g,'\\"');return`[${e}="${n}"]`}function j(e){if(e.id){const t=`#${CSS.escape(e.id)}`;if(H(t))return t}for(const t of["data-testid","aria-label","name","placeholder"]){const n=e.getAttribute(t);if(n&&n.length<80){const i=`${e.tagName.toLowerCase()}${U(t,n)}`;if(H(i))return i}}return Z(e)}function Z(e){const t=[];let n=e;for(;n&&n.tagName.toLowerCase()!=="html";){if(n.id){const p=`#${CSS.escape(n.id)}`;if(H(p)){t.unshift(p);break}}const i=n.parentElement,o=n.tagName.toLowerCase();if(!i){t.unshift(o);break}const a=n.tagName,s=Array.from(i.children).filter(p=>p.tagName===a),l=s.indexOf(n)+1;t.unshift(s.length>1?`${o}:nth-of-type(${l})`:o),n=i}return t.join(" > ")}const K=[{class:"captcha",patterns:[/captcha/i,/challenge/i,/prove.*human/i],iframeSrcPatterns:[/recaptcha/i,/hcaptcha\.com/i,/turnstile\.cloudflare\.com/i,/altcha\.org/i]},{class:"otp",patterns:[/one.?time/i,/\botp\b/i,/verification.?code/i,/auth.*code/i]},{class:"payment",patterns:[/credit.?card/i,/card.?number/i,/cvv|cvc/i,/upi\b/i,/pay now/i],iframeSrcPatterns:[/stripe\.com/i,/razorpay\.com/i,/braintreegateway\.com/i,/paypal\.com/i,/payu\./i]},{class:"legal",patterns:[/i agree/i,/terms.*condition/i,/declaration/i,/i hereby/i,/consent/i]}];function Q(e,t,n=[]){var o;const i=`${e} ${t}`.toLowerCase();for(const a of K){const s=a.patterns.some(p=>p.test(i)),l=((o=a.iframeSrcPatterns)==null?void 0:o.some(p=>n.some(g=>p.test(g))))??!1;if(s||l)return a.class}return"normal"}class J{constructor(){u(this,"shadow");u(this,"cursor");u(this,"cursorDialogue");u(this,"card");u(this,"miniDock");u(this,"highlight");u(this,"tag");u(this,"state","idle");u(this,"currentTarget",null);u(this,"hasPlacedCursor",!1);u(this,"resizeObserver");u(this,"scrollRafId",null);u(this,"userMouseX");u(this,"userMouseY");u(this,"confirmHandlers",[]);u(this,"cancelHandlers",[]);u(this,"nextHandlers",[]);u(this,"rescanHandlers",[]);u(this,"dismissHandlers",[]);u(this,"contextHandlers",[]);u(this,"boundSyncPosition");u(this,"boundMouseTrack");var n;(n=document.getElementById("pointwise-host"))==null||n.remove(),this.userMouseX=Math.round((window.innerWidth||1e3)*.5),this.userMouseY=Math.round((window.innerHeight||700)*.35);const t=document.createElement("div");t.setAttribute("id","pointwise-host"),t.style.cssText="all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;",document.body.appendChild(t),this.shadow=t.attachShadow({mode:"closed"}),this.shadow.innerHTML=tt,this.cursor=this.shadow.querySelector("#pw-cursor"),this.cursorDialogue=this.shadow.querySelector("#pw-cursor-dialogue"),this.card=this.shadow.querySelector("#pw-card"),this.miniDock=this.shadow.querySelector("#pw-mini-dock"),this.highlight=this.shadow.querySelector("#pw-highlight"),this.tag=this.shadow.querySelector("#pw-tag"),this.boundSyncPosition=()=>this.syncPosition(),this.boundMouseTrack=i=>this.handleMouseTrack(i),window.addEventListener("scroll",this.boundSyncPosition,{capture:!0,passive:!0}),window.addEventListener("resize",this.boundSyncPosition,{passive:!0}),document.addEventListener("mousemove",this.boundMouseTrack,{capture:!0,passive:!0}),document.addEventListener("mousedown",this.boundMouseTrack,{capture:!0,passive:!0}),this.resizeObserver=new ResizeObserver(()=>this.syncPosition()),this.card.addEventListener("click",i=>{const o=i.target.closest("[data-pw-action]");if(!o)return;i.stopPropagation();const a=o.dataset.pwAction;if(a==="confirm")this.userMouseX=i.clientX,this.userMouseY=i.clientY,this.card.style.display="none",this.confirmHandlers.forEach(s=>s());else if(a==="cancel")this.withdraw(),this.cancelHandlers.forEach(s=>s());else if(a==="rescan")this.rescanHandlers.forEach(s=>s());else if(a==="dismiss")this.withdraw(),this.dismissHandlers.forEach(s=>s());else if(a==="next")this.card.style.display="none",this.nextHandlers.forEach(s=>s());else if(a==="submit-context"){const s=this.card.querySelector("#pw-inline-context"),l=(s==null?void 0:s.value.trim())??"";this.contextHandlers.forEach(p=>p(l))}}),this.card.addEventListener("keydown",i=>{if(i.key==="Enter"){const o=i.target.closest("#pw-inline-context");o&&(i.preventDefault(),this.contextHandlers.forEach(a=>a(o.value.trim())))}}),this.miniDock.addEventListener("click",i=>{const o=i.target.closest("[data-pw-action]");if(!o)return;i.stopPropagation();const a=o.dataset.pwAction;a==="next"&&this.nextHandlers.forEach(s=>s()),a==="rescan"&&this.rescanHandlers.forEach(s=>s()),a==="dismiss"&&(this.withdraw(),this.dismissHandlers.forEach(s=>s()))})}onConfirm(t){this.confirmHandlers.push(t)}onCancel(t){this.cancelHandlers.push(t)}onNext(t){this.nextHandlers.push(t)}onRescan(t){this.rescanHandlers.push(t)}onDismiss(t){this.dismissHandlers.push(t)}onContextSubmit(t){this.contextHandlers.push(t)}showScanning(){this.clearTargetVisuals(),this.card.style.display="none",this.miniDock.style.display="none",this.state="scanning",this.cursorDialogue.innerHTML=`
      <div class="pw-cd-head">
        <span class="pw-brand">⬡ POINTWISE</span>
        <span class="pw-pill">ANALYSING</span>
      </div>
      <div class="pw-scanning">
        <span class="pw-scan-dot"></span>
        Preparing AI plan…
      </div>
    `,this.cursorDialogue.style.display="block",this.positionCursorDialogue(this.userMouseX,this.userMouseY)}showContextWaiting(t,n){this.clearTargetVisuals(),this.cursorDialogue.style.display="none",this.miniDock.style.display="none",this.state="context",n?this.card.innerHTML=`
        <div class="pw-head">
          <span class="pw-brand">⬡ POINTWISE</span>
          <span class="pw-pill">CONTEXT NEEDED</span>
        </div>
        <div class="pw-hint">Please answer the follow-up question in the PointWise popup:</div>
        <div class="pw-subnote">${k(t)}</div>
      `:this.card.innerHTML=`
        <div class="pw-head">
          <span class="pw-brand">⬡ POINTWISE</span>
          <span class="pw-pill">MORE DETAILS</span>
        </div>
        <div class="pw-hint">${k(t)}</div>
        <input id="pw-inline-context" class="pw-input" type="text" placeholder="Type details and press Enter…" />
        <div class="pw-actions">
          <button class="pw-btn pw-btn-primary" data-pw-action="submit-context">Continue ▶</button>
          <button class="pw-btn" data-pw-action="cancel">Cancel</button>
        </div>
      `,this.card.style.display="block",this.positionCardAtCursor(),n||setTimeout(()=>{var i;(i=this.card.querySelector("#pw-inline-context"))==null||i.focus()},30)}showPlanConfirmation(t){this.clearTargetVisuals(),this.cursorDialogue.style.display="none",this.miniDock.style.display="none",this.state="confirm";const n=t.steps.map((i,o)=>`
        <li class="pw-plan-item">
          <span class="pw-plan-num">${o+1}</span>
          <span class="pw-plan-text">${k(i.hint)}</span>
        </li>`).join("");this.card.innerHTML=`
      <div class="pw-head">
        <span class="pw-brand">⬡ POINTWISE</span>
        <span class="pw-pill">PLAN OF ACTION</span>
      </div>
      <div class="pw-plan-goal">${k(t.taskGoal||"Task Guidance")}</div>
      <ol class="pw-plan-list">${n}</ol>
      <div class="pw-confirm-ask">Confirm to highlight Step 1 and begin?</div>
      <div class="pw-actions">
        <button class="pw-btn pw-btn-primary" data-pw-action="confirm">Confirm &amp; Continue ▶</button>
        <button class="pw-btn" data-pw-action="cancel">Cancel</button>
      </div>
    `,this.card.style.display="block",this.positionCardAtCursor()}async pointAtElement(t,n){this.currentTarget&&this.resizeObserver.unobserve(this.currentTarget),this.currentTarget=t,this.resizeObserver.observe(t),this.card.style.display="none";const i=t.getBoundingClientRect(),o=i.top<40||i.bottom>window.innerHeight-40||i.left<0||i.right>window.innerWidth;o&&t.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"}),this.state="active",this.renderCursorDialogue(n),this.renderMiniDock(n),this.renderTargetVisuals(t,n),o&&this.startSmoothScrollTracking()}async pointAt(t,n){let i=null;try{i=document.querySelector(t)}catch{i=null}if(!i){this.showNotice(n.error??"Could not locate the expected element.",!0);return}await this.pointAtElement(i,n)}showNotice(t,n=!1){this.clearTargetVisuals(),this.cursorDialogue.style.display="none",this.miniDock.style.display="none",this.state="idle",this.card.innerHTML=`
      <div class="pw-head">
        <span class="pw-brand">⬡ POINTWISE</span>
        <span class="pw-pill ${n?"pw-pill-err":""}">${n?"NOTICE":"DONE"}</span>
      </div>
      <div class="${n?"pw-error":"pw-hint"}">${k(t)}</div>
      <div class="pw-actions">
        <button class="pw-btn pw-btn-primary" data-pw-action="rescan">Re-scan ↻</button>
        <button class="pw-btn" data-pw-action="dismiss">Hide</button>
      </div>
    `,this.card.style.display="block",this.positionCardAtCursor()}showPauseBanner(t){this.clearTargetVisuals(),this.cursorDialogue.style.display="none",this.miniDock.style.display="none",this.state="paused",this.card.innerHTML=et(t),this.card.style.display="block",this.positionCardAtCursor()}withdraw(){this.clearTargetVisuals(),this.cursorDialogue.style.display="none",this.card.style.display="none",this.miniDock.style.display="none",this.state="withdrawn"}destroy(){this.scrollRafId!==null&&cancelAnimationFrame(this.scrollRafId),this.resizeObserver.disconnect(),window.removeEventListener("scroll",this.boundSyncPosition,{capture:!0}),window.removeEventListener("resize",this.boundSyncPosition),document.removeEventListener("mousemove",this.boundMouseTrack,{capture:!0}),document.removeEventListener("mousedown",this.boundMouseTrack,{capture:!0}),this.shadow.host.remove()}clearTargetVisuals(){this.currentTarget&&(this.resizeObserver.unobserve(this.currentTarget),this.currentTarget=null),this.cursor.style.display="none",this.highlight.style.display="none",this.tag.style.display="none"}renderTargetVisuals(t,n){const i=t.getBoundingClientRect();if(i.width<=0||i.height<=0)return;const o=5,a=Math.max(2,i.left-o),s=Math.max(2,i.top-o),l=i.width+o*2,p=i.height+o*2;if(this.highlight.style.left=`${a}px`,this.highlight.style.top=`${s}px`,this.highlight.style.width=`${l}px`,this.highlight.style.height=`${p}px`,this.highlight.style.display="block",n){const x=(n.stepIndex??0)+1,E=D(n.action);this.tag.textContent=`STEP ${x} • ${E}`}const g=s>28?s-24:s+p+6;this.tag.style.left=`${Math.min(a,Math.max(8,window.innerWidth-160))}px`,this.tag.style.top=`${g}px`,this.tag.style.display="block";const h=i.left+Math.min(i.width*.72,Math.max(i.width-14,i.width*.5)),b=i.top+Math.min(i.height*.68,Math.max(i.height-8,i.height*.5));this.moveGhostCursorTo(h,b)}moveGhostCursorTo(t,n){const i=Math.round(t-5),o=Math.round(n-3);if(!this.hasPlacedCursor){const a=Math.max(24,this.userMouseX),s=Math.max(24,this.userMouseY);this.cursor.style.display="block",this.cursor.style.transform=`translate(${a}px, ${s}px)`,this.cursor.style.opacity="0",this.cursor.getBoundingClientRect(),this.hasPlacedCursor=!0}this.cursor.style.display="block",this.cursor.style.opacity="1",this.cursor.style.transform=`translate(${i}px, ${o}px)`}renderCursorDialogue(t){const n=(t.stepIndex??0)+1,i=t.totalSteps??1,o=D(t.action);this.cursorDialogue.innerHTML=`
      <div class="pw-cd-head">
        <span class="pw-brand">⬡ POINTWISE</span>
        <span class="pw-pill">STEP ${n}/${i} · ${o}</span>
      </div>
      <div class="pw-cd-hint">${k(t.hint)}</div>
      <div class="pw-cd-sub">Act on the highlighted element to continue</div>
    `,this.cursorDialogue.style.display="block",this.positionCursorDialogue(this.userMouseX,this.userMouseY)}renderMiniDock(t){const n=(t.stepIndex??0)+1,i=t.totalSteps??1,o=n>=i;this.miniDock.innerHTML=`
      <span class="pw-dock-label">Step ${n}/${i}</span>
      <button class="pw-btn pw-btn-primary pw-btn-sm" data-pw-action="next">${o?"Done ↻":"Next →"}</button>
      <button class="pw-btn pw-btn-sm" data-pw-action="rescan">Re-scan</button>
      <button class="pw-btn pw-btn-sm" data-pw-action="dismiss">Hide</button>
    `,this.miniDock.style.display="flex"}positionCursorDialogue(t,n){const i=this.cursorDialogue.offsetWidth||268,o=this.cursorDialogue.offsetHeight||86,a=window.innerWidth||1280,s=window.innerHeight||800;let l=t+18,p=n+20;l+i+12>a&&(l=Math.max(8,t-i-14)),p+o+12>s&&(p=Math.max(8,n-o-14)),this.cursorDialogue.style.transform=`translate3d(${Math.round(l)}px, ${Math.round(p)}px, 0)`}positionCardAtCursor(){const t=this.card.offsetWidth||336,n=this.card.offsetHeight||220,i=window.innerWidth||1280,o=window.innerHeight||800;let a=this.userMouseX+16,s=this.userMouseY+16;a+t+16>i&&(a=Math.max(12,i-t-18)),s+n+16>o&&(s=Math.max(12,o-n-18)),this.card.style.left=`${Math.round(a)}px`,this.card.style.top=`${Math.round(s)}px`}handleMouseTrack(t){this.userMouseX=t.clientX,this.userMouseY=t.clientY,(this.state==="scanning"||this.state==="active")&&this.positionCursorDialogue(t.clientX,t.clientY)}syncPosition(){this.state!=="active"||!this.currentTarget||document.contains(this.currentTarget)&&this.renderTargetVisuals(this.currentTarget)}startSmoothScrollTracking(){this.scrollRafId!==null&&cancelAnimationFrame(this.scrollRafId);const t=performance.now(),n=()=>{this.syncPosition(),performance.now()-t<650&&this.state==="active"?this.scrollRafId=requestAnimationFrame(n):this.scrollRafId=null};this.scrollRafId=requestAnimationFrame(n)}}function D(e){return e==="focus"?"ENTER":e==="file-upload"?"UPLOAD":e==="scroll"?"SCROLL":"CLICK"}const tt=`
<style>
  :host { all: initial; }

  /* ── Ghost Cursor ─────────────────────────────────────────── */
  #pw-cursor {
    position: fixed;
    top: 0; left: 0;
    width: 28px; height: 28px;
    pointer-events: none;
    transition: transform 460ms cubic-bezier(.22,1,.36,1), opacity 180ms ease;
    z-index: 2147483647;
    filter: drop-shadow(0 2px 6px rgba(15, 22, 42, 0.55));
    display: none;
    opacity: 0;
    will-change: transform, opacity;
  }

  /* ── Element Highlight Ring ───────────────────────────────── */
  #pw-highlight {
    position: fixed;
    pointer-events: none;
    z-index: 2147483644;
    border-radius: 8px;
    display: none;
    border: 2px solid #c45792;
    background: rgba(196, 87, 146, 0.08);
    box-shadow:
      0 0 0 3px rgba(27, 36, 59, 0.35),
      0 0 10px 1px rgba(196, 87, 146, 0.38);
    animation: pw-ring-pulse 2s ease-in-out infinite;
  }
  @keyframes pw-ring-pulse {
    0%, 100% {
      box-shadow:
        0 0 0 2px rgba(27, 36, 59, 0.35),
        0 0 8px 1px rgba(196, 87, 146, 0.35);
    }
    50% {
      box-shadow:
        0 0 0 4px rgba(196, 87, 146, 0.16),
        0 0 14px 2px rgba(196, 87, 146, 0.52);
    }
  }

  /* ── Floating Step Tag over Target Element ────────────────── */
  #pw-tag {
    position: fixed;
    pointer-events: none;
    z-index: 2147483645;
    display: none;
    background: #a9477c;
    color: #f3f6fc;
    font: 600 10px/1.2 system-ui, -apple-system, sans-serif;
    letter-spacing: 0.07em;
    padding: 4px 8px;
    border-radius: 5px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 2px 8px rgba(15, 22, 42, 0.4);
    white-space: nowrap;
  }

  /* ── Cursor-Attached Action Dialogue Box ──────────────────── */
  #pw-cursor-dialogue {
    position: fixed;
    top: 0; left: 0;
    width: 266px;
    max-width: calc(100vw - 24px);
    background: rgba(24, 32, 54, 0.96);
    border: 1px solid #495a84;
    border-left: 3px solid #c45792;
    border-radius: 10px;
    padding: 10px 12px;
    font: 12.5px/1.45 system-ui, -apple-system, sans-serif;
    color: #dce3f2;
    box-shadow: 0 8px 22px rgba(10, 14, 28, 0.45);
    display: none;
    z-index: 2147483647;
    pointer-events: none;
    will-change: transform;
  }
  .pw-cd-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 6px;
    padding-bottom: 5px;
    border-bottom: 1px solid #2e3b5c;
  }
  .pw-cd-hint {
    font-size: 12.5px;
    font-weight: 500;
    color: #edf1fb;
    line-height: 1.42;
  }
  .pw-cd-sub {
    margin-top: 5px;
    font-size: 10.5px;
    color: #93a1c2;
  }

  /* ── Anchored Plan / Context Card (interactive) ───────────── */
  #pw-card {
    position: fixed;
    top: 80px; left: 80px;
    width: 332px;
    max-width: calc(100vw - 24px);
    background: #182036;
    border: 1px solid #3c4b72;
    border-radius: 12px;
    padding: 13px 15px;
    font: 13px/1.5 system-ui, -apple-system, sans-serif;
    color: #dce3f2;
    box-shadow: 0 10px 28px rgba(10, 14, 28, 0.55);
    display: none;
    z-index: 2147483647;
    pointer-events: auto;
  }

  /* ── Corner Mini Dock (Next / Re-scan / Hide) ─────────────── */
  #pw-mini-dock {
    position: fixed;
    bottom: 16px; right: 16px;
    display: none;
    align-items: center;
    gap: 6px;
    background: rgba(24, 32, 54, 0.94);
    border: 1px solid #354368;
    border-radius: 10px;
    padding: 6px 8px;
    box-shadow: 0 4px 14px rgba(10, 14, 28, 0.45);
    z-index: 2147483646;
    pointer-events: auto;
    font: 11px/1 system-ui, -apple-system, sans-serif;
  }
  .pw-dock-label {
    color: #dfa0c2;
    font-weight: 600;
    font-size: 11px;
    padding: 0 4px;
  }

  /* ── Shared typography & buttons ──────────────────────────── */
  .pw-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
    padding-bottom: 7px;
    border-bottom: 1px solid #2e3b5c;
  }
  .pw-brand {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #dfa0c2;
  }
  .pw-pill {
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: #b7c4e0;
    background: #232e4a;
    border: 1px solid #354368;
    padding: 2px 7px;
    border-radius: 99px;
  }
  .pw-pill-err {
    color: #f4b8c3;
    background: rgba(222, 122, 139, 0.16);
    border-color: rgba(222, 122, 139, 0.4);
  }

  .pw-plan-goal {
    font-size: 11.5px;
    color: #93a1c2;
    margin-bottom: 9px;
  }
  .pw-plan-list {
    list-style: none;
    margin: 0 0 10px 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pw-plan-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: #202a45;
    border: 1px solid #2e3c5e;
    border-radius: 8px;
    padding: 7px 9px;
  }
  .pw-plan-num {
    width: 18px; height: 18px;
    border-radius: 50%;
    background: #b54c86;
    color: #f3f6fc;
    font-size: 10.5px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .pw-plan-text {
    font-size: 12px;
    line-height: 1.4;
    color: #dce3f2;
  }
  .pw-confirm-ask {
    font-size: 11.5px;
    font-weight: 500;
    color: #dfa0c2;
    margin-bottom: 2px;
  }

  .pw-hint {
    margin: 0;
    font-size: 12.5px;
    font-weight: 500;
    line-height: 1.5;
    color: #e4e9f5;
  }
  .pw-subnote {
    margin-top: 6px;
    font-size: 11.5px;
    line-height: 1.4;
    color: #dfa0c2;
  }
  .pw-error {
    margin-top: 4px;
    color: #eba4b0;
    font-size: 12px;
    line-height: 1.45;
  }

  .pw-input {
    width: 100%;
    box-sizing: border-box;
    margin-top: 8px;
    background: #141b2d;
    border: 1px solid #354368;
    border-radius: 8px;
    color: #dce3f2;
    font: 12.5px/1.4 system-ui, -apple-system, sans-serif;
    padding: 8px 10px;
    outline: none;
  }
  .pw-input:focus {
    border-color: #c45792;
  }

  .pw-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
  }
  .pw-btn {
    font: 600 11px/1 system-ui, -apple-system, sans-serif;
    padding: 8px 11px;
    border-radius: 7px;
    cursor: pointer;
    border: 1px solid #354368;
    background: #232e4a;
    color: #cbd4ea;
    transition: all 140ms ease;
  }
  .pw-btn:hover {
    border-color: #c45792;
    color: #eef2fa;
  }
  .pw-btn-sm {
    padding: 6px 8px;
    font-size: 10.5px;
  }
  .pw-btn-primary {
    flex: 1;
    background: #b54c86;
    border-color: #c45792;
    color: #f5f7fc;
    font-weight: 600;
  }
  .pw-btn-primary:hover {
    background: #c65d97;
    border-color: #d676ab;
  }

  .pw-scanning {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #dfa0c2;
    font-weight: 500;
  }
  .pw-scan-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #c45792;
    animation: pw-scan-blink 1.1s ease infinite;
    flex-shrink: 0;
  }
  @keyframes pw-scan-blink {
    0%,100% { opacity: 1; transform: scale(1); }
    50%      { opacity: .35; transform: scale(.7); }
  }

  .pw-pause {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .pw-pause-icon { font-size: 19px; flex-shrink: 0; }
  .pw-pause-body { font-size: 12.5px; line-height: 1.5; color: #dce3f2; }
  .pw-pause-title {
    color: #dfa0c2;
    font-weight: 600;
    font-size: 11px;
    letter-spacing: .05em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
</style>

<!-- Ghost cursor SVG (Calm Navy + Soft Magenta pointer, tip at 5,3) -->
<svg id="pw-cursor" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M5 3L25.5 14L15.3 16.5L10.5 26.5L5 3Z" fill="#182036" stroke="#c45792" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M8.5 7.5L20.5 14L14.2 15.8L11 22.5L8.5 7.5Z" fill="#c45792" fill-opacity="0.45"/>
</svg>

<!-- Highlight ring around target element -->
<div id="pw-highlight"></div>
<div id="pw-tag"></div>

<!-- Dialogue box attached to the user's cursor -->
<div id="pw-cursor-dialogue"></div>

<!-- Interactive confirmation / context card -->
<div id="pw-card"></div>

<!-- Minimal corner controls while guiding -->
<div id="pw-mini-dock"></div>
`;function et(e){return`
  <div class="pw-head">
    <span class="pw-brand">⬡ POINTWISE</span>
    <span class="pw-pill pw-pill-err">PAUSED</span>
  </div>
  <div class="pw-pause">
    <span class="pw-pause-icon">🔒</span>
    <div class="pw-pause-body">
      <div class="pw-pause-title">Sensitive Step Detected</div>
      ${k(e)}<br>
      <small style="color:#93a1c2;font-size:11px">PointWise stepped back. Resume when ready.</small>
    </div>
  </div>
  <div class="pw-actions">
    <button class="pw-btn pw-btn-primary" data-pw-action="next">Continue Next →</button>
    <button class="pw-btn" data-pw-action="rescan">Re-scan</button>
  </div>`}function k(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}const it={"image/jpeg":[[255,216,255]],"image/png":[[137,80,78,71]],"image/gif":[[71,73,70,56]],"image/webp":[[82,73,70,70]],"application/pdf":[[37,80,68,70]],"application/zip":[[80,75,3,4]]};async function st(e,t,n=!1){const i=[],o={ok:!1,sizeBytes:e.size,errors:i},a=await ot(e,8),s=at(a);if(o.actualMime=s??e.type,s&&!t.allowedMimes.includes(s)&&i.push(`File format not accepted. Detected: ${s}. Allowed: ${t.allowedMimes.join(", ")}.`),t.maxBytes&&e.size>t.maxBytes&&i.push(`File too large: ${$(e.size)}. Maximum: ${$(t.maxBytes)}.`),s!=null&&s.startsWith("image/")&&(t.maxWidth||t.maxHeight)){const l=await N(e);o.width=l.width,o.height=l.height;const p=t.maxWidth&&l.width>t.maxWidth,g=t.maxHeight&&l.height>t.maxHeight;if(p||g){if(n){const h=t.maxWidth??l.width,b=t.maxHeight??l.height,x=await rt(e,h,b);if(x)return o.resizedBlob=x,o.ok=i.length===0,o}i.push(`Image too large: ${l.width}×${l.height}px. Maximum: ${t.maxWidth??"∞"}×${t.maxHeight??"∞"}px.`)}}return o.ok=i.length===0,o}function nt(e,t){function n(o){o.addEventListener("change",async()=>{var p;const a=(p=o.files)==null?void 0:p[0];if(!a)return;const s=e(o);if(!s)return;const l=await st(a,s,!0);t(o,l)})}document.querySelectorAll("input[type=file]").forEach(n);const i=new MutationObserver(o=>{for(const a of o)a.addedNodes.forEach(s=>{s instanceof HTMLInputElement&&s.type==="file"&&n(s),s instanceof HTMLElement&&s.querySelectorAll("input[type=file]").forEach(n)})});return i.observe(document.body,{childList:!0,subtree:!0}),()=>i.disconnect()}async function ot(e,t){const i=await e.slice(0,t).arrayBuffer();return new Uint8Array(i)}function at(e){for(const[t,n]of Object.entries(it))for(const i of n)if(i.every((o,a)=>e[a]===o))return t;return null}async function N(e){return new Promise((t,n)=>{const i=URL.createObjectURL(e),o=new Image;o.onload=()=>{URL.revokeObjectURL(i),t({width:o.naturalWidth,height:o.naturalHeight})},o.onerror=()=>{URL.revokeObjectURL(i),n(new Error("Could not decode image"))},o.src=i})}async function rt(e,t,n){try{const i=await N(e),o=Math.min(t/i.width,n/i.height,1),a=Math.round(i.width*o),s=Math.round(i.height*o),l=new OffscreenCanvas(a,s),p=l.getContext("2d"),g=await createImageBitmap(e);return p.drawImage(g,0,0,a,s),g.close(),await l.convertToBlob({type:e.type,quality:.92})}catch{return}}function $(e){return e<1024?`${e} B`:e<1024**2?`${(e/1024).toFixed(1)} KB`:`${(e/1024**2).toFixed(1)} MB`}const I="__pointwiseContentInitialized";globalThis[I]||(globalThis[I]=!0,ct());function ct(){let e=null,t=null,n=0,i="",o=!1,a=null,s=null;chrome.runtime.onMessage.addListener((r,c,d)=>{switch(r.type){case"PING":return d({ok:!0}),!1;case"TOGGLE_ON":return o=!0,i=r.taskGoal||i,l(()=>p()),d({ok:!0}),!1;case"TOGGLE_OFF":return o=!1,b(),d({ok:!0}),!1;case"COLLECT_SNAPSHOT":return o?(g().then(m=>d({snapshot:m})).catch(()=>d({snapshot:null})),!0):(d({snapshot:null}),!1);case"CONTEXT_REQUIRED":return!o||!e||(e.showContextWaiting(r.question,r.popupOpened),d({ok:!0})),!1;case"PLAN_READY":return!o||!e||(t=r.plan,n=0,e.showPlanConfirmation(r.plan),d({ok:!0})),!1;case"PLAN_ERROR":return!o||!e||(e.showNotice(r.message,!0),d({ok:!0})),!1;default:return!1}});function l(r){document.body&&document.readyState!=="loading"?r():document.addEventListener("DOMContentLoaded",r,{once:!0})}function p(){!o||!document.body||(e||(e=new J,e.onConfirm(()=>{!o||!t||(n=0,E(0))}),e.onCancel(()=>{s==null||s(),s=null}),e.onContextSubmit(r=>{chrome.runtime.sendMessage({type:"CONTEXT_SUBMITTED",answer:r}).catch(()=>{})}),e.onNext(()=>x()),e.onRescan(()=>h()),e.onDismiss(()=>{s==null||s(),s=null})),a||(a=nt(O,(r,c)=>{const d=r.id?`#${CSS.escape(r.id)}`:"input[type=file]";c.ok?e==null||e.pointAt(d,{hint:"✅ File validated locally — safe to submit."}):e==null||e.pointAt(d,{hint:"⚠️ File issue detected before upload",error:c.errors.join(" ")})})),e.showScanning())}function g(){return new Promise(r=>{l(()=>{const c=A();if(c.elements.length>=3){r(c);return}setTimeout(()=>{r(A())},550)})})}function h(){if(!o||!e)return;s==null||s(),s=null,e.showScanning();const r=A();chrome.runtime.sendMessage({type:"SNAPSHOT_READY",snapshot:r,taskGoal:i}).catch(()=>{})}function b(){s==null||s(),s=null,a==null||a(),a=null,e==null||e.destroy(),e=null,t=null,n=0}function x(){if(!o||!e)return;if(!t){h();return}const r=n+1;r<t.steps.length?(n=r,E(r)):h()}async function E(r){var T;if(!t||!e||!o)return;s==null||s(),s=null;const c=t.steps[r];if(!c){e.showNotice("✅ All visible steps complete! Click Re-scan if the page updated.");return}const d=C(c);if(!d){r+1<t.steps.length?(n=r+1,await E(r+1)):e.showNotice(c.errorRecovery??"Target element is not visible right now. Try Re-scan.",!0);return}const m=Array.from(document.querySelectorAll("iframe")).map(f=>f.src).filter(Boolean),w=((T=d.parentElement)==null?void 0:T.textContent)??"",y=Q(`${c.hint} ${d.textContent??""}`,w,m);if(y!=="normal"||c.sensitivityClass!=="normal"){const f=y!=="normal"?y:c.sensitivityClass;e.showPauseBanner(z(f));return}if(c.action==="pause"){e.showPauseBanner(c.hint);return}const v={hint:c.hint,stepIndex:r,totalSteps:t.steps.length,action:c.action};c.errorRecovery!==void 0&&(v.error=c.errorRecovery),await e.pointAtElement(d,v),chrome.runtime.sendMessage({type:"STEP_COMPLETE",stepIndex:r}).catch(()=>{}),L(d,c,r)}function L(r,c,d){var T;const m=r.tagName.toLowerCase(),w=(T=r.type)==null?void 0:T.toLowerCase(),y=m==="input"&&w!=="submit"&&w!=="button"&&w!=="checkbox"&&w!=="radio"||m==="textarea",v=()=>{!o||n!==d||setTimeout(()=>{!o||n!==d||x()},350)};if(y||c.action==="focus"){const f=R=>{R.key==="Enter"&&v()},S=()=>v();r.addEventListener("keydown",f),r.addEventListener("change",S),s=()=>{r.removeEventListener("keydown",f),r.removeEventListener("change",S)}}else{const f=()=>v();r.addEventListener("click",f,{capture:!0,once:!0}),s=()=>{r.removeEventListener("click",f,{capture:!0})}}}function C(r){try{const c=document.querySelectorAll(r.targetSelector);for(const d of c)if(M(d))return d}catch{}if(r.fallbackLabel){const c=r.fallbackLabel.toLowerCase().trim();if(c.length>=2){const d=document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="link"]');for(const m of d){if(m.closest("#pointwise-host")||!M(m))continue;if([m.getAttribute("aria-label"),m.getAttribute("placeholder"),m.getAttribute("title"),m.textContent].filter(Boolean).join(" ").toLowerCase().includes(c))return m}}}return null}function M(r){const c=window.getComputedStyle(r);if(c.display==="none"||c.visibility==="hidden")return!1;const d=r.getBoundingClientRect();return d.width>0&&d.height>0}function z(r){return{captcha:"CAPTCHA detected — please complete it yourself.",otp:"OTP or verification code required — please enter it yourself.",payment:"Payment field detected — please enter your details yourself.",legal:"Legal declaration or agreement — please read and check it yourself."}[r]??"Sensitive step detected — PointWise has stepped back."}function O(r){var T;const c=r.accept;if(!c)return null;const d=c.split(",").map(f=>f.trim()).filter(f=>f.includes("/")),w=(((T=r.closest("form, section, div"))==null?void 0:T.textContent)??"").match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB)/i);let y;if(w&&w[1]&&w[2]){const f=parseFloat(w[1]),S=w[2].toUpperCase();y=S==="KB"?f*1024:S==="MB"?f*1024**2:f*1024**3}const v={allowedMimes:d};return y!==void 0&&(v.maxBytes=y),v}}
