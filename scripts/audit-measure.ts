// Scratch harness for the 2026-09-14 looks audit. Not product.
// Reads computed values off a live page: colours, contrast, edges.
import { chromePath } from './chrome-path'
const CHROME = chromePath(); const PORT = 9335
const url = process.argv[2]
const expr = await Bun.file(process.argv[3]).text()
const palette = process.argv[4] ?? 'mono'
const scheme = process.argv[5] ?? 'light'
const width = Number(process.argv[6] ?? 1440)
const proc = Bun.spawn([CHROME,'--headless','--disable-gpu','--no-sandbox','--hide-scrollbars',
  '--force-color-profile=srgb','--font-render-hinting=none',
  `--user-data-dir=.tmp/measure-${process.pid}`,`--remote-debugging-port=${PORT}`,'about:blank'],
  {stdout:'ignore',stderr:'ignore'})
async function ep(){for(let i=0;i<200;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const t=await r.json() as any[];const p=t.find(x=>x.type==='page');if(p)return p.webSocketDebuggerUrl}catch{}await Bun.sleep(100)}throw new Error('no port')}
const ws=new WebSocket(await ep()); await new Promise<void>(r=>{ws.onopen=()=>r()})
let id=0; const pend=new Map<number,(v:any)=>void>(); const evs:Array<(m:any)=>void>=[]
ws.onmessage=e=>{const m=JSON.parse(String(e.data)); if(m.id&&pend.has(m.id)){pend.get(m.id)!(m.result??{});pend.delete(m.id)} else for(const h of evs) h(m)}
const send=(method:string,params:any={})=>new Promise<any>(res=>{const n=++id;pend.set(n,res);ws.send(JSON.stringify({id:n,method,params}))})
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false})
const load = new Promise<void>((res)=>{const t=setTimeout(()=>{done();res()},20000)
  const h=(m:any)=>{if(m.method==='Page.loadEventFired'){clearTimeout(t);done();res()}}
  const done=()=>{const i=evs.indexOf(h); if(i>=0) evs.splice(i,1)}
  evs.push(h)})
await send('Page.navigate',{url}); await load
// The palette and scheme travel as ARGUMENTS to a fixed function, never spliced into source:
// a value written into an expression is code the page runs (CodeQL js/bad-code-sanitization).
const page = await send('Runtime.evaluate',{expression:'globalThis'})
await send('Runtime.callFunctionOn',{objectId:page.result.objectId,
  functionDeclaration:"function(p,s){const d=document.documentElement;d.dataset.palette=p;d.dataset.scheme=s;d.classList.toggle('dark',s==='dark')}",
  arguments:[{value:palette},{value:scheme}]})
await Bun.sleep(500)
const out = await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true})
console.log(out?.result?.value ?? JSON.stringify(out).slice(0,500))
ws.close(); proc.kill()
