// Browser verification with native Chrome DevTools Protocol. No dependencies.
import { writeFile } from 'node:fs/promises';
const tabs = await (await fetch('http://127.0.0.1:9224/json')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id = 0;
const callbacks = new Map();
const errors = [];
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  if (message.id) {
    const { resolve, reject } = callbacks.get(message.id);
    callbacks.delete(message.id);
    if (message.error) reject(message.error); else resolve(message.result);
  }
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    callbacks.set(++id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const capture = async name => {
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(`previews/${name}.png`, Buffer.from(screenshot.data, 'base64'));
};
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
await sleep(1800);
const result = {};
await capture('desktop-hero');
result.initial = await evaluate(`({frame:document.querySelector('canvas').dataset.frame,removed:!document.querySelector('#transformation'),logo:document.querySelector('.brand img').getAttribute('src'),overflow:document.documentElement.scrollWidth>innerWidth})`);
const travel = await evaluate(`document.querySelector('.hero').offsetHeight-document.querySelector('.hero-sticky').offsetHeight`);
for (const [name, fraction] of [['middle',.5],['after',1],['reverse',.25]]) {
  await evaluate(`scrollTo({top:${travel*fraction},behavior:'instant'})`);
  await sleep(1200);
  result[name+'Frame'] = await evaluate(`Number(document.querySelector('canvas').dataset.frame)`);
  await capture('desktop-hero-'+name);
}
for (const section of ['about','services','details','process','contact']) {
  await evaluate(`document.querySelector('#${section}').scrollIntoView({behavior:'instant'})`);
  await sleep(350);
  await capture('desktop-'+section);
}
result.links = await evaluate(`Array.from(document.querySelectorAll('a[href^="#"]')).map(a=>({href:a.getAttribute('href'),valid:!!document.querySelector(a.getAttribute('href'))}))`);
result.contacts = await evaluate(`Array.from(document.querySelectorAll('a[href^="https:"]')).map(a=>({href:a.href,target:a.target,rel:a.rel}))`);
await evaluate(`scrollTo({top:0,behavior:'instant'})`);
await sleep(400);
result.defaultButton = await evaluate(`getComputedStyle(document.querySelector('.hero-cta')).backgroundColor`);
const button = await evaluate(`(()=>{const r=document.querySelector('.hero-cta').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
await send('Input.dispatchMouseEvent',{type:'mouseMoved',...button});
await sleep(400);
result.hoverButton = await evaluate(`getComputedStyle(document.querySelector('.hero-cta')).backgroundColor`);
await capture('desktop-hover');
await send('Input.dispatchMouseEvent',{type:'mousePressed',...button,button:'left',clickCount:1});
await send('Input.dispatchMouseEvent',{type:'mouseReleased',...button,button:'left',clickCount:1});
await sleep(1200);
result.ctaNavigation = await evaluate(`({hash:location.hash,sectionTop:document.querySelector('#services').getBoundingClientRect().top})`);
await evaluate(`document.querySelector('.service .button').focus()`);
await send('Input.dispatchKeyEvent', { type:'keyDown', key:'Tab', code:'Tab', windowsVirtualKeyCode:9 });
await send('Input.dispatchKeyEvent', { type:'keyUp', key:'Tab', code:'Tab', windowsVirtualKeyCode:9 });
result.keyboardFocus = await evaluate(`({visible:document.activeElement.matches(':focus-visible'),outline:getComputedStyle(document.activeElement).outlineStyle})`);
await evaluate(`document.activeElement.blur()`);
await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
result.responsive = [];
for (const [width,height] of [[390,844],[320,740],[768,1024],[1024,768],[1440,800]]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width<761 });
  await evaluate(`scrollTo({top:0,behavior:'instant'})`);
  await sleep(600);
  await capture('hero-'+width);
  result.responsive.push(await evaluate(`({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,headingOverflow:document.querySelector('h1').scrollWidth>document.querySelector('.hero-copy').clientWidth,heroHeight:document.querySelector('.hero-sticky').offsetHeight})`));
  if(width===390){
    for (const section of ['about','services','details','process','contact']) {
      await evaluate(`document.querySelector('#${section}').scrollIntoView({behavior:'instant'})`);
      await sleep(250);
      await capture('mobile-'+section);
    }
  }
}
result.images = await evaluate(`Array.from(document.images).map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0}))`);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await evaluate(`scrollTo({top:0,behavior:'instant'})`);
await sleep(1000);
result.reducedMotion = await evaluate(`({frame:document.querySelector('canvas').dataset.frame,heroHeight:document.querySelector('.hero').offsetHeight,stickyHeight:document.querySelector('.hero-sticky').offsetHeight})`);
result.errors = errors;
await writeFile('previews/browser-check.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await evaluate(`history.replaceState(null,'','/');scrollTo({top:0,behavior:'instant'})`);
ws.close();
