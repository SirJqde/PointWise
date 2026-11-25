const G=["gemini-2.5-flash","gemini-2.0-flash"];async function S(){var e;return typeof chrome>"u"||!((e=chrome.storage)!=null&&e.local)?"":new Promise(a=>{chrome.storage.local.get("gc_api_key",n=>{a((n.gc_api_key??"").trim())})})}const O={functionDeclarations:[{name:"guide_page",description:"Inspects the currently open website's scrubbed interactive elements (buttons, links, inputs, forms) to gather context before deciding on clarifying questions or creating a grounded Plan of Action.",parameters:{type:"OBJECT",properties:{reason:{type:"STRING",description:"Brief reason why page context is needed to decide next steps."}},required:["reason"]}}]};async function _(e){var u,p,g,h;const a=e.apiKeyOverride??await S();if(!a)return{taskGoal:e.taskGoal,steps:[],error:"Gemini API key is required for AI page guidance. Add it in ⚙ API Key.",recovery:"api-key"};const n=!!e.contextProvided;let t=null;const c=[{role:"user",parts:[{text:C(e.taskGoal,e.pageUrl??"",n)}]}];let i={message:"Gemini couldn’t prepare a plan. Try again.",recovery:"retry"};for(const w of G){const x=`https://generativelanguage.googleapis.com/v1beta/models/${w}:generateContent`;let k=!1;for(let b=0;b<3;b++)try{const l=await fetch(`${x}?key=${encodeURIComponent(a)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:c,tools:[O],generationConfig:{temperature:.15,maxOutputTokens:1024}}),signal:AbortSignal.timeout(14e3)});if(l.status===404){k=!0;break}if(!l.ok){const s=l.status===400?await l.text().catch(()=>""):"";l.status===401||l.status===403||/API_KEY_INVALID|API key not valid/i.test(s)?i={message:"Gemini rejected the API key or its permissions. Update it in the PointWise popup, then try again.",recovery:"api-key"}:l.status===429&&(i.message="Gemini’s request limit was reached. Wait a moment, then try again.");break}const d=await l.json(),m=((g=(p=(u=d==null?void 0:d.candidates)==null?void 0:u[0])==null?void 0:p.content)==null?void 0:g.parts)??[];if((h=m.find(s=>{var o;return((o=s.functionCall)==null?void 0:o.name)==="guide_page"}))==null?void 0:h.functionCall){if(c.push({role:"model",parts:m}),t=await e.guidePage(),!t||t.elements.length===0)return{taskGoal:e.taskGoal,steps:[],error:"No interactive elements were found on this page yet.",recovery:"rescan"};const s=t.elements.map(o=>({selector:o.selector,role:o.role,label:o.label,tagName:o.tagName,type:o.inputType,inViewport:o.inViewport,disabled:o.disabled,hasFileInput:o.hasFileInput}));c.push({role:"function",parts:[{functionResponse:{name:"guide_page",response:{url:t.url,title:t.title,elements:s}}}]});continue}const y=m.map(s=>s.text??"").join("").trim();if(!y)throw new Error("Empty response from Gemini");const f=P(y);if(!n&&f.sufficient===!1&&typeof f.clarifyingQuestion=="string"&&f.clarifyingQuestion.trim())return{taskGoal:e.taskGoal,steps:[],needsContext:!0,clarifyingQuestion:f.clarifyingQuestion.trim()};if(!t){if(t=await e.guidePage(),!t||t.elements.length===0)return{taskGoal:e.taskGoal,steps:[],error:"No interactive elements found on this page.",recovery:"rescan"};c.push({role:"model",parts:[{text:y}]}),c.push({role:"user",parts:[{text:`Before outputting steps, ground every selector strictly in the actual page elements returned below:
${JSON.stringify({url:t.url,title:t.title,elements:t.elements.map(s=>({selector:s.selector,label:s.label,tagName:s.tagName,role:s.role}))},null,2)}`}]});continue}const v=N(f.steps??[],t.elements);return v.length>0?{taskGoal:e.taskGoal,steps:v}:{taskGoal:e.taskGoal,steps:[],error:"Could not find matching interactive elements for this task on the page.",recovery:"rescan"}}catch{break}if(!k)break}return{taskGoal:e.taskGoal,steps:[],error:i.message,recovery:i.recovery}}function P(e){const a=e.replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/i,"").trim(),n=a.indexOf("{"),t=a.lastIndexOf("}"),r=n!==-1&&t>n?a.slice(n,t+1):a;return JSON.parse(r)}function N(e,a){const n=new Map(a.map(r=>[r.selector,r])),t=[];for(const r of e){if(!r||typeof r.targetSelector!="string"||!r.hint)continue;const c=r.targetSelector.trim();let i=n.get(c);if(!i&&r.fallbackLabel){const p=r.fallbackLabel.trim().toLowerCase();p&&(i=a.find(g=>g.label.trim().toLowerCase()===p))}if(!i)continue;const u={targetSelector:i.selector,action:r.action||"click",hint:r.hint.slice(0,140),sensitivityClass:r.sensitivityClass||"normal"};if(i.label&&(u.fallbackLabel=i.label),r.errorRecovery!==void 0&&(u.errorRecovery=r.errorRecovery),t.push(u),t.length>=4)break}return t}function C(e,a,n){return`
You are PointWise, a step-by-step web navigation assistant.
User's goal: "${e||"Help the user complete their task"}"
Current URL: ${a||"unknown"}
Extra context already provided by user: ${n?"YES (do NOT ask another clarifying question; set sufficient=true)":"NO"}.

Process:
1. Call the \`guide_page\` tool to inspect the actual interactive elements on the page so you have full context before deciding.
2. Once you have the page elements from \`guide_page\`:
   - If extra context is NO and key details are still missing to pick the right steps (e.g. pass type, origin/destination, product name), return JSON with "sufficient": false and a single concise "clarifyingQuestion".
   - Otherwise, return JSON with "sufficient": true and 1 to 3 grounded "steps" using ONLY exact selectors copied verbatim from \`guide_page\`.

Return strictly valid JSON (no markdown fences) in your final message:
{
  "sufficient": true | false,
  "clarifyingQuestion": "<one concise question if sufficient is false>",
  "steps": [
    {
      "targetSelector": "<exact selector from guide_page elements>",
      "fallbackLabel": "<exact label from that element>",
      "action": "click" | "focus" | "scroll" | "file-upload" | "pause",
      "hint": "<clear, short instruction for the user, max 120 chars>",
      "errorRecovery": "<optional hint>",
      "sensitivityClass": "normal" | "captcha" | "otp" | "payment" | "legal"
    }
  ]
}

Rules:
- Never invent or guess CSS selectors. Only copy exact selectors returned by \`guide_page\`.
- Never ask users to share passwords, OTPs, or payment details.
`.trim()}export{C as b,S as g,_ as r};
