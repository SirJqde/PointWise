var W=Object.defineProperty;var X=(i,t,s)=>t in i?W(i,t,{enumerable:!0,configurable:!0,writable:!0,value:s}):i[t]=s;var u=(i,t,s)=>X(i,typeof t!="symbol"?t+"":t,s);const F=[/password/i,/passcode/i,/pin\b/i,/credit.?card/i,/card.?number/i,/cvv|cvc|csc/i,/expir/i,/otp/i,/one.?time/i,/verification.?code/i,/aadhaar|aadhar/i,/pan.?number/i,/ssn|social.?security/i,/passport.?number/i,/date.?of.?birth|dob\b/i],G=[/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,/(\+?\d[\s\-]?){9,13}/g,/\b\d{4}\s?\d{4}\s?\d{4}\b/g,/\b[A-Z]{5}\d{4}[A-Z]\b/g,/\b\d{3}-\d{2}-\d{4}\b/g],U="[REDACTED]";function V(i,t){const s=`${i} ${t??""}`;return F.some(e=>e.test(s))}function D(i){let t=i;for(const s of G)t=t.replace(s,U);return t.length>120?t.slice(0,120)+"…":t}const Y=100;function $(){const i=[],t=new Set,s=window.innerHeight||800,e=window.innerWidth||1280;document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="link"], [role="textbox"], [role="combobox"], [role="searchbox"], [role="menuitem"], [role="tab"], [tabindex]').forEach(r=>{var S;if(r.closest("#pointwise-host")||!j(r))return;const n=r.getBoundingClientRect();if(n.width<2||n.height<2)return;const a=Z(r),d=r.name??"",f=(S=r.type)==null?void 0:S.toLowerCase();if(V(a,d)||f==="password"||f==="hidden")return;const g=r.tagName.toLowerCase();if(!a&&g!=="input"&&g!=="select"&&g!=="textarea")return;const x=Q(r);if(!x||t.has(x))return;t.add(x);const b=n.bottom>=0&&n.right>=0&&n.top<=s&&n.left<=e,k=g==="input"||g==="button"||g==="select"||g==="textarea"||r.getAttribute("role")==="button",L=(b?10:0)+(k?5:0),M={selector:x,role:r.getAttribute("role")??g,label:D(a),tagName:g,rect:{x:Math.round(n.x),y:Math.round(n.y),width:Math.round(n.width),height:Math.round(n.height)},visible:!0,inViewport:b,disabled:r.disabled??!1,_priority:L};g==="input"&&f&&(M.inputType=f),f==="file"&&(M.hasFileInput=!0),i.push(M)}),i.sort((r,n)=>n._priority-r._priority);const o=i.slice(0,Y).map(({_priority:r,...n})=>n);return{url:location.href,title:D(document.title),elements:o}}function j(i){if(i.getAttribute("aria-hidden")==="true")return!1;const t=window.getComputedStyle(i);return t.display!=="none"&&t.visibility!=="hidden"&&parseFloat(t.opacity||"1")>.05}function Z(i){var e,o,r,n;const t=i.id,s=t?(e=document.querySelector(`label[for="${CSS.escape(t)}"]`))==null?void 0:e.textContent:void 0;return i.getAttribute("aria-label")??i.getAttribute("placeholder")??(s==null?void 0:s.trim())??i.getAttribute("title")??((r=(o=i.value)==null?void 0:o.trim)==null?void 0:r.call(o))??((n=i.textContent)==null?void 0:n.replace(/\s+/g," ").trim().slice(0,80))??""}function A(i){try{return document.querySelectorAll(i).length===1}catch{return!1}}function K(i,t){const s=t.replace(/\\/g,"\\\\").replace(/"/g,'\\"');return`[${i}="${s}"]`}function Q(i){if(i.id){const t=`#${CSS.escape(i.id)}`;if(A(t))return t}for(const t of["data-testid","aria-label","name","placeholder"]){const s=i.getAttribute(t);if(s&&s.length<80){const e=`${i.tagName.toLowerCase()}${K(t,s)}`;if(A(e))return e}}return J(i)}function J(i){const t=[];let s=i;for(;s&&s.tagName.toLowerCase()!=="html";){if(s.id){const d=`#${CSS.escape(s.id)}`;if(A(d)){t.unshift(d);break}}const e=s.parentElement,o=s.tagName.toLowerCase();if(!e){t.unshift(o);break}const r=s.tagName,n=Array.from(e.children).filter(d=>d.tagName===r),a=n.indexOf(s)+1;t.unshift(n.length>1?`${o}:nth-of-type(${a})`:o),s=e}return t.join(" > ")}const tt=[{class:"captcha",patterns:[/captcha/i,/challenge/i,/prove.*human/i],iframeSrcPatterns:[/recaptcha/i,/hcaptcha\.com/i,/turnstile\.cloudflare\.com/i,/altcha\.org/i]},{class:"otp",patterns:[/one.?time/i,/\botp\b/i,/verification.?code/i,/auth.*code/i]},{class:"payment",patterns:[/credit.?card/i,/card.?number/i,/cvv|cvc/i,/upi\b/i,/pay now/i],iframeSrcPatterns:[/stripe\.com/i,/razorpay\.com/i,/braintreegateway\.com/i,/paypal\.com/i,/payu\./i]},{class:"legal",patterns:[/i agree/i,/terms.*condition/i,/declaration/i,/i hereby/i,/consent/i]}];function et(i,t,s=[]){var o;const e=`${i} ${t}`.toLowerCase();for(const r of tt){const n=r.patterns.some(d=>d.test(e)),a=((o=r.iframeSrcPatterns)==null?void 0:o.some(d=>s.some(f=>d.test(f))))??!1;if(n||a)return r.class}return"normal"}class it{constructor(){u(this,"shadow");u(this,"cursor");u(this,"cursorDialogue");u(this,"card");u(this,"miniDock");u(this,"highlight");u(this,"tag");u(this,"state","idle");u(this,"currentTarget",null);u(this,"hasPlacedCursor",!1);u(this,"resizeObserver");u(this,"scrollRafId",null);u(this,"userMouseX");u(this,"userMouseY");u(this,"confirmHandlers",[]);u(this,"cancelHandlers",[]);u(this,"nextHandlers",[]);u(this,"rescanHandlers",[]);u(this,"dismissHandlers",[]);u(this,"contextHandlers",[]);u(this,"boundSyncPosition");u(this,"boundMouseTrack");var s;(s=document.getElementById("pointwise-host"))==null||s.remove(),this.userMouseX=Math.round((window.innerWidth||1e3)*.5),this.userMouseY=Math.round((window.innerHeight||700)*.35);const t=document.createElement("div");t.setAttribute("id","pointwise-host"),t.style.cssText="all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;",document.body.appendChild(t),this.shadow=t.attachShadow({mode:"closed"}),this.shadow.innerHTML=st,this.cursor=this.shadow.querySelector("#pw-cursor"),this.cursorDialogue=this.shadow.querySelector("#pw-cursor-dialogue"),this.card=this.shadow.querySelector("#pw-card"),this.miniDock=this.shadow.querySelector("#pw-mini-dock"),this.highlight=this.shadow.querySelector("#pw-highlight"),this.tag=this.shadow.querySelector("#pw-tag"),this.boundSyncPosition=()=>this.syncPosition(),this.boundMouseTrack=e=>this.handleMouseTrack(e),window.addEventListener("scroll",this.boundSyncPosition,{capture:!0,passive:!0}),window.addEventListener("resize",this.boundSyncPosition,{passive:!0}),document.addEventListener("mousemove",this.boundMouseTrack,{capture:!0,passive:!0}),document.addEventListener("mousedown",this.boundMouseTrack,{capture:!0,passive:!0}),this.resizeObserver=new ResizeObserver(()=>this.syncPosition()),this.card.addEventListener("click",e=>{const o=e.target.closest("[data-pw-action]");if(!o)return;e.stopPropagation();const r=o.dataset.pwAction;if(r==="confirm")this.userMouseX=e.clientX,this.userMouseY=e.clientY,this.card.style.display="none",this.confirmHandlers.forEach(n=>n());else if(r==="cancel")this.withdraw(),this.cancelHandlers.forEach(n=>n());else if(r==="rescan")this.rescanHandlers.forEach(n=>n());else if(r==="dismiss")this.withdraw(),this.dismissHandlers.forEach(n=>n());else if(r==="next")this.card.style.display="none",this.nextHandlers.forEach(n=>n());else if(r==="submit-context"){const n=this.card.querySelector("#pw-inline-context"),a=(n==null?void 0:n.value.trim())??"";this.contextHandlers.forEach(d=>d(a))}}),this.card.addEventListener("keydown",e=>{if(e.key==="Enter"){const o=e.target.closest("#pw-inline-context");o&&(e.preventDefault(),this.contextHandlers.forEach(r=>r(o.value.trim())))}}),this.miniDock.addEventListener("click",e=>{const o=e.target.closest("[data-pw-action]");if(!o)return;e.stopPropagation();const r=o.dataset.pwAction;r==="next"&&this.nextHandlers.forEach(n=>n()),r==="rescan"&&this.rescanHandlers.forEach(n=>n()),r==="dismiss"&&(this.withdraw(),this.dismissHandlers.forEach(n=>n()))})}onConfirm(t){this.confirmHandlers.push(t)}onCancel(t){this.cancelHandlers.push(t)}onNext(t){this.nextHandlers.push(t)}onRescan(t){this.rescanHandlers.push(t)}onDismiss(t){this.dismissHandlers.push(t)}onContextSubmit(t){this.contextHandlers.push(t)}showScanning(){this.clearTargetVisuals(),this.card.style.display="none",this.miniDock.style.display="none",this.state="scanning",this.cursorDialogue.innerHTML=`
      <div class="pw-cd-head">
        <span class="pw-brand">⬡ POINTWISE</span>
        <span class="pw-pill">ANALYSING</span>
      </div>
      <div class="pw-scanning">
        <span class="pw-scan-dot"></span>
        Preparing AI plan…
      </div>
    `,this.cursorDialogue.style.display="block",this.positionCursorDialogue(this.userMouseX,this.userMouseY)}showContextWaiting(t,s){this.clearTargetVisuals(),this.cursorDialogue.style.display="none",this.miniDock.style.display="none",this.state="context",s?this.card.innerHTML=`
        <div class="pw-head">
          <span class="pw-brand">⬡ POINTWISE</span>
          <span class="pw-pill">CONTEXT NEEDED</span>
        </div>
        <div class="pw-hint">Please answer the follow-up question in the PointWise popup:</div>
        <div class="pw-subnote">${E(t)}</div>
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
      `,this.card.style.display="block",this.positionCardAtCursor(),s||setTimeout(()=>{var e;(e=this.card.querySelector("#pw-inline-context"))==null||e.focus()},30)}showPlanConfirmation(t){this.clearTargetVisuals(),this.cursorDialogue.style.display="none",this.miniDock.style.display="none",this.state="confirm";const s=t.steps.map((e,o)=>`
        <li class="pw-plan-item">
          <span class="pw-plan-num">${o+1}</span>
          <span class="pw-plan-text">${E(e.hint)}</span>
        </li>`).join("");this.card.innerHTML=`
      <div class="pw-head">
        <span class="pw-brand">⬡ POINTWISE</span>
        <span class="pw-pill">PLAN OF ACTION</span>
      </div>
      <div class="pw-plan-goal">${E(t.taskGoal||"Task Guidance")}</div>
      <ol class="pw-plan-list">${s}</ol>
      <div class="pw-confirm-ask">Confirm to highlight Step 1 and begin?</div>
      <div class="pw-actions">
        <button class="pw-btn pw-btn-primary" data-pw-action="confirm">Confirm &amp; Continue ▶</button>
        <button class="pw-btn" data-pw-action="cancel">Cancel</button>
      </div>
    `,this.card.style.display="block",this.positionCardAtCursor()}async pointAtElement(t,s){this.currentTarget&&this.resizeObserver.unobserve(this.currentTarget),this.currentTarget=t,this.resizeObserver.observe(t),this.card.style.display="none";const e=t.getBoundingClientRect(),o=e.top<40||e.bottom>window.innerHeight-40||e.left<0||e.right>window.innerWidth;o&&t.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"}),this.state="active",this.renderCursorDialogue(s),this.renderMiniDock(s),this.renderTargetVisuals(t,s),o&&this.startSmoothScrollTracking()}async pointAt(t,s){let e=null;try{e=document.querySelector(t)}catch{e=null}if(!e){this.showNotice(s.error??"Could not locate the expected element.",!0);return}await this.pointAtElement(e,s)}showNotice(t,s=!1,e=!1){this.clearTargetVisuals(),this.cursorDialogue.style.display="none",this.miniDock.style.display="none",this.state="idle",this.card.innerHTML=`
      <div class="pw-head">
        <span class="pw-brand">⬡ POINTWISE</span>
        <span class="pw-pill ${s?"pw-pill-err":""}">${s?"NOTICE":"DONE"}</span>
      </div>
      <div class="${s?"pw-error":"pw-hint"}">${E(t)}</div>
      <div class="pw-actions">
        <button class="pw-btn pw-btn-primary" data-pw-action="rescan">Re-scan ↻</button>
        ${e?'<button class="pw-btn" data-pw-action="next">Skip step</button>':""}
        <button class="pw-btn" data-pw-action="dismiss">Hide</button>
      </div>
    `,this.card.style.display="block",this.positionCardAtCursor()}showPauseBanner(t){this.clearTargetVisuals(),this.cursorDialogue.style.display="none",this.miniDock.style.display="none",this.state="paused",this.card.innerHTML=nt(t),this.card.style.display="block",this.positionCardAtCursor()}withdraw(){this.clearTargetVisuals(),this.cursorDialogue.style.display="none",this.card.style.display="none",this.miniDock.style.display="none",this.state="withdrawn"}destroy(){this.scrollRafId!==null&&cancelAnimationFrame(this.scrollRafId),this.resizeObserver.disconnect(),window.removeEventListener("scroll",this.boundSyncPosition,{capture:!0}),window.removeEventListener("resize",this.boundSyncPosition),document.removeEventListener("mousemove",this.boundMouseTrack,{capture:!0}),document.removeEventListener("mousedown",this.boundMouseTrack,{capture:!0}),this.shadow.host.remove()}clearTargetVisuals(){this.currentTarget&&(this.resizeObserver.unobserve(this.currentTarget),this.currentTarget=null),this.cursor.style.display="none",this.highlight.style.display="none",this.tag.style.display="none"}renderTargetVisuals(t,s){const e=t.getBoundingClientRect();if(e.width<=0||e.height<=0)return;const o=5,r=Math.max(2,e.left-o),n=Math.max(2,e.top-o),a=e.width+o*2,d=e.height+o*2;if(this.highlight.style.left=`${r}px`,this.highlight.style.top=`${n}px`,this.highlight.style.width=`${a}px`,this.highlight.style.height=`${d}px`,this.highlight.style.display="block",s){const b=(s.stepIndex??0)+1,k=P(s.action);this.tag.textContent=`STEP ${b} • ${k}`}const f=n>28?n-24:n+d+6;this.tag.style.left=`${Math.min(r,Math.max(8,window.innerWidth-160))}px`,this.tag.style.top=`${f}px`,this.tag.style.display="block";const g=e.left+Math.min(e.width*.72,Math.max(e.width-14,e.width*.5)),x=e.top+Math.min(e.height*.68,Math.max(e.height-8,e.height*.5));this.moveGhostCursorTo(g,x)}moveGhostCursorTo(t,s){const e=Math.round(t-5),o=Math.round(s-3);if(!this.hasPlacedCursor){const r=Math.max(24,this.userMouseX),n=Math.max(24,this.userMouseY);this.cursor.style.display="block",this.cursor.style.transform=`translate(${r}px, ${n}px)`,this.cursor.style.opacity="0",this.cursor.getBoundingClientRect(),this.hasPlacedCursor=!0}this.cursor.style.display="block",this.cursor.style.opacity="1",this.cursor.style.transform=`translate(${e}px, ${o}px)`}renderCursorDialogue(t){const s=(t.stepIndex??0)+1,e=t.totalSteps??1,o=P(t.action);this.cursorDialogue.innerHTML=`
      <div class="pw-cd-head">
        <span class="pw-brand">⬡ POINTWISE</span>
        <span class="pw-pill">STEP ${s}/${e} · ${o}</span>
      </div>
      <div class="pw-cd-hint">${E(t.hint)}</div>
      <div class="pw-cd-sub">Act on the highlighted element to continue</div>
    `,this.cursorDialogue.style.display="block",this.positionCursorDialogue(this.userMouseX,this.userMouseY)}renderMiniDock(t){const s=(t.stepIndex??0)+1,e=t.totalSteps??1,o=s>=e;this.miniDock.innerHTML=`
      <span class="pw-dock-label">Step ${s}/${e}</span>
      <button class="pw-btn pw-btn-primary pw-btn-sm" data-pw-action="next">${o?"Done ↻":"Next →"}</button>
      <button class="pw-btn pw-btn-sm" data-pw-action="rescan">Re-scan</button>
      <button class="pw-btn pw-btn-sm" data-pw-action="dismiss">Hide</button>
    `,this.miniDock.style.display="flex"}positionCursorDialogue(t,s){const e=this.cursorDialogue.offsetWidth||268,o=this.cursorDialogue.offsetHeight||86,r=window.innerWidth||1280,n=window.innerHeight||800;let a=t+18,d=s+20;a+e+12>r&&(a=Math.max(8,t-e-14)),d+o+12>n&&(d=Math.max(8,s-o-14)),this.cursorDialogue.style.transform=`translate3d(${Math.round(a)}px, ${Math.round(d)}px, 0)`}positionCardAtCursor(){const t=this.card.offsetWidth||336,s=this.card.offsetHeight||220,e=window.innerWidth||1280,o=window.innerHeight||800;let r=this.userMouseX+16,n=this.userMouseY+16;r+t+16>e&&(r=Math.max(12,e-t-18)),n+s+16>o&&(n=Math.max(12,o-s-18)),this.card.style.left=`${Math.round(r)}px`,this.card.style.top=`${Math.round(n)}px`}handleMouseTrack(t){this.userMouseX=t.clientX,this.userMouseY=t.clientY,(this.state==="scanning"||this.state==="active")&&this.positionCursorDialogue(t.clientX,t.clientY)}syncPosition(){this.state!=="active"||!this.currentTarget||document.contains(this.currentTarget)&&this.renderTargetVisuals(this.currentTarget)}startSmoothScrollTracking(){this.scrollRafId!==null&&cancelAnimationFrame(this.scrollRafId);const t=performance.now(),s=()=>{this.syncPosition(),performance.now()-t<650&&this.state==="active"?this.scrollRafId=requestAnimationFrame(s):this.scrollRafId=null};this.scrollRafId=requestAnimationFrame(s)}}function P(i){return i==="focus"?"ENTER":i==="file-upload"?"UPLOAD":i==="scroll"?"SCROLL":"CLICK"}const st=`
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
    filter: drop-shadow(0 0 6px rgba(212, 38, 126, 0.55)) drop-shadow(0 2px 4px rgba(7, 11, 26, 0.65));
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
    border: 2px solid #d4267e;
    background: rgba(212, 38, 126, 0.08);
    box-shadow:
      0 0 0 2px rgba(14, 22, 48, 0.5),
      0 0 12px 2px rgba(212, 38, 126, 0.42),
      inset 0 0 8px rgba(212, 38, 126, 0.1);
    animation: pw-ring-pulse 1.8s ease-in-out infinite;
  }
  @keyframes pw-ring-pulse {
    0%, 100% {
      box-shadow:
        0 0 0 2px rgba(14, 22, 48, 0.5),
        0 0 10px 1px rgba(212, 38, 126, 0.36),
        inset 0 0 8px rgba(212, 38, 126, 0.09);
    }
    50% {
      box-shadow:
        0 0 0 4px rgba(212, 38, 126, 0.16),
        0 0 18px 3px rgba(212, 38, 126, 0.58),
        inset 0 0 12px rgba(212, 38, 126, 0.14);
    }
  }

  /* ── Floating Step Tag over Target Element ────────────────── */
  #pw-tag {
    position: fixed;
    pointer-events: none;
    z-index: 2147483645;
    display: none;
    background: linear-gradient(135deg, #d4267e, #a81c62);
    color: #f4f7fc;
    font: 700 10px/1.2 system-ui, -apple-system, sans-serif;
    letter-spacing: 0.08em;
    padding: 4px 8px;
    border-radius: 5px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    box-shadow: 0 2px 8px rgba(212, 38, 126, 0.35);
    white-space: nowrap;
  }

  /* ── Cursor-Attached Action Dialogue Box ──────────────────── */
  #pw-cursor-dialogue {
    position: fixed;
    top: 0; left: 0;
    width: 268px;
    max-width: calc(100vw - 24px);
    background: linear-gradient(165deg, rgba(16, 24, 52, 0.96) 0%, rgba(10, 15, 33, 0.97) 100%);
    border: 1.5px solid rgba(212, 38, 126, 0.78);
    border-radius: 10px;
    padding: 10px 12px;
    font: 12.5px/1.45 system-ui, -apple-system, sans-serif;
    color: #e4eaf7;
    box-shadow:
      0 0 14px rgba(212, 38, 126, 0.24),
      0 8px 22px rgba(6, 10, 24, 0.75);
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
    border-bottom: 1px solid rgba(212, 38, 126, 0.22);
  }
  .pw-cd-hint {
    font-size: 12.5px;
    font-weight: 600;
    color: #edf1fb;
    line-height: 1.4;
  }
  .pw-cd-sub {
    margin-top: 5px;
    font-size: 10.5px;
    color: #8b9bc0;
  }

  /* ── Anchored Plan / Context Card (interactive) ───────────── */
  #pw-card {
    position: fixed;
    top: 80px; left: 80px;
    width: 336px;
    max-width: calc(100vw - 24px);
    background: linear-gradient(165deg, #111a36 0%, #0a0f21 100%);
    border: 1.5px solid rgba(212, 38, 126, 0.78);
    border-radius: 12px;
    padding: 13px 15px;
    font: 13px/1.5 system-ui, -apple-system, sans-serif;
    color: #e4eaf7;
    box-shadow:
      0 0 16px rgba(212, 38, 126, 0.24),
      0 12px 30px rgba(6, 10, 24, 0.85);
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
    background: rgba(14, 21, 44, 0.94);
    border: 1px solid #2c3d70;
    border-radius: 10px;
    padding: 6px 8px;
    box-shadow: 0 4px 16px rgba(6, 10, 24, 0.7);
    z-index: 2147483646;
    pointer-events: auto;
    font: 11px/1 system-ui, -apple-system, sans-serif;
  }
  .pw-dock-label {
    color: #ea78b2;
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
    border-bottom: 1px solid rgba(212, 38, 126, 0.22);
  }
  .pw-brand {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.11em;
    color: #ea78b2;
  }
  .pw-pill {
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: #c5d1f0;
    background: #172245;
    border: 1px solid #2c3d70;
    padding: 2px 7px;
    border-radius: 99px;
  }
  .pw-pill-err {
    color: #f6b8c4;
    background: rgba(229, 108, 130, 0.16);
    border-color: rgba(229, 108, 130, 0.45);
  }

  .pw-plan-goal {
    font-size: 11.5px;
    color: #8b9bc0;
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
    background: rgba(23, 34, 69, 0.78);
    border: 1px solid #273766;
    border-radius: 8px;
    padding: 7px 9px;
  }
  .pw-plan-num {
    width: 18px; height: 18px;
    border-radius: 50%;
    background: #d4267e;
    color: #f4f7fc;
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
    color: #e4eaf7;
  }
  .pw-confirm-ask {
    font-size: 11.5px;
    font-weight: 600;
    color: #ea78b2;
    margin-bottom: 2px;
  }

  .pw-hint {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
    color: #edf1fb;
  }
  .pw-subnote {
    margin-top: 6px;
    font-size: 11.5px;
    line-height: 1.4;
    color: #ea78b2;
  }
  .pw-error {
    margin-top: 6px;
    color: #f095a6;
    font-size: 12px;
    line-height: 1.45;
  }

  .pw-input {
    width: 100%;
    box-sizing: border-box;
    margin-top: 8px;
    background: #0d142b;
    border: 1.5px solid #2c3d70;
    border-radius: 8px;
    color: #e4eaf7;
    font: 12.5px/1.4 system-ui, -apple-system, sans-serif;
    padding: 8px 10px;
    outline: none;
  }
  .pw-input:focus {
    border-color: #d4267e;
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
    border: 1px solid #2c3d70;
    background: #172245;
    color: #cbd5ea;
    transition: all 140ms ease;
  }
  .pw-btn:hover {
    border-color: #d4267e;
    color: #edf1fb;
  }
  .pw-btn-sm {
    padding: 6px 8px;
    font-size: 10.5px;
  }
  .pw-btn-primary {
    flex: 1;
    background: linear-gradient(135deg, #d4267e, #b01d67);
    border-color: #d4267e;
    color: #f4f7fc;
    font-weight: 700;
    box-shadow: 0 0 8px rgba(212, 38, 126, 0.28);
  }
  .pw-btn-primary:hover {
    background: linear-gradient(135deg, #e03e8f, #c22575);
    border-color: #e03e8f;
  }

  .pw-scanning {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #ea78b2;
    font-weight: 600;
  }
  .pw-scan-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #d4267e;
    box-shadow: 0 0 6px rgba(212, 38, 126, 0.6);
    animation: pw-scan-blink 1s ease infinite;
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
  .pw-pause-body { font-size: 12.5px; line-height: 1.5; color: #dce3f2; }
  .pw-pause-title {
    color: #ea78b2;
    font-weight: 700;
    font-size: 11px;
    letter-spacing: .06em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
</style>

<!-- Ghost cursor SVG (Deep Navy + Refined Magenta pointer, tip at 5,3) -->
<svg id="pw-cursor" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M5 3L27 14.5L15.8 17.2L10.5 28L5 3Z" fill="rgba(212, 38, 126, 0.2)"/>
  <path d="M5 3L25.5 14L15.3 16.5L10.5 26.5L5 3Z" fill="#0d142b" stroke="#d4267e" stroke-width="2" stroke-linejoin="round"/>
  <path d="M8.5 7.5L20.5 14L14.2 15.8L11 22.5L8.5 7.5Z" fill="#d4267e" fill-opacity="0.45"/>
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
`;function nt(i){return`
  <div class="pw-head">
    <span class="pw-brand">⬡ POINTWISE</span>
    <span class="pw-pill pw-pill-err">PAUSED</span>
  </div>
  <div class="pw-pause">
    <span class="pw-pause-icon">🔒</span>
    <div class="pw-pause-body">
      <div class="pw-pause-title">Sensitive Step Detected</div>
      ${E(i)}<br>
      <small style="color:#93a1c2;font-size:11px">PointWise stepped back. Resume when ready.</small>
    </div>
  </div>
  <div class="pw-actions">
    <button class="pw-btn pw-btn-primary" data-pw-action="next">Continue Next →</button>
    <button class="pw-btn" data-pw-action="rescan">Re-scan</button>
  </div>`}function E(i){return i.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}const ot={"image/jpeg":[[255,216,255]],"image/png":[[137,80,78,71]],"image/gif":[[71,73,70,56]],"image/webp":[[82,73,70,70]],"application/pdf":[[37,80,68,70]],"application/zip":[[80,75,3,4]]};async function rt(i,t,s=!1){const e=[],o={ok:!1,sizeBytes:i.size,errors:e},r=await ct(i,8),n=lt(r);if(o.actualMime=n??i.type,n&&!t.allowedMimes.includes(n)&&e.push(`File format not accepted. Detected: ${n}. Allowed: ${t.allowedMimes.join(", ")}.`),t.maxBytes&&i.size>t.maxBytes&&e.push(`File too large: ${N(i.size)}. Maximum: ${N(t.maxBytes)}.`),n!=null&&n.startsWith("image/")&&(t.maxWidth||t.maxHeight)){const a=await R(i);o.width=a.width,o.height=a.height;const d=t.maxWidth&&a.width>t.maxWidth,f=t.maxHeight&&a.height>t.maxHeight;if(d||f){if(s){const g=t.maxWidth??a.width,x=t.maxHeight??a.height,b=await dt(i,g,x);if(b)return o.resizedBlob=b,o.ok=e.length===0,o}e.push(`Image too large: ${a.width}×${a.height}px. Maximum: ${t.maxWidth??"∞"}×${t.maxHeight??"∞"}px.`)}}return o.ok=e.length===0,o}function at(i,t){function s(o){o.addEventListener("change",async()=>{var d;const r=(d=o.files)==null?void 0:d[0];if(!r)return;const n=i(o);if(!n)return;const a=await rt(r,n,!0);t(o,a)})}document.querySelectorAll("input[type=file]").forEach(s);const e=new MutationObserver(o=>{for(const r of o)r.addedNodes.forEach(n=>{n instanceof HTMLInputElement&&n.type==="file"&&s(n),n instanceof HTMLElement&&n.querySelectorAll("input[type=file]").forEach(s)})});return e.observe(document.body,{childList:!0,subtree:!0}),()=>e.disconnect()}async function ct(i,t){const e=await i.slice(0,t).arrayBuffer();return new Uint8Array(e)}function lt(i){for(const[t,s]of Object.entries(ot))for(const e of s)if(e.every((o,r)=>i[r]===o))return t;return null}async function R(i){return new Promise((t,s)=>{const e=URL.createObjectURL(i),o=new Image;o.onload=()=>{URL.revokeObjectURL(e),t({width:o.naturalWidth,height:o.naturalHeight})},o.onerror=()=>{URL.revokeObjectURL(e),s(new Error("Could not decode image"))},o.src=e})}async function dt(i,t,s){try{const e=await R(i),o=Math.min(t/e.width,s/e.height,1),r=Math.round(e.width*o),n=Math.round(e.height*o),a=new OffscreenCanvas(r,n),d=a.getContext("2d"),f=await createImageBitmap(i);return d.drawImage(f,0,0,r,n),f.close(),await a.convertToBlob({type:i.type,quality:.92})}catch{return}}function N(i){return i<1024?`${i} B`:i<1024**2?`${(i/1024).toFixed(1)} KB`:`${(i/1024**2).toFixed(1)} MB`}const z="__pointwiseContentInitialized";globalThis[z]||(globalThis[z]=!0,pt());function pt(){let i=null,t=null,s=0,e,o;function r(c=e){return c!==void 0&&c===e&&location.href===o}let n=null,a=null,d;chrome.runtime.onMessage.addListener((c,l,p)=>{switch(c.type){case"PING":return p({ok:!0}),!1;case"GUIDANCE_START":return location.href!==c.pageUrl||(k(),e=c.requestId,o=c.pageUrl,f(()=>{r(c.requestId)&&g()}),p({ok:!0})),!1;case"TOGGLE_OFF":return k(),p({ok:!0}),!1;case"COLLECT_SNAPSHOT":return r(c.requestId)?(x().then(h=>p({snapshot:r(c.requestId)?h:null})).catch(()=>p({snapshot:null})),!0):(p({snapshot:null}),!1);case"CONTEXT_REQUIRED":return!r(c.requestId)||!i||(i.showContextWaiting(c.question,c.popupOpened),p({ok:!0})),!1;case"PLAN_READY":return!r(c.requestId)||!i||(t=c.plan,s=0,i.showPlanConfirmation(c.plan),p({ok:!0})),!1;case"PLAN_ERROR":return!r(c.requestId)||!i||(i.showNotice(c.message,!0),p({ok:!0})),!1;default:return!1}});function f(c){document.body&&document.readyState!=="loading"?c():document.addEventListener("DOMContentLoaded",c,{once:!0})}function g(){if(!(!r()||!document.body)){if(i||(i=new it,i.onConfirm(()=>{!r()||!t||(s=0,M(0))}),i.onCancel(()=>{a==null||a(),a=null}),i.onContextSubmit(c=>{!e||!r()||chrome.runtime.sendMessage({type:"CONTEXT_SUBMITTED",answer:c,requestId:e}).catch(()=>{})}),i.onNext(()=>L()),i.onRescan(()=>b()),i.onDismiss(()=>{a==null||a(),a=null})),!n){const c=e;n=at(B,(l,p)=>{if(!r(c))return;const h=l.id?`#${CSS.escape(l.id)}`:"input[type=file]";p.ok?i==null||i.pointAt(h,{hint:"✅ File validated locally — safe to submit."}):i==null||i.pointAt(h,{hint:"⚠️ File issue detected before upload",error:p.errors.join(" ")})})}i.showScanning()}}function x(){return new Promise(c=>{f(()=>{const l=$();if(l.elements.length>=3){c(l);return}setTimeout(()=>{c($())},550)})})}function b(){!e||!r()||!i||(clearTimeout(d),d=void 0,a==null||a(),a=null,chrome.runtime.sendMessage({type:"RESCAN",requestId:e}).catch(()=>{}))}function k(){clearTimeout(d),d=void 0,e=void 0,o=void 0,a==null||a(),a=null,n==null||n(),n=null,i==null||i.destroy(),i=null,t=null,s=0}function L(c=0){if(!e||!r()||!i||d!==void 0)return;if(!(t!=null&&t.steps[s])){b();return}chrome.runtime.sendMessage({type:"STEP_COMPLETE",requestId:e,stepIndex:s}).catch(()=>{}),a==null||a(),a=null;const l=++s,p=e,h=()=>{d=void 0,!(!r(p)||s!==l)&&(t!=null&&t.steps[l]?M(l):b())};c?d=setTimeout(h,c):h()}function M(c){var v;if(!t||!i||!r())return;a==null||a(),a=null;const l=t.steps[c];if(!l){i.showNotice("✅ All visible steps complete! Click Re-scan if the page updated.");return}const p=O(l);if(!p){i.showNotice(l.errorRecovery??"Target element is not visible right now. Try Re-scan.",!0,!0);return}const h=Array.from(document.querySelectorAll("iframe")).map(m=>m.src).filter(Boolean),w=((v=p.parentElement)==null?void 0:v.textContent)??"",y=et(`${l.hint} ${p.textContent??""}`,w,h);if(y!=="normal"||l.sensitivityClass!=="normal"){const m=y!=="normal"?y:l.sensitivityClass;i.showPauseBanner(q(m));return}if(l.action==="pause"){i.showPauseBanner(l.hint);return}const C={hint:l.hint,stepIndex:c,totalSteps:t.steps.length,action:l.action};l.errorRecovery!==void 0&&(C.error=l.errorRecovery),i.pointAtElement(p,C),S(p,l,c)}function S(c,l,p){var m;const h=c.tagName.toLowerCase(),w=(m=c.type)==null?void 0:m.toLowerCase(),y=h==="input"&&w!=="submit"&&w!=="button"&&w!=="checkbox"&&w!=="radio"||h==="textarea",C=e,v=()=>{!r(C)||s!==p||L(350)};if(y||l.action==="focus"){const T=_=>{_.key==="Enter"&&v()},H=()=>v();c.addEventListener("keydown",T),c.addEventListener("change",H),a=()=>{c.removeEventListener("keydown",T),c.removeEventListener("change",H)}}else{const T=()=>v();c.addEventListener("click",T,{capture:!0,once:!0}),a=()=>{c.removeEventListener("click",T,{capture:!0})}}}function O(c){try{const l=document.querySelectorAll(c.targetSelector);for(const p of l)if(I(p))return p}catch{}if(c.fallbackLabel){const l=c.fallbackLabel.toLowerCase().trim();if(l.length>=2){const p=document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="link"]');for(const h of p){if(h.closest("#pointwise-host")||!I(h))continue;if([h.getAttribute("aria-label"),h.getAttribute("placeholder"),h.getAttribute("title"),h.textContent].filter(Boolean).join(" ").toLowerCase().includes(l))return h}}}return null}function I(c){const l=window.getComputedStyle(c);if(l.display==="none"||l.visibility==="hidden")return!1;const p=c.getBoundingClientRect();return p.width>0&&p.height>0}function q(c){return{captcha:"CAPTCHA detected — please complete it yourself.",otp:"OTP or verification code required — please enter it yourself.",payment:"Payment field detected — please enter your details yourself.",legal:"Legal declaration or agreement — please read and check it yourself."}[c]??"Sensitive step detected — PointWise has stepped back."}function B(c){var v;const l=c.accept;if(!l)return null;const p=l.split(",").map(m=>m.trim()).filter(m=>m.includes("/")),w=(((v=c.closest("form, section, div"))==null?void 0:v.textContent)??"").match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB)/i);let y;if(w&&w[1]&&w[2]){const m=parseFloat(w[1]),T=w[2].toUpperCase();y=T==="KB"?m*1024:T==="MB"?m*1024**2:m*1024**3}const C={allowedMimes:p};return y!==void 0&&(C.maxBytes=y),C}}
