const S=["gemini-2.5-flash","gemini-2.0-flash"];async function G(){var e;return typeof chrome>"u"||!((e=chrome.storage)!=null&&e.local)?"":new Promise(r=>{chrome.storage.local.get("gc_api_key",a=>{r((a.gc_api_key??"").trim())})})}const O={functionDeclarations:[{name:"guide_page",description:"Inspects the currently open website's scrubbed interactive elements (buttons, links, inputs, forms) to gather context before deciding on clarifying questions or creating a grounded Plan of Action.",parameters:{type:"OBJECT",properties:{reason:{type:"STRING",description:"Brief reason why page context is needed to decide next steps."}},required:["reason"]}}]};async function _(e){var u,p,g,y;const r=e.apiKeyOverride??await G();if(!r)return{taskGoal:e.taskGoal,steps:[],error:"Gemini API key is required for AI page guidance. Add it in ⚙ API Key."};const a=!!e.contextProvided;let t=null;const c=[{role:"user",parts:[{text:P(e.taskGoal,e.pageUrl??"",a)}]}];let o="Unable to reach Gemini AI";for(const b of S){const x=`https://generativelanguage.googleapis.com/v1beta/models/${b}:generateContent`;let k=!1;for(let v=0;v<3;v++)try{const l=await fetch(`${x}?key=${encodeURIComponent(r)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:c,tools:[O],generationConfig:{temperature:.15,maxOutputTokens:1024}}),signal:AbortSignal.timeout(14e3)});if(l.status===404){o=`Model ${b} unavailable (404)`,k=!0;break}if(!l.ok){const s=await l.text().catch(()=>"");throw new Error(`Gemini API ${l.status}: ${s.slice(0,120)}`)}const d=await l.json(),m=((g=(p=(u=d==null?void 0:d.candidates)==null?void 0:u[0])==null?void 0:p.content)==null?void 0:g.parts)??[];if((y=m.find(s=>{var i;return((i=s.functionCall)==null?void 0:i.name)==="guide_page"}))==null?void 0:y.functionCall){if(c.push({role:"model",parts:m}),t=await e.guidePage(),!t||t.elements.length===0)return{taskGoal:e.taskGoal,steps:[],error:"No interactive elements were found on this page yet."};const s=t.elements.map(i=>({selector:i.selector,role:i.role,label:i.label,tagName:i.tagName,type:i.inputType,inViewport:i.inViewport,disabled:i.disabled,hasFileInput:i.hasFileInput}));c.push({role:"function",parts:[{functionResponse:{name:"guide_page",response:{url:t.url,title:t.title,elements:s}}}]});continue}const h=m.map(s=>s.text??"").join("").trim();if(!h)throw new Error("Empty response from Gemini");const f=N(h);if(!a&&f.sufficient===!1&&typeof f.clarifyingQuestion=="string"&&f.clarifyingQuestion.trim())return{taskGoal:e.taskGoal,steps:[],needsContext:!0,clarifyingQuestion:f.clarifyingQuestion.trim()};if(!t){if(t=await e.guidePage(),!t||t.elements.length===0)return{taskGoal:e.taskGoal,steps:[],error:"No interactive elements found on this page."};c.push({role:"model",parts:[{text:h}]}),c.push({role:"user",parts:[{text:`Before outputting steps, ground every selector strictly in the actual page elements returned below:
${JSON.stringify({url:t.url,title:t.title,elements:t.elements.map(s=>({selector:s.selector,label:s.label,tagName:s.tagName,role:s.role}))},null,2)}`}]});continue}const w=C(f.steps??[],t.elements);return w.length>0?{taskGoal:e.taskGoal,steps:w}:{taskGoal:e.taskGoal,steps:[],error:"Could not find matching interactive elements for this task on the page."}}catch(l){o=l instanceof Error?l.message:String(l);break}if(!k)break}return{taskGoal:e.taskGoal,steps:[],error:o}}function N(e){const r=e.replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/i,"").trim(),a=r.indexOf("{"),t=r.lastIndexOf("}"),n=a!==-1&&t>a?r.slice(a,t+1):r;return JSON.parse(n)}function C(e,r){const a=new Map(r.map(n=>[n.selector,n])),t=[];for(const n of e){if(!n||typeof n.targetSelector!="string"||!n.hint)continue;const c=n.targetSelector.trim();let o=a.get(c);if(!o&&n.fallbackLabel){const p=n.fallbackLabel.trim().toLowerCase();p&&(o=r.find(g=>g.label.trim().toLowerCase()===p))}if(!o)continue;const u={targetSelector:o.selector,action:n.action||"click",hint:n.hint.slice(0,140),sensitivityClass:n.sensitivityClass||"normal"};if(o.label&&(u.fallbackLabel=o.label),n.errorRecovery!==void 0&&(u.errorRecovery=n.errorRecovery),t.push(u),t.length>=4)break}return t}function P(e,r,a){return`
You are PointWise, a step-by-step web navigation assistant.
User's goal: "${e||"Help the user complete their task"}"
Current URL: ${r||"unknown"}
Extra context already provided by user: ${a?"YES (do NOT ask another clarifying question; set sufficient=true)":"NO"}.

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
`.trim()}export{P as b,_ as r};
