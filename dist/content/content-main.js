var O=Object.defineProperty;var B=(e,t,n)=>t in e?O(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var u=(e,t,n)=>B(e,typeof t!="symbol"?t+"":t,n);const _=[/password/i,/passcode/i,/pin\b/i,/credit.?card/i,/card.?number/i,/cvv|cvc|csc/i,/expir/i,/otp/i,/one.?time/i,/verification.?code/i,/aadhaar|aadhar/i,/pan.?number/i,/ssn|social.?security/i,/passport.?number/i,/date.?of.?birth|dob\b/i],q=[/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,/(\+?\d[\s\-]?){9,13}/g,/\b\d{4}\s?\d{4}\s?\d{4}\b/g,/\b[A-Z]{5}\d{4}[A-Z]\b/g,/\b\d{3}-\d{2}-\d{4}\b/g],W="[REDACTED]";function X(e,t){const n=`${e} ${t??""}`;return _.some(i=>i.test(n))}function H(e){let t=e;for(const n of q)t=t.replace(n,W);return t.length>120?t.slice(0,120)+"…":t}const F=100;function $(){const e=[],t=new Set,n=window.innerHeight||800,i=window.innerWidth||1280;document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="link"], [role="textbox"], [role="combobox"], [role="searchbox"], [role="menuitem"], [role="tab"], [tabindex]').forEach(r=>{var L;if(r.closest("#pointwise-host")||!G(r))return;const s=r.getBoundingClientRect();if(s.width<2||s.height<2)return;const l=V(r),d=r.name??"",h=(L=r.type)==null?void 0:L.toLowerCase();if(X(l,d)||h==="password"||h==="hidden")return;const g=r.tagName.toLowerCase();if(!l&&g!=="input"&&g!=="select"&&g!=="textarea")return;const b=U(r);if(!b||t.has(b))return;t.add(b);const x=s.bottom>=0&&s.right>=0&&s.top<=n&&s.left<=i,C=g==="input"||g==="button"||g==="select"||g==="textarea"||r.getAttribute("role")==="button",S=(x?10:0)+(C?5:0),k={selector:b,role:r.getAttribute("role")??g,label:H(l),tagName:g,rect:{x:Math.round(s.x),y:Math.round(s.y),width:Math.round(s.width),height:Math.round(s.height)},visible:!0,inViewport:x,disabled:r.disabled??!1,_priority:S};g==="input"&&h&&(k.inputType=h),h==="file"&&(k.hasFileInput=!0),e.push(k)}),e.sort((r,s)=>s._priority-r._priority);const o=e.slice(0,F).map(({_priority:r,...s})=>s);return{url:location.href,title:H(document.title),elements:o}}function G(e){if(e.getAttribute("aria-hidden")==="true")return!1;const t=window.getComputedStyle(e);return t.display!=="none"&&t.visibility!=="hidden"&&parseFloat(t.opacity||"1")>.05}function V(e){var i,o,r,s;const t=e.id,n=t?(i=document.querySelector(`label[for="${CSS.escape(t)}"]`))==null?void 0:i.textContent:void 0;return e.getAttribute("aria-label")??e.getAttribute("placeholder")??(n==null?void 0:n.trim())??e.getAttribute("title")??((r=(o=e.value)==null?void 0:o.trim)==null?void 0:r.call(o))??((s=e.textContent)==null?void 0:s.replace(/\s+/g," ").trim().slice(0,80))??""}function A(e){try{return document.querySelectorAll(e).length===1}catch{return!1}}function Y(e,t){const n=t.replace(/\\/g,"\\\\").replace(/"/g,'\\"');return`[${e}="${n}"]`}function U(e){if(e.id){const t=`#${CSS.escape(e.id)}`;if(A(t))return t}for(const t of["data-testid","aria-label","name","placeholder"]){const n=e.getAttribute(t);if(n&&n.length<80){const i=`${e.tagName.toLowerCase()}${Y(t,n)}`;if(A(i))return i}}return j(e)}function j(e){const t=[];let n=e;for(;n&&n.tagName.toLowerCase()!=="html";){if(n.id){const d=`#${CSS.escape(n.id)}`;if(A(d)){t.unshift(d);break}}const i=n.parentElement,o=n.tagName.toLowerCase();if(!i){t.unshift(o);break}const r=n.tagName,s=Array.from(i.children).filter(d=>d.tagName===r),l=s.indexOf(n)+1;t.unshift(s.length>1?`${o}:nth-of-type(${l})`:o),n=i}return t.join(" > ")}const Z=[{class:"captcha",patterns:[/captcha/i,/challenge/i,/prove.*human/i],iframeSrcPatterns:[/recaptcha/i,/hcaptcha\.com/i,/turnstile\.cloudflare\.com/i,/altcha\.org/i]},{class:"otp",patterns:[/one.?time/i,/\botp\b/i,/verification.?code/i,/auth.*code/i]},{class:"payment",patterns:[/credit.?card/i,/card.?number/i,/cvv|cvc/i,/upi\b/i,/pay now/i],iframeSrcPatterns:[/stripe\.com/i,/razorpay\.com/i,/braintreegateway\.com/i,/paypal\.com/i,/payu\./i]},{class:"legal",patterns:[/i agree/i,/terms.*condition/i,/declaration/i,/i hereby/i,/consent/i]}];function K(e,t,n=[]){var o;const i=`${e} ${t}`.toLowerCase();for(const r of Z){const s=r.patterns.some(d=>d.test(i)),l=((o=r.iframeSrcPatterns)==null?void 0:o.some(d=>n.some(h=>d.test(h))))??!1;if(s||l)return r.class}return"normal"}class Q{constructor(){u(this,"shadow");u(this,"cursor");u(this,"cursorDialogue");u(this,"card");u(this,"miniDock");u(this,"highlight");u(this,"tag");u(this,"state","idle");u(this,"currentTarget",null);u(this,"hasPlacedCursor",!1);u(this,"resizeObserver");u(this,"scrollRafId",null);u(this,"userMouseX");u(this,"userMouseY");u(this,"confirmHandlers",[]);u(this,"cancelHandlers",[]);u(this,"nextHandlers",[]);u(this,"rescanHandlers",[]);u(this,"dismissHandlers",[]);u(this,"contextHandlers",[]);u(this,"boundSyncPosition");u(this,"boundMouseTrack");var n;(n=document.getElementById("pointwise-host"))==null||n.remove(),this.userMouseX=Math.round((window.innerWidth||1e3)*.5),this.userMouseY=Math.round((window.innerHeight||700)*.35);const t=document.createElement("div");t.setAttribute("id","pointwise-host"),t.style.cssText="all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;",document.body.appendChild(t),this.shadow=t.attachShadow({mode:"closed"}),this.shadow.innerHTML=J,this.cursor=this.shadow.querySelector("#pw-cursor"),this.cursorDialogue=this.shadow.querySelector("#pw-cursor-dialogue"),this.card=this.shadow.querySelector("#pw-card"),this.miniDock=this.shadow.querySelector("#pw-mini-dock"),this.highlight=this.shadow.querySelector("#pw-highlight"),this.tag=this.shadow.querySelector("#pw-tag"),this.boundSyncPosition=()=>this.syncPosition(),this.boundMouseTrack=i=>this.handleMouseTrack(i),window.addEventListener("scroll",this.boundSyncPosition,{capture:!0,passive:!0}),window.addEventListener("resize",this.boundSyncPosition,{passive:!0}),document.addEventListener("mousemove",this.boundMouseTrack,{capture:!0,passive:!0}),document.addEventListener("mousedown",this.boundMouseTrack,{capture:!0,passive:!0}),this.resizeObserver=new ResizeObserver(()=>this.syncPosition()),this.card.addEventListener("click",i=>{const o=i.target.closest("[data-pw-action]");if(!o)return;i.stopPropagation();const r=o.dataset.pwAction;if(r==="confirm")this.userMouseX=i.clientX,this.userMouseY=i.clientY,this.card.style.display="none",this.confirmHandlers.forEach(s=>s());else if(r==="cancel")this.withdraw(),this.cancelHandlers.forEach(s=>s());else if(r==="rescan")this.rescanHandlers.forEach(s=>s());else if(r==="dismiss")this.withdraw(),this.dismissHandlers.forEach(s=>s());else if(r==="next")this.card.style.display="none",this.nextHandlers.forEach(s=>s());else if(r==="submit-context"){const s=this.card.querySelector("#pw-inline-context"),l=(s==null?void 0:s.value.trim())??"";this.contextHandlers.forEach(d=>d(l))}}),this.card.addEventListener("keydown",i=>{if(i.key==="Enter"){const o=i.target.closest("#pw-inline-context");o&&(i.preventDefault(),this.contextHandlers.forEach(r=>r(o.value.trim())))}}),this.miniDock.addEventListener("click",i=>{const o=i.target.closest("[data-pw-action]");if(!o)return;i.stopPropagation();const r=o.dataset.pwAction;r==="next"&&this.nextHandlers.forEach(s=>s()),r==="rescan"&&this.rescanHandlers.forEach(s=>s()),r==="dismiss"&&(this.withdraw(),this.dismissHandlers.forEach(s=>s()))})}onConfirm(t){this.confirmHandlers.push(t)}onCancel(t){this.cancelHandlers.push(t)}onNext(t){this.nextHandlers.push(t)}onRescan(t){this.rescanHandlers.push(t)}onDismiss(t){this.dismissHandlers.push(t)}onContextSubmit(t){this.contextHandlers.push(t)}showScanning(){this.clearTargetVisuals(),this.card.style.display="none",this.miniDock.style.display="none",this.state="scanning",this.cursorDialogue.innerHTML=`
      <div class="pw-cd-head">
        <span class="pw-brand">⬡ POINTWISE</span>
        <span class="pw-pill">ANALYSING</span>
      </div>
      <div class="pw-scanning">
        <span class="pw-scan-dot"></span>
        Checking prompt &amp; scanning site…
      </div>
    `,this.cursorDialogue.style.display="block",this.positionCursorDialogue(this.userMouseX,this.userMouseY)}showContextWaiting(t,n){this.clearTargetVisuals(),this.cursorDialogue.style.display="none",this.miniDock.style.display="none",this.state="context",n?this.card.innerHTML=`
        <div class="pw-head">
          <span class="pw-brand">⬡ POINTWISE</span>
          <span class="pw-pill">CONTEXT NEEDED</span>
        </div>
        <div class="pw-hint">Please answer the quick question in the PointWise popup to build your plan:</div>
        <div class="pw-warn">${E(t)}</div>
      `:this.card.innerHTML=`
        <div class="pw-head">
          <span class="pw-brand">⬡ POINTWISE</span>
          <span class="pw-pill">MORE DETAILS</span>
        </div>
        <div class="pw-hint">${E(t)}</div>
        <input id="pw-inline-context" class="pw-input" type="text" placeholder="Type details and press Enter…" />
        <div class="pw-actions">
          <button class="pw-btn pw-btn-primary" data-pw-action="submit-context">Continue ▶</button>
          <button class="pw-btn" data-pw-action="cancel">Cancel</button>
        </div>
      `,this.card.style.display="block",this.positionCardAtCursor(),n||setTimeout(()=>{var i;(i=this.card.querySelector("#pw-inline-context"))==null||i.focus()},30)}showPlanConfirmation(t){this.clearTargetVisuals(),this.cursorDialogue.style.display="none",this.miniDock.style.display="none",this.state="confirm";const n=t.steps.map((o,r)=>`
        <li class="pw-plan-item">
          <span class="pw-plan-num">${r+1}</span>
          <span class="pw-plan-text">${E(o.hint)}</span>
        </li>`).join(""),i=t.source==="local"?"LOCAL PLAN":"AI PLAN";this.card.innerHTML=`
      <div class="pw-head">
        <span class="pw-brand">⬡ POINTWISE</span>
        <span class="pw-pill">${i}</span>
      </div>
      <div class="pw-plan-title">Plan of Action</div>
      <div class="pw-plan-goal">${E(t.taskGoal||"Complete task on this page")}</div>
      <ol class="pw-plan-list">${n}</ol>
      ${t.warning?`<div class="pw-warn">${E(t.warning)}</div>`:""}
      <div class="pw-confirm-ask">Confirm to start highlighting and guiding?</div>
      <div class="pw-actions">
        <button class="pw-btn pw-btn-primary" data-pw-action="confirm">Confirm &amp; Continue ▶</button>
        <button class="pw-btn" data-pw-action="cancel">Cancel</button>
      </div>
    `,this.card.style.display="block",this.positionCardAtCursor()}async pointAtElement(t,n){this.currentTarget&&this.resizeObserver.unobserve(this.currentTarget),this.currentTarget=t,this.resizeObserver.observe(t),this.card.style.display="none";const i=t.getBoundingClientRect(),o=i.top<40||i.bottom>window.innerHeight-40||i.left<0||i.right>window.innerWidth;o&&t.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"}),this.state="active",this.renderCursorDialogue(n),this.renderMiniDock(n),this.renderTargetVisuals(t,n),o&&this.startSmoothScrollTracking()}async pointAt(t,n){let i=null;try{i=document.querySelector(t)}catch{i=null}if(!i){this.showNotice(n.error??"Could not locate the expected element.",!0);return}await this.pointAtElement(i,n)}showNotice(t,n=!1){this.clearTargetVisuals(),this.cursorDialogue.style.display="none",this.miniDock.style.display="none",this.state="idle",this.card.innerHTML=`
      <div class="pw-head">
        <span class="pw-brand">⬡ POINTWISE</span>
        <span class="pw-pill ${n?"pw-pill-err":""}">${n?"NOTICE":"DONE"}</span>
      </div>
      <div class="${n?"pw-error":"pw-hint"}">${E(t)}</div>
      <div class="pw-actions">
        <button class="pw-btn pw-btn-primary" data-pw-action="rescan">Re-scan ↻</button>
        <button class="pw-btn" data-pw-action="dismiss">Hide</button>
      </div>
    `,this.card.style.display="block",this.positionCardAtCursor()}showPauseBanner(t){this.clearTargetVisuals(),this.cursorDialogue.style.display="none",this.miniDock.style.display="none",this.state="paused",this.card.innerHTML=tt(t),this.card.style.display="block",this.positionCardAtCursor()}withdraw(){this.clearTargetVisuals(),this.cursorDialogue.style.display="none",this.card.style.display="none",this.miniDock.style.display="none",this.state="withdrawn"}destroy(){this.scrollRafId!==null&&cancelAnimationFrame(this.scrollRafId),this.resizeObserver.disconnect(),window.removeEventListener("scroll",this.boundSyncPosition,{capture:!0}),window.removeEventListener("resize",this.boundSyncPosition),document.removeEventListener("mousemove",this.boundMouseTrack,{capture:!0}),document.removeEventListener("mousedown",this.boundMouseTrack,{capture:!0}),this.shadow.host.remove()}clearTargetVisuals(){this.currentTarget&&(this.resizeObserver.unobserve(this.currentTarget),this.currentTarget=null),this.cursor.style.display="none",this.highlight.style.display="none",this.tag.style.display="none"}renderTargetVisuals(t,n){const i=t.getBoundingClientRect();if(i.width<=0||i.height<=0)return;const o=5,r=Math.max(2,i.left-o),s=Math.max(2,i.top-o),l=i.width+o*2,d=i.height+o*2;if(this.highlight.style.left=`${r}px`,this.highlight.style.top=`${s}px`,this.highlight.style.width=`${l}px`,this.highlight.style.height=`${d}px`,this.highlight.style.display="block",n){const x=(n.stepIndex??0)+1,C=D(n.action);this.tag.textContent=`STEP ${x} • ${C}`}const h=s>28?s-24:s+d+6;this.tag.style.left=`${Math.min(r,Math.max(8,window.innerWidth-160))}px`,this.tag.style.top=`${h}px`,this.tag.style.display="block";const g=i.left+Math.min(i.width*.72,Math.max(i.width-14,i.width*.5)),b=i.top+Math.min(i.height*.68,Math.max(i.height-8,i.height*.5));this.moveGhostCursorTo(g,b)}moveGhostCursorTo(t,n){const i=Math.round(t-5),o=Math.round(n-3);if(!this.hasPlacedCursor){const r=Math.max(24,this.userMouseX),s=Math.max(24,this.userMouseY);this.cursor.style.display="block",this.cursor.style.transform=`translate(${r}px, ${s}px)`,this.cursor.style.opacity="0",this.cursor.getBoundingClientRect(),this.hasPlacedCursor=!0}this.cursor.style.display="block",this.cursor.style.opacity="1",this.cursor.style.transform=`translate(${i}px, ${o}px)`}renderCursorDialogue(t){const n=(t.stepIndex??0)+1,i=t.totalSteps??1,o=D(t.action);this.cursorDialogue.innerHTML=`
      <div class="pw-cd-head">
        <span class="pw-brand">⬡ POINTWISE</span>
        <span class="pw-pill">STEP ${n}/${i} · ${o}</span>
      </div>
      <div class="pw-cd-hint">${E(t.hint)}</div>
      <div class="pw-cd-sub">Act on the highlighted element to continue</div>
    `,this.cursorDialogue.style.display="block",this.positionCursorDialogue(this.userMouseX,this.userMouseY)}renderMiniDock(t){const n=(t.stepIndex??0)+1,i=t.totalSteps??1,o=n>=i;this.miniDock.innerHTML=`
      <span class="pw-dock-label">Step ${n}/${i}</span>
      <button class="pw-btn pw-btn-primary pw-btn-sm" data-pw-action="next">${o?"Done ↻":"Next →"}</button>
      <button class="pw-btn pw-btn-sm" data-pw-action="rescan">Re-scan</button>
      <button class="pw-btn pw-btn-sm" data-pw-action="dismiss">Hide</button>
    `,this.miniDock.style.display="flex"}positionCursorDialogue(t,n){const i=this.cursorDialogue.offsetWidth||268,o=this.cursorDialogue.offsetHeight||86,r=window.innerWidth||1280,s=window.innerHeight||800;let l=t+18,d=n+20;l+i+12>r&&(l=Math.max(8,t-i-14)),d+o+12>s&&(d=Math.max(8,n-o-14)),this.cursorDialogue.style.transform=`translate3d(${Math.round(l)}px, ${Math.round(d)}px, 0)`}positionCardAtCursor(){const t=this.card.offsetWidth||336,n=this.card.offsetHeight||220,i=window.innerWidth||1280,o=window.innerHeight||800;let r=this.userMouseX+16,s=this.userMouseY+16;r+t+16>i&&(r=Math.max(12,i-t-18)),s+n+16>o&&(s=Math.max(12,o-n-18)),this.card.style.left=`${Math.round(r)}px`,this.card.style.top=`${Math.round(s)}px`}handleMouseTrack(t){this.userMouseX=t.clientX,this.userMouseY=t.clientY,(this.state==="scanning"||this.state==="active")&&this.positionCursorDialogue(t.clientX,t.clientY)}syncPosition(){this.state!=="active"||!this.currentTarget||document.contains(this.currentTarget)&&this.renderTargetVisuals(this.currentTarget)}startSmoothScrollTracking(){this.scrollRafId!==null&&cancelAnimationFrame(this.scrollRafId);const t=performance.now(),n=()=>{this.syncPosition(),performance.now()-t<650&&this.state==="active"?this.scrollRafId=requestAnimationFrame(n):this.scrollRafId=null};this.scrollRafId=requestAnimationFrame(n)}}function D(e){return e==="focus"?"ENTER":e==="file-upload"?"UPLOAD":e==="scroll"?"SCROLL":"CLICK"}const J=`
<style>
  :host { all: initial; }

  /* ── Ghost Cursor ─────────────────────────────────────────── */
  #pw-cursor {
    position: fixed;
    top: 0; left: 0;
    width: 30px; height: 30px;
    pointer-events: none;
    transition: transform 460ms cubic-bezier(.22,1,.36,1), opacity 180ms ease;
    z-index: 2147483647;
    filter: drop-shadow(0 0 8px rgba(240, 22, 136, 0.9)) drop-shadow(0 2px 4px rgba(7, 11, 26, 0.7));
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
    border: 2.5px solid #f01688;
    background: rgba(240, 22, 136, 0.09);
    box-shadow:
      0 0 0 3px rgba(14, 22, 48, 0.55),
      0 0 16px 3px rgba(240, 22, 136, 0.65),
      inset 0 0 12px rgba(240, 22, 136, 0.14);
    animation: pw-ring-pulse 1.5s ease-in-out infinite;
  }
  @keyframes pw-ring-pulse {
    0%, 100% {
      box-shadow:
        0 0 0 2px rgba(14, 22, 48, 0.55),
        0 0 14px 2px rgba(240, 22, 136, 0.55),
        inset 0 0 10px rgba(240, 22, 136, 0.12);
    }
    50% {
      box-shadow:
        0 0 0 4px rgba(240, 22, 136, 0.25),
        0 0 24px 5px rgba(240, 22, 136, 0.88),
        inset 0 0 16px rgba(240, 22, 136, 0.2);
    }
  }

  /* ── Floating Step Tag over Target Element ────────────────── */
  #pw-tag {
    position: fixed;
    pointer-events: none;
    z-index: 2147483645;
    display: none;
    background: linear-gradient(135deg, #f01688, #b80d6b);
    color: #ffffff;
    font: 700 10px/1.2 system-ui, -apple-system, sans-serif;
    letter-spacing: 0.08em;
    padding: 4px 8px;
    border-radius: 5px;
    border: 1px solid rgba(255, 255, 255, 0.28);
    box-shadow: 0 2px 10px rgba(240, 22, 136, 0.5);
    white-space: nowrap;
  }

  /* ── Cursor-Attached Action Dialogue Box ──────────────────── */
  #pw-cursor-dialogue {
    position: fixed;
    top: 0; left: 0;
    width: 268px;
    max-width: calc(100vw - 24px);
    background: linear-gradient(165deg, rgba(14, 22, 48, 0.97) 0%, rgba(7, 11, 26, 0.98) 100%);
    border: 1.5px solid #f01688;
    border-radius: 10px;
    padding: 10px 12px;
    font: 12.5px/1.45 system-ui, -apple-system, sans-serif;
    color: #f8fafc;
    box-shadow:
      0 0 18px rgba(240, 22, 136, 0.4),
      0 8px 24px rgba(4, 8, 22, 0.85);
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
    border-bottom: 1px solid rgba(240, 22, 136, 0.25);
  }
  .pw-cd-hint {
    font-size: 12.5px;
    font-weight: 600;
    color: #ffffff;
    line-height: 1.4;
  }
  .pw-cd-sub {
    margin-top: 5px;
    font-size: 10.5px;
    color: #93a7d1;
  }

  /* ── Anchored Plan / Context Card (interactive) ───────────── */
  #pw-card {
    position: fixed;
    top: 80px; left: 80px;
    width: 336px;
    max-width: calc(100vw - 24px);
    background: linear-gradient(165deg, #0e1630 0%, #070b1a 100%);
    border: 1.5px solid #f01688;
    border-radius: 12px;
    padding: 13px 15px;
    font: 13px/1.5 system-ui, -apple-system, sans-serif;
    color: #f1f5ff;
    box-shadow:
      0 0 22px rgba(240, 22, 136, 0.38),
      0 12px 32px rgba(4, 8, 22, 0.9);
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
    background: rgba(11, 17, 38, 0.95);
    border: 1px solid #293c75;
    border-radius: 10px;
    padding: 6px 8px;
    box-shadow: 0 4px 18px rgba(4, 8, 22, 0.8);
    z-index: 2147483646;
    pointer-events: auto;
    font: 11px/1 system-ui, -apple-system, sans-serif;
  }
  .pw-dock-label {
    color: #ff79c6;
    font-weight: 700;
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
    border-bottom: 1px solid rgba(240, 22, 136, 0.25);
  }
  .pw-brand {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: #ff4db8;
    text-shadow: 0 0 8px rgba(240, 22, 136, 0.65);
  }
  .pw-pill {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: #c7d2fe;
    background: #16224a;
    border: 1px solid #2b3f7d;
    padding: 2px 7px;
    border-radius: 99px;
  }
  .pw-pill-err {
    color: #fecdd3;
    background: rgba(244, 63, 94, 0.18);
    border-color: rgba(244, 63, 94, 0.5);
  }

  .pw-plan-title {
    font-size: 13px;
    font-weight: 800;
    color: #ffffff;
    margin-bottom: 2px;
  }
  .pw-plan-goal {
    font-size: 11.5px;
    color: #93a7d1;
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
    background: rgba(21, 32, 66, 0.72);
    border: 1px solid #24356b;
    border-radius: 8px;
    padding: 7px 9px;
  }
  .pw-plan-num {
    width: 18px; height: 18px;
    border-radius: 50%;
    background: #f01688;
    color: #ffffff;
    font-size: 10.5px;
    font-weight: 800;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .pw-plan-text {
    font-size: 12px;
    line-height: 1.4;
    color: #f1f5ff;
  }
  .pw-confirm-ask {
    font-size: 11.5px;
    font-weight: 600;
    color: #ff79c6;
    margin-bottom: 2px;
  }

  .pw-hint {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
    color: #f8fafc;
  }
  .pw-warn {
    margin-top: 6px;
    font-size: 11px;
    line-height: 1.4;
    color: #f9a8d4;
  }
  .pw-error {
    margin-top: 6px;
    color: #fda4af;
    font-size: 12px;
    line-height: 1.45;
  }

  .pw-input {
    width: 100%;
    box-sizing: border-box;
    margin-top: 8px;
    background: #091024;
    border: 1.5px solid #2a3e78;
    border-radius: 8px;
    color: #f8fafc;
    font: 12.5px/1.4 system-ui, -apple-system, sans-serif;
    padding: 8px 10px;
    outline: none;
  }
  .pw-input:focus {
    border-color: #f01688;
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
    border: 1px solid #293c75;
    background: #152042;
    color: #cbd5e1;
    transition: all 140ms ease;
  }
  .pw-btn:hover {
    border-color: #f01688;
    color: #ffffff;
  }
  .pw-btn-sm {
    padding: 6px 8px;
    font-size: 10.5px;
  }
  .pw-btn-primary {
    flex: 1;
    background: #f01688;
    border-color: #f01688;
    color: #ffffff;
    font-weight: 700;
    box-shadow: 0 0 10px rgba(240, 22, 136, 0.45);
  }
  .pw-btn-primary:hover {
    background: #ff3da3;
    border-color: #ff3da3;
  }

  .pw-scanning {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #ff79c6;
    font-weight: 600;
  }
  .pw-scan-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #f01688;
    box-shadow: 0 0 10px rgba(240, 22, 136, 0.9);
    animation: pw-scan-blink 0.9s ease infinite;
    flex-shrink: 0;
  }
  @keyframes pw-scan-blink {
    0%,100% { opacity: 1; transform: scale(1); }
    50%      { opacity: .35; transform: scale(.65); }
  }

  .pw-pause {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .pw-pause-icon { font-size: 20px; flex-shrink: 0; }
  .pw-pause-body { font-size: 12.5px; line-height: 1.5; color: #e2e8f0; }
  .pw-pause-title {
    color: #ff4db8;
    font-weight: 700;
    font-size: 11px;
    letter-spacing: .06em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
</style>

<!-- Ghost cursor SVG (Navy + Magenta pointer, tip at 5,3) -->
<svg id="pw-cursor" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M5 3L27 14.5L15.8 17.2L10.5 28L5 3Z" fill="rgba(240, 22, 136, 0.25)"/>
  <path d="M5 3L25.5 14L15.3 16.5L10.5 26.5L5 3Z" fill="#0b132b" stroke="#f01688" stroke-width="2" stroke-linejoin="round"/>
  <path d="M8.5 7.5L20.5 14L14.2 15.8L11 22.5L8.5 7.5Z" fill="#f01688" fill-opacity="0.5"/>
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
`;function tt(e){return`
  <div class="pw-head">
    <span class="pw-brand">⬡ POINTWISE</span>
    <span class="pw-pill pw-pill-err">PAUSED</span>
  </div>
  <div class="pw-pause">
    <span class="pw-pause-icon">🔒</span>
    <div class="pw-pause-body">
      <div class="pw-pause-title">Sensitive Step Detected</div>
      ${E(e)}<br>
      <small style="color:#8a9bc2;font-size:11px">PointWise stepped back. Resume when ready.</small>
    </div>
  </div>
  <div class="pw-actions">
    <button class="pw-btn pw-btn-primary" data-pw-action="next">Continue Next →</button>
    <button class="pw-btn" data-pw-action="rescan">Re-scan</button>
  </div>`}function E(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}const et={"image/jpeg":[[255,216,255]],"image/png":[[137,80,78,71]],"image/gif":[[71,73,70,56]],"image/webp":[[82,73,70,70]],"application/pdf":[[37,80,68,70]],"application/zip":[[80,75,3,4]]};async function it(e,t,n=!1){const i=[],o={ok:!1,sizeBytes:e.size,errors:i},r=await nt(e,8),s=ot(r);if(o.actualMime=s??e.type,s&&!t.allowedMimes.includes(s)&&i.push(`File format not accepted. Detected: ${s}. Allowed: ${t.allowedMimes.join(", ")}.`),t.maxBytes&&e.size>t.maxBytes&&i.push(`File too large: ${P(e.size)}. Maximum: ${P(t.maxBytes)}.`),s!=null&&s.startsWith("image/")&&(t.maxWidth||t.maxHeight)){const l=await N(e);o.width=l.width,o.height=l.height;const d=t.maxWidth&&l.width>t.maxWidth,h=t.maxHeight&&l.height>t.maxHeight;if(d||h){if(n){const g=t.maxWidth??l.width,b=t.maxHeight??l.height,x=await rt(e,g,b);if(x)return o.resizedBlob=x,o.ok=i.length===0,o}i.push(`Image too large: ${l.width}×${l.height}px. Maximum: ${t.maxWidth??"∞"}×${t.maxHeight??"∞"}px.`)}}return o.ok=i.length===0,o}function st(e,t){function n(o){o.addEventListener("change",async()=>{var d;const r=(d=o.files)==null?void 0:d[0];if(!r)return;const s=e(o);if(!s)return;const l=await it(r,s,!0);t(o,l)})}document.querySelectorAll("input[type=file]").forEach(n);const i=new MutationObserver(o=>{for(const r of o)r.addedNodes.forEach(s=>{s instanceof HTMLInputElement&&s.type==="file"&&n(s),s instanceof HTMLElement&&s.querySelectorAll("input[type=file]").forEach(n)})});return i.observe(document.body,{childList:!0,subtree:!0}),()=>i.disconnect()}async function nt(e,t){const i=await e.slice(0,t).arrayBuffer();return new Uint8Array(i)}function ot(e){for(const[t,n]of Object.entries(et))for(const i of n)if(i.every((o,r)=>e[r]===o))return t;return null}async function N(e){return new Promise((t,n)=>{const i=URL.createObjectURL(e),o=new Image;o.onload=()=>{URL.revokeObjectURL(i),t({width:o.naturalWidth,height:o.naturalHeight})},o.onerror=()=>{URL.revokeObjectURL(i),n(new Error("Could not decode image"))},o.src=i})}async function rt(e,t,n){try{const i=await N(e),o=Math.min(t/i.width,n/i.height,1),r=Math.round(i.width*o),s=Math.round(i.height*o),l=new OffscreenCanvas(r,s),d=l.getContext("2d"),h=await createImageBitmap(e);return d.drawImage(h,0,0,r,s),h.close(),await l.convertToBlob({type:e.type,quality:.92})}catch{return}}function P(e){return e<1024?`${e} B`:e<1024**2?`${(e/1024).toFixed(1)} KB`:`${(e/1024**2).toFixed(1)} MB`}const I="__pointwiseContentInitialized";globalThis[I]||(globalThis[I]=!0,at());function at(){let e=null,t=null,n=0,i="",o=!1,r=null,s=null;chrome.runtime.onMessage.addListener((a,c,p)=>{switch(a.type){case"PING":return p({ok:!0}),!1;case"TOGGLE_ON":return o=!0,i=a.taskGoal||i,l(()=>d(i)),p({ok:!0}),!1;case"TOGGLE_OFF":return o=!1,g(),p({ok:!0}),!1;case"CONTEXT_REQUIRED":return!o||!e||(e.showContextWaiting(a.question,a.popupOpened),p({ok:!0})),!1;case"PLAN_READY":return!o||!e||(t=a.plan,n=0,e.showPlanConfirmation(a.plan),p({ok:!0})),!1;case"PLAN_ERROR":return!o||!e||(e.showNotice(a.message,!0),p({ok:!0})),!1;default:return!1}});function l(a){document.body&&document.readyState!=="loading"?a():document.addEventListener("DOMContentLoaded",a,{once:!0})}function d(a){!o||!document.body||(e||(e=new Q,e.onConfirm(()=>{!o||!t||(n=0,x(0))}),e.onCancel(()=>{s==null||s(),s=null}),e.onContextSubmit(c=>{chrome.runtime.sendMessage({type:"CONTEXT_SUBMITTED",answer:c}).catch(()=>{})}),e.onNext(()=>b()),e.onRescan(()=>h(i)),e.onDismiss(()=>{s==null||s(),s=null})),r||(r=st(z,(c,p)=>{const m=c.id?`#${CSS.escape(c.id)}`:"input[type=file]";p.ok?e==null||e.pointAt(m,{hint:"✅ File validated locally — safe to submit."}):e==null||e.pointAt(m,{hint:"⚠️ File issue detected before upload",error:p.errors.join(" ")})})),h(a))}function h(a){if(!o||!e)return;s==null||s(),s=null,e.showScanning();let c=$();if(c.elements.length<3){setTimeout(()=>{o&&(c=$(),chrome.runtime.sendMessage({type:"SNAPSHOT_READY",snapshot:c,taskGoal:a}))},600);return}chrome.runtime.sendMessage({type:"SNAPSHOT_READY",snapshot:c,taskGoal:a})}function g(){s==null||s(),s=null,r==null||r(),r=null,e==null||e.destroy(),e=null,t=null,n=0}function b(){if(!o||!e)return;if(!t){h(i);return}const a=n+1;a<t.steps.length?(n=a,x(a)):h(i)}async function x(a){var T;if(!t||!e||!o)return;s==null||s(),s=null;const c=t.steps[a];if(!c){e.showNotice("✅ All visible steps complete! Click Re-scan if the page updated.");return}const p=S(c);if(!p){a+1<t.steps.length?(n=a+1,await x(a+1)):e.showNotice(c.errorRecovery??"Target element is not visible right now. Try Re-scan.",!0);return}const m=Array.from(document.querySelectorAll("iframe")).map(f=>f.src).filter(Boolean),w=((T=p.parentElement)==null?void 0:T.textContent)??"",v=K(`${c.hint} ${p.textContent??""}`,w,m);if(v!=="normal"||c.sensitivityClass!=="normal"){const f=v!=="normal"?v:c.sensitivityClass;e.showPauseBanner(L(f));return}if(c.action==="pause"){e.showPauseBanner(c.hint);return}const y={hint:c.hint,stepIndex:a,totalSteps:t.steps.length,action:c.action};a===0&&t.warning!==void 0&&(y.warning=t.warning),c.errorRecovery!==void 0&&(y.error=c.errorRecovery),t.source!==void 0&&(y.source=t.source),await e.pointAtElement(p,y),chrome.runtime.sendMessage({type:"STEP_COMPLETE",stepIndex:a}).catch(()=>{}),C(p,c,a)}function C(a,c,p){var T;const m=a.tagName.toLowerCase(),w=(T=a.type)==null?void 0:T.toLowerCase(),v=m==="input"&&w!=="submit"&&w!=="button"&&w!=="checkbox"&&w!=="radio"||m==="textarea",y=()=>{!o||n!==p||setTimeout(()=>{!o||n!==p||b()},350)};if(v||c.action==="focus"){const f=R=>{R.key==="Enter"&&y()},M=()=>y();a.addEventListener("keydown",f),a.addEventListener("change",M),s=()=>{a.removeEventListener("keydown",f),a.removeEventListener("change",M)}}else{const f=()=>y();a.addEventListener("click",f,{capture:!0,once:!0}),s=()=>{a.removeEventListener("click",f,{capture:!0})}}}function S(a){try{const c=document.querySelectorAll(a.targetSelector);for(const p of c)if(k(p))return p}catch{}if(a.fallbackLabel){const c=a.fallbackLabel.toLowerCase().trim();if(c.length>=2){const p=document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="link"]');for(const m of p){if(m.closest("#pointwise-host")||!k(m))continue;if([m.getAttribute("aria-label"),m.getAttribute("placeholder"),m.getAttribute("title"),m.textContent].filter(Boolean).join(" ").toLowerCase().includes(c))return m}}}return null}function k(a){const c=window.getComputedStyle(a);if(c.display==="none"||c.visibility==="hidden")return!1;const p=a.getBoundingClientRect();return p.width>0&&p.height>0}function L(a){return{captcha:"CAPTCHA detected — please complete it yourself.",otp:"OTP or verification code required — please enter it yourself.",payment:"Payment field detected — please enter your details yourself.",legal:"Legal declaration or agreement — please read and check it yourself."}[a]??"Sensitive step detected — PointWise has stepped back."}function z(a){var T;const c=a.accept;if(!c)return null;const p=c.split(",").map(f=>f.trim()).filter(f=>f.includes("/")),w=(((T=a.closest("form, section, div"))==null?void 0:T.textContent)??"").match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB)/i);let v;if(w&&w[1]&&w[2]){const f=parseFloat(w[1]),M=w[2].toUpperCase();v=M==="KB"?f*1024:M==="MB"?f*1024**2:f*1024**3}const y={allowedMimes:p};return v!==void 0&&(y.maxBytes=v),y}}
