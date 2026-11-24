const g="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";async function h(){return new Promise(e=>{chrome.storage.local.get("gc_api_key",t=>e(t.gc_api_key??""))})}window.addEventListener("message",async e=>{var n,a;if(((n=e.data)==null?void 0:n.type)!=="SNAPSHOT_READY")return;const t=e.data.snapshot,o=e.data.taskGoal??"";try{const s=await y(t,o);(a=e.source)==null||a.postMessage({type:"PLAN_READY",plan:s},{targetOrigin:e.origin})}catch(s){console.error("[GuideCursor sandbox] Plan generation failed:",s)}});async function y(e,t){var r,i,c,l,p;const o=await h(),n=f(e,t),a=await fetch(`${g}?key=${o}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:n}]}],generationConfig:{responseMimeType:"application/json",maxOutputTokens:1024}})});if(!a.ok)throw new Error(`API error ${a.status}`);const s=await a.json(),u=((p=(l=(c=(i=(r=s==null?void 0:s.candidates)==null?void 0:r[0])==null?void 0:i.content)==null?void 0:c.parts)==null?void 0:l[0])==null?void 0:p.text)??"{}",d=JSON.parse(u);return{taskGoal:t,steps:d.steps??[]}}function f(e,t){return`
You are a step-by-step web navigation assistant. The user wants to: "${t}".

Here is a scrubbed snapshot of the current page (${e.url}):
${JSON.stringify({title:e.title,elements:e.elements},null,2)}

Return a JSON object with this exact shape:
{
  "steps": [
    {
      "targetSelector": "<CSS selector of the element the user should interact with next>",
      "action": "click" | "focus" | "scroll" | "file-upload" | "pause",
      "hint": "<plain-English instruction for the user, max 120 chars>",
      "errorRecovery": "<what to show if the element isn't found, optional>",
      "sensitivityClass": "normal" | "captcha" | "otp" | "payment" | "legal"
    }
  ]
}

Rules:
- Only include the NEXT 1-3 steps visible on this page. Do not plan future pages.
- Never ask the user to enter passwords, card numbers, OTPs, or any sensitive data.
- For any form field collecting sensitive data, set sensitivityClass appropriately.
- Prefer aria-label selectors over positional selectors.
- Keep hints friendly and concise.
- Return only valid JSON — no markdown fences, no commentary.
`.trim()}
