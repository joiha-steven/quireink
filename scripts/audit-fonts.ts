// Scratch harness for the 2026-09-14 looks audit. Not product.
// Which platform font actually painted a node, via CSS.getPlatformFontsForNode.
import { chromePath } from './chrome-path'
const CHROME = chromePath(); const PORT = 9336
const url = process.argv[2]
const selectors = process.argv.slice(3)
const proc = Bun.spawn([CHROME,'--headless','--disable-gpu','--no-sandbox','--hide-scrollbars',
  `--user-data-dir=.tmp/fonts-${process.pid}`,`--remote-debugging-port=${PORT}`,'about:blank'],{stdout:'ignore',stderr:'ignore'})
async function ep(){for(let i=0;i<200;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const t=await r.json() as any[];const p=t.find(x=>x.type==='page');if(p)return p.webSocketDebuggerUrl}catch{}await Bun.sleep(100)}throw new Error('no port')}
const ws=new WebSocket(await ep()); await new Promise<void>(r=>{ws.onopen=()=>r()})
let id=0; const pend=new Map<number,(v:any)=>void>(); const evs:Array<(m:any)=>void>=[]
ws.onmessage=e=>{const m=JSON.parse(String(e.data)); if(m.id&&pend.has(m.id)){pend.get(m.id)!(m.result??{});pend.delete(m.id)} else for(const h of evs) h(m)}
const send=(method:string,params:any={})=>new Promise<any>(res=>{const n=++id;pend.set(n,res);ws.send(JSON.stringify({id:n,method,params}))})
await send('Page.enable'); await send('DOM.enable'); await send('CSS.enable')
const load=new Promise<void>(res=>{const t=setTimeout(()=>{done();res()},20000)
  const h=(m:any)=>{if(m.method==='Page.loadEventFired'){clearTimeout(t);done();res()}}
  const done=()=>{const i=evs.indexOf(h);if(i>=0)evs.splice(i,1)}; evs.push(h)})
await send('Page.navigate',{url}); await load; await Bun.sleep(1200)
const doc = await send('DOM.getDocument', { depth: -1 })
for (const sel of selectors) {
  const q = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: sel })
  if (!q?.nodeId) { console.log(`${sel}: not found`); continue }
  const f = await send('CSS.getPlatformFontsForNode', { nodeId: q.nodeId })
  const fonts = (f.fonts ?? []).map((x: any) => `${x.familyName}${x.isCustomFont ? '*' : ''}:${x.glyphCount}`).join('  ')
  const txt = await send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(sel)})?.textContent.trim().slice(0,28)`, returnByValue: true })
  console.log(`${sel.padEnd(38)} "${txt?.result?.value ?? ''}"  ->  ${fonts}`)
}
ws.close(); proc.kill()
