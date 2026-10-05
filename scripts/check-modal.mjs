import { mkdir, writeFile } from 'node:fs/promises';

const tabs = await (await fetch('http://127.0.0.1:9224/json')).json();
const page = tabs.find(tab => tab.type === 'page');
if (!page) throw new Error('No browser page is available');

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));

let id = 0;
const callbacks = new Map();
const errors = [];
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  if (!message.id) return;
  const callback = callbacks.get(message.id);
  callbacks.delete(message.id);
  if (message.error) callback.reject(message.error); else callback.resolve(message.result);
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    callbacks.set(++id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function capture(name) {
  const result = await send('Page.captureScreenshot', { format: 'png' });
  await mkdir('previews', { recursive: true });
  await writeFile(`previews/${name}.png`, Buffer.from(result.data, 'base64'));
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 800, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
await wait(1200);

const result = {};
const heroTravel = await evaluate(`document.querySelector('.hero').offsetHeight-document.querySelector('.hero-sticky').offsetHeight`);
await evaluate(`scrollTo({top:${heroTravel},behavior:'instant'})`);
await wait(1000);
result.hero = await evaluate(`(()=>{const progress=document.querySelector('.film-progress').getBoundingClientRect();const layout=document.querySelector('.hero-layout').getBoundingClientRect();const foot=document.querySelector('.hero-foot').getBoundingClientRect();const link=document.querySelector('.text-link').getBoundingClientRect();return {frame:Number(document.querySelector('canvas').dataset.frame),progressBottom:progress.bottom,layoutBottom:layout.bottom,footTop:foot.top,linkTop:link.top,overlap:progress.bottom>foot.top,overflow:document.documentElement.scrollWidth>innerWidth}})()`);
await capture('desktop-hero-line-fixed');

await evaluate(`scrollTo({top:0,behavior:'instant'});document.querySelector('.header-contact').click()`);
await wait(250);
result.genericModal = await evaluate(`({open:document.querySelector('#project-dialog').open,bodyLocked:document.body.classList.contains('modal-open'),type:document.querySelector('#project-type').value,active:document.activeElement?.getAttribute('name')})`);
await capture('desktop-project-modal');
await evaluate(`document.querySelector('[data-modal-close]').click()`);

await evaluate(`document.querySelector('#services').scrollIntoView({behavior:'instant'});document.querySelectorAll('.service [data-project-modal]')[1].click()`);
await wait(200);
result.serviceModal = await evaluate(`({open:document.querySelector('#project-dialog').open,type:document.querySelector('#project-type').value})`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await wait(150);
result.escapeClose = await evaluate(`({open:document.querySelector('#project-dialog').open,bodyLocked:document.body.classList.contains('modal-open')})`);

await evaluate(`document.querySelector('.header-contact').click();window.open=(url)=>{window.__draftUrl=url;return {}};document.querySelector('[name="name"]').value='Анна';document.querySelector('[name="contact"]').value='@anna';document.querySelector('[name="details"]').value='Квартира 60 м²';document.querySelector('#project-type').value='Онлайн-проект';document.querySelector('#project-form').requestSubmit()`);
await wait(150);
result.submit = await evaluate(`({draft:window.__draftUrl,status:document.querySelector('#form-status').textContent,open:document.querySelector('#project-dialog').open})`);
await evaluate(`document.querySelector('#project-dialog').close()`);

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await evaluate(`scrollTo({top:0,behavior:'instant'});document.querySelector('.header-contact').click()`);
await wait(250);
result.mobile = await evaluate(`(()=>{const dialog=document.querySelector('#project-dialog').getBoundingClientRect();return {open:document.querySelector('#project-dialog').open,width:dialog.width,height:dialog.height,overflow:document.documentElement.scrollWidth>innerWidth}})()`);
await capture('mobile-project-modal');
await evaluate(`document.querySelector('#project-dialog').close()`);

result.removedLabels = await evaluate(`['ДОМ НАЧИНАЕТСЯ С ЧУВСТВА','01 / ЗНАКОМСТВО','02 / ФОРМАТЫ РАБОТЫ','01 / ВМЕСТЕ НА РАССТОЯНИИ','02 / ВСЁ В ОДНИХ РУКАХ','03 / ЧУВСТВО ДОМА','КРАСОТА В ПРОСТЫХ ВЕЩАХ','04 / ЭТАПЫ РАБОТЫ','ПРОЗРАЧНО. ПОСЛЕДОВАТЕЛЬНО. ВМЕСТЕ.'].filter(label=>document.body.innerText.toUpperCase().includes(label))`);
result.errors = errors;

await writeFile('previews/modal-check.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
ws.close();
