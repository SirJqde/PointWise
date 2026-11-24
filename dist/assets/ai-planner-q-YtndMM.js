const x=["gemini-2.5-flash","gemini-2.0-flash"];async function I(){var o;return typeof chrome>"u"||!((o=chrome.storage)!=null&&o.local)?"":new Promise(s=>{chrome.storage.local.get("gc_api_key",t=>{s((t.gc_api_key??"").trim())})})}async function R(o,s,t){var n,u,m,y,b;const r=typeof t=="string"?{apiKeyOverride:t}:t??{},i=r.apiKeyOverride??await I(),a=!!r.contextProvided;if(!i){if(!a){const p=$(o,s);if(!p.sufficient&&p.question)return{taskGoal:s,steps:[],source:"local",needsContext:!0,clarifyingQuestion:p.question}}return d(o,s)}const f=P(o,s,a);let e="Unknown Gemini API error";for(const p of x){const v=`https://generativelanguage.googleapis.com/v1beta/models/${p}:generateContent`;try{const l=await fetch(`${v}?key=${encodeURIComponent(i)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:f}]}],generationConfig:{responseMimeType:"application/json",maxOutputTokens:1024,temperature:.2}}),signal:AbortSignal.timeout(12e3)});if(l.status===404){e=`Model ${p} unavailable (404)`;continue}if(!l.ok){const T=await l.text().catch(()=>"");throw new Error(`Gemini API ${l.status}: ${T.slice(0,120)}`)}const h=await l.json(),S=(((b=(y=(m=(u=(n=h==null?void 0:h.candidates)==null?void 0:n[0])==null?void 0:u.content)==null?void 0:m.parts)==null?void 0:y[0])==null?void 0:b.text)??"{}").replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/i,"").trim(),g=JSON.parse(S);if(!a&&g.sufficient===!1&&typeof g.clarifyingQuestion=="string"&&g.clarifyingQuestion.trim())return{taskGoal:s,steps:[],source:"ai",needsContext:!0,clarifyingQuestion:g.clarifyingQuestion.trim()};const w=N(g.steps??[],o.elements);return w.length>0?{taskGoal:s,steps:w,source:"ai"}:{...d(o,s),warning:"AI returned no actionable elements; showing closest interactive element."}}catch(l){e=l instanceof Error?l.message:String(l)}}return{...d(o,s),warning:`AI unavailable (${e}). Showing local guidance.`}}function N(o,s){return o.filter(t=>t&&typeof t.targetSelector=="string"&&t.targetSelector.trim()&&t.hint).slice(0,4).map(t=>{const r=s.find(f=>f.selector===t.targetSelector),i={targetSelector:t.targetSelector.trim(),action:t.action||"click",hint:t.hint.slice(0,140),sensitivityClass:t.sensitivityClass||"normal"},a=t.fallbackLabel??(r==null?void 0:r.label);return a!==void 0&&(i.fallbackLabel=a),t.errorRecovery!==void 0&&(i.errorRecovery=t.errorRecovery),i})}const k=new Set(["a","an","the","to","for","my","on","in","of","and","me","with","this","page","guide","through","website","site","want","need"]),C=new Set(["book","buy","order","shop","search","find","ticket","tickets","bus","train","flight","hotel","food","help","open","do","something","apply","check","pay","get","make","go","visit"]);function $(o,s){const t=s.toLowerCase().trim();if(!t)return{sufficient:!1,question:"What specific task or item would you like PointWise to help you with on this page?"};const r=t.replace(/[^\w\s]/g," ").split(/\s+/).filter(n=>n.length>1&&!k.has(n)),i=r.filter(n=>!C.has(n)),a=/\bpass\b/i.test(t),f=!a&&(/\b(ticket|tickets|irctc|redbus|makemytrip|flight|train)\b/i.test(t)||/\bbook\b/i.test(t)&&/\b(bus|train|flight|trip)\b/i.test(t)),e=/\b(from|to)\b/i.test(t)&&i.length>=2;return f&&!e&&i.length<2?{sufficient:!1,question:"Where are you travelling from, where to, and on what date?"}:a&&!/\b(student|monthly|daily|senior|citizen|general|renew|new)\b/i.test(t)?{sufficient:!1,question:"Which pass type are you applying for (e.g. Student, Monthly, General, or Renewal)?"}:/\b(amazon|flipkart|meesho|swiggy|zomato|bigbasket|buy|shop|order)\b/i.test(t)&&i.length<2&&(o.elements.some(u=>u.tagName==="input"&&/search|query|find/i.test(`${u.label} ${u.inputType??""}`))||r.length<=3)?{sufficient:!1,question:"What specific product, item, or dish are you looking for?"}:r.length<=2&&i.length<=1?{sufficient:!1,question:"Can you share a few more details about what you want to do on this site?"}:{sufficient:!0}}function d(o,s){const t=s.toLowerCase().replace(/[^\w\s]/g," ").split(/\s+/).filter(e=>e.length>1&&!k.has(e)),i=o.elements.filter(e=>e.visible&&!e.disabled).map(e=>{const c=e.label.toLowerCase();let n=0;e.inViewport&&(n+=8);for(const u of t)c.includes(u)&&(n+=15);return e.tagName==="input"&&(e.inputType==="search"||e.inputType==="text"||!e.inputType)&&(n+=10,/search|from|origin|source|find|query|destination|to|enter/i.test(c)&&(n+=12)),(e.tagName==="button"||e.role==="button"||e.inputType==="submit")&&(n+=7,/search|book|continue|next|apply|submit|login|sign in|get started/i.test(c)&&(n+=9)),e.tagName==="select"&&(n+=6),{el:e,score:n}}).sort((e,c)=>c.score-e.score),a=[];for(const e of i){if(a.length>=3)break;(e.el.label||a.length===0)&&a.push(e.el)}const f=a.map(e=>{const c=e.tagName==="input"&&e.inputType!=="submit"&&e.inputType!=="button"&&e.inputType!=="checkbox"&&e.inputType!=="radio",n=e.label?`"${e.label.slice(0,45)}"`:`the ${e.tagName}`;return{targetSelector:e.selector,fallbackLabel:e.label,action:e.hasFileInput?"file-upload":c?"focus":"click",hint:c?`Enter details in ${n}`:`Click ${n} to continue`,sensitivityClass:"normal"}});return{taskGoal:s,steps:f,source:"local",warning:"Local match — add your Gemini API key (⚙) for full AI guidance."}}function P(o,s,t=!1){const r=o.elements.map(i=>({selector:i.selector,role:i.role,label:i.label,tagName:i.tagName,type:i.inputType,inViewport:i.inViewport,disabled:i.disabled,hasFileInput:i.hasFileInput}));return`
You are PointWise, a step-by-step web navigation assistant.
The user's goal is: "${s||"Help the user complete the main action on this page"}".
Extra context already provided by user: ${t?"YES (do NOT ask another clarifying question; set sufficient=true)":"NO"}.

Current page: ${o.url}
Page title: ${o.title}
Visible interactive elements:
${JSON.stringify(r,null,2)}

First decide if the user's goal has sufficient details to give a helpful step-by-step plan on this page.
- If extra context is already YES, you MUST set "sufficient": true.
- Only set "sufficient": false if the goal is too vague or missing key details (e.g. "book bus ticket" without cities/date, or "buy on amazon" without what product).

Return ONLY a JSON object with this exact shape:
{
  "sufficient": true | false,
  "clarifyingQuestion": "<one concise question to ask the user if sufficient is false, otherwise omit or empty>",
  "steps": [
    {
      "targetSelector": "<exact selector copied verbatim from the elements list above>",
      "fallbackLabel": "<exact label from that element>",
      "action": "click" | "focus" | "scroll" | "file-upload" | "pause",
      "hint": "<clear, friendly instruction telling the user what to do next, max 120 chars>",
      "errorRecovery": "<optional fallback hint if element moved>",
      "sensitivityClass": "normal" | "captcha" | "otp" | "payment" | "legal"
    }
  ]
}

Rules:
- Copy targetSelector verbatim from the provided elements list. Never invent selectors.
- Include the NEXT 1 to 3 actionable steps visible on THIS page in logical order when sufficient is true.
- Never instruct entering passwords, card numbers, OTPs, or sensitive PII.
- Set sensitivityClass appropriately if a field involves captcha, otp, payment, or legal terms.
- Return valid JSON only — no markdown fences, no extra text.
`.trim()}export{P as b,R as g};
