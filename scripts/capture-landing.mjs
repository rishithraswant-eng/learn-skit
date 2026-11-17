import http from 'http';
import fs from 'fs';
import { spawn } from 'child_process';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;

async function main() {
  // Launch Chrome headless
  const chromeProcess = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    'http://127.0.0.1:4173/'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const list = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${PORT}/json`, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const target = list.find(t => t.url.includes('4173'));
    if (!target) throw new Error('Preview target page not found');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let id = 1;
    function send(method, params = {}) {
      return new Promise(resolve => {
        const curId = id++;
        const handler = msg => {
          const res = JSON.parse(msg.data.toString());
          if (res.id === curId) {
            ws.removeEventListener('message', handler);
            resolve(res);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    // Capture at 360, 768, 1440
    const viewports = [
      { name: '360', w: 360, h: 780, mobile: true },
      { name: '768', w: 768, h: 1024, mobile: false },
      { name: '1440', w: 1440, h: 900, mobile: false }
    ];

    for (const vp of viewports) {
      console.log(`Setting viewport ${vp.name}...`);
      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.w,
        height: vp.h,
        deviceScaleFactor: 2,
        mobile: vp.mobile
      });

      // Scroll to trigger IntersectionObserver animations
      await send('Runtime.evaluate', {
        expression: 'window.scrollTo(0, 0); document.querySelectorAll(".scroll-fade-up").forEach(el => el.classList.add("in-view")); document.querySelectorAll(".how-path-line").forEach(el => el.classList.add("animated"));'
      });
      await new Promise(r => setTimeout(r, 800));

      // Check horizontal overflow
      const overflowRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const doc = document.documentElement;
          const body = document.body;
          const overflows = [];
          document.querySelectorAll('*').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.right > window.innerWidth + 1) {
              overflows.push({ tag: el.tagName, cls: el.className, right: r.right, w: r.width });
            }
          });
          return JSON.stringify({ innerWidth: window.innerWidth, docScroll: doc.scrollWidth, bodyScroll: body.scrollWidth, overflows: overflows.slice(0, 5) });
        })()`
      });
      console.log(`Overflow check [${vp.name}]:`, overflowRes.result.value);

      // 1. Full page screenshot
      const fullShot = await send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true
      });
      fs.writeFileSync(`screenshots/fullpage-${vp.name}.png`, Buffer.from(fullShot.result.data, 'base64'));
      console.log(`Saved screenshots/fullpage-${vp.name}.png`);

      // 2. Bento & stats section screenshot (scrolled)
      await send('Runtime.evaluate', {
        expression: '(() => { const el = document.querySelector(".features-bento-grid") || document.querySelector(".stats-band"); if (el) el.scrollIntoView({ behavior: "instant", block: "center" }); })()'
      });
      await new Promise(r => setTimeout(r, 400));
      const bentoShot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`screenshots/bento-section-${vp.name}.png`, Buffer.from(bentoShot.result.data, 'base64'));
      console.log(`Saved screenshots/bento-section-${vp.name}.png`);

      // 3. How it works & CTA section screenshot (scrolled)
      await send('Runtime.evaluate', {
        expression: '(() => { const el = document.querySelector(".final-cta-panel"); if (el) el.scrollIntoView({ behavior: "instant", block: "center" }); })()'
      });
      await new Promise(r => setTimeout(r, 400));
      const ctaShot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`screenshots/cta-section-${vp.name}.png`, Buffer.from(ctaShot.result.data, 'base64'));
      console.log(`Saved screenshots/cta-section-${vp.name}.png`);
    }

    // Also test header scrolled state (sticky header 1px border & blur check)
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
    await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 150);' });
    await new Promise(r => setTimeout(r, 300));
    const headerScrolledShot = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: 1440, height: 120, scale: 2 }
    });
    fs.writeFileSync('screenshots/header-scrolled.png', Buffer.from(headerScrolledShot.result.data, 'base64'));
    console.log('Saved screenshots/header-scrolled.png');

    ws.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
