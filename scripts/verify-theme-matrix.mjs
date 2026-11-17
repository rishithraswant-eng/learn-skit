import http from 'http';
import fs from 'fs';
import { spawn } from 'child_process';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;

const mockSupabaseScript = `
const ROWS = [
  {
    subject: 'evs',
    module_id: 'M01',
    payload: {
      cards: [
        ['What are the three core spheres of the biosphere?', 'Lithosphere, Hydrosphere, and Atmosphere', 'Mnemonic: Land, Water, Air'],
        ['Define the 10% trophic efficiency rule', 'Only approximately 10% of energy is transferred between successive trophic levels.', 'Formulated by Raymond Lindeman (1942)'],
        ['What is the primary cause of photochemical smog?', 'Nitrogen oxides (NOx) and volatile organic compounds (VOCs) reacting in sunlight.', 'Common exam question']
      ],
      mcq: [
        ['Which of the following parameters is the primary standard indicator of organic water pollution?',
         ['Biochemical Oxygen Demand (BOD)', 'Dissolved Carbon Monoxide', 'Nitrate precipitation index', 'Total dissolved helium'],
         0, 'BOD measures the amount of dissolved oxygen consumed by microorganisms while decomposing organic matter.',
         'BOD5 is incubated for 5 days at 20°C in darkness.', 'BOD vs COD shortcut', 'Do not confuse with COD which includes inorganic oxidation', 'E', 45]
      ],
      cardIds: ['evs:M01:c01', 'evs:M01:c02', 'evs:M01:c03'],
      questionIds: ['evs:M01:001'],
      questionMeta: [{ group_id: 'g1', expected_time_sec: 45 }]
    }
  }
];

window.supabase = {
  createClient(url, key, opts) {
    return {
      auth: {
        onAuthStateChange(cb) {
          window.__authCb = cb;
          if (window.__mockAuth !== false) {
            setTimeout(() => cb('INITIAL_SESSION', { user: { id: 'browser-test', email: 'student@example.com' } }), 0);
          } else {
            setTimeout(() => cb('SIGNED_OUT', null), 0);
          }
        },
        getSession: async () => ({ data: { session: window.__mockAuth !== false ? { user: { id: 'browser-test' } } : null } }),
        signOut: async () => {
          window.__mockAuth = false;
          if (window.__authCb) window.__authCb('SIGNED_OUT', null);
          return { error: null };
        }
      },
      storage: { from() { return { createSignedUrl: async () => ({ data: { signedUrl: '' }, error: null }) }; } },
      rpc: async () => ({ data: {}, error: null }),
      from(table) {
        const query = {
          select() { return query; },
          eq() { return query; },
          order() { return query; },
          range() { return query; },
          then(resolve, reject) {
            if (table === 'study_modules') return Promise.resolve({ data: ROWS, error: null }).then(resolve, reject);
            return Promise.resolve({ data: [{ kind: 'position', item_id: 'profile', payload: { onboarding_done: true } }], error: null }).then(resolve, reject);
          },
          upsert: async () => ({ error: null })
        };
        return query;
      }
    };
  }
};
`;

async function main() {
  if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots', { recursive: true });

  const chromeProcess = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    'about:blank'
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

    const target = list.find(t => t.type === 'page');
    if (!target) throw new Error('Page target not found');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const curId = id++;
        const handler = msg => {
          const res = JSON.parse(msg.data.toString());
          if (res.id === curId) {
            ws.removeEventListener('message', handler);
            if (res.error) reject(res.error);
            else resolve(res);
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

    ws.addEventListener('message', async msg => {
      const data = JSON.parse(msg.data.toString());
      if (data.method === 'Fetch.requestPaused') {
        const req = data.params.request;
        if (req.url.includes('supabase.js')) {
          await send('Fetch.fulfillRequest', {
            requestId: data.params.requestId,
            responseCode: 200,
            responseHeaders: [{ name: 'Content-Type', value: 'text/javascript; charset=utf-8' }],
            body: Buffer.from(mockSupabaseScript).toString('base64')
          });
        } else {
          await send('Fetch.continueRequest', { requestId: data.params.requestId });
        }
      }
    });

    await send('Fetch.enable', {
      patterns: [{ urlPattern: '*supabase.js*', requestStage: 'Request' }]
    });

    console.log('--- 1. Testing Theme Provider & Toggle Functionality ---');
    await send('Page.navigate', { url: 'http://127.0.0.1:4173/#/' });
    await new Promise(r => setTimeout(r, 1200));

    // Test toggle to Dark
    let res = await send('Runtime.evaluate', {
      expression: `(() => {
        window.Theme.set('dark');
        const root = document.documentElement;
        return {
          theme: window.Theme.get(),
          isDarkClass: root.classList.contains('dark'),
          dataTheme: root.getAttribute('data-theme'),
          colorScheme: root.style.colorScheme,
          metaTheme: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
          localTheme: localStorage.getItem('learn-skit-theme')
        };
      })()`,
      returnByValue: true
    });
    console.log('Dark Theme Switch Result:', res.result.value);

    // Test toggle to Light
    res = await send('Runtime.evaluate', {
      expression: `(() => {
        window.Theme.set('light');
        const root = document.documentElement;
        return {
          theme: window.Theme.get(),
          isDarkClass: root.classList.contains('dark'),
          dataTheme: root.getAttribute('data-theme'),
          colorScheme: root.style.colorScheme,
          metaTheme: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
          localTheme: localStorage.getItem('learn-skit-theme')
        };
      })()`,
      returnByValue: true
    });
    console.log('Light Theme Switch Result:', res.result.value);

    // Test toggle to System
    res = await send('Runtime.evaluate', {
      expression: `(() => {
        window.Theme.set('system');
        const root = document.documentElement;
        return {
          theme: window.Theme.get(),
          isDarkClass: root.classList.contains('dark'),
          dataTheme: root.getAttribute('data-theme'),
          localTheme: localStorage.getItem('learn-skit-theme')
        };
      })()`,
      returnByValue: true
    });
    console.log('System Theme Switch Result:', res.result.value);

    // Test live OS preference change
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'dark' }]
    });
    await new Promise(r => setTimeout(r, 100));
    res = await send('Runtime.evaluate', {
      expression: `(() => {
        const root = document.documentElement;
        return {
          theme: window.Theme.get(),
          isDarkClass: root.classList.contains('dark'),
          dataTheme: root.getAttribute('data-theme')
        };
      })()`,
      returnByValue: true
    });
    console.log('Live OS Dark Change Result:', res.result.value);

    // Switch back to light
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }]
    });
    await new Promise(r => setTimeout(r, 100));

    console.log('\n--- 2. Testing Section 6b Typography & Responsiveness ---');
    // Sign out to test landing page sections
    await send('Runtime.evaluate', {
      expression: `(async () => {
        window.__mockAuth = false;
        await window.LearnSkit.signOut();
        location.hash = '#/';
      })()`
    });
    await new Promise(r => setTimeout(r, 800));

    const viewports = [320, 360, 390, 768, 1440];
    for (const w of viewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 800,
        deviceScaleFactor: 2,
        mobile: w < 768
      });
      await new Promise(r => setTimeout(r, 200));

      const typeInfo = await send('Runtime.evaluate', {
        expression: `(() => {
          const headings = Array.from(document.querySelectorAll('.landing-sec-heading, .final-cta-heading'));
          const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
          return {
            viewportWidth: window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            hasHorizontalScroll: overflow,
            headings: headings.map(h => {
              const cs = window.getComputedStyle(h);
              return {
                id: h.id || h.className,
                text: h.textContent.trim(),
                fontSize: cs.fontSize,
                lineHeight: cs.lineHeight,
                letterSpacing: cs.letterSpacing,
                width: h.getBoundingClientRect().width,
                maxAllowed: cs.maxWidth
              };
            })
          };
        })()`,
        returnByValue: true
      });
      console.log(`Viewport ${w}px Check:`, JSON.stringify(typeInfo.result.value, null, 2));
    }

    console.log('\n--- 3. Capturing Full Screenshot Matrix (3 Viewports × 4 Screens × 2 Themes) ---');
    const matrixViewports = [
      { name: '360', width: 360, height: 740, mobile: true },
      { name: '768', width: 768, height: 1024, mobile: false },
      { name: '1440', width: 1440, height: 900, mobile: false }
    ];

    const themes = ['light', 'dark'];

    for (const theme of themes) {
      console.log(`\n=== Capturing Theme: ${theme.toUpperCase()} ===`);
      for (const vp of matrixViewports) {
        await send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 2,
          mobile: vp.mobile
        });

        // Set theme
        await send('Runtime.evaluate', {
          expression: `window.Theme.set('${theme}')`
        });
        await new Promise(r => setTimeout(r, 250));

        // Screen 1: Landing (signed out)
        await send('Runtime.evaluate', {
          expression: `(async () => {
            window.__mockAuth = false;
            await window.LearnSkit.signOut();
            location.hash = '#/';
          })()`
        });
        await new Promise(r => setTimeout(r, 1000));
        let shot = await send('Page.captureScreenshot', { format: 'png' });
        let filename = `screenshots/landing-${theme}-${vp.name}.png`;
        fs.writeFileSync(filename, Buffer.from(shot.result.data, 'base64'));
        console.log(`Captured ${filename}`);

        // Sign in for the rest
        await send('Runtime.evaluate', {
          expression: `(async () => {
            window.__mockAuth = true;
            location.hash = '#/';
            window.__authCb('INITIAL_SESSION', { user: { id: 'browser-test', email: 'student@example.com' } });
          })()`
        });
        await new Promise(r => setTimeout(r, 1200));

        // Screen 2: Dashboard
        await send('Page.navigate', { url: 'http://127.0.0.1:4173/#/' });
        await new Promise(r => setTimeout(r, 1200));
        shot = await send('Page.captureScreenshot', { format: 'png' });
        filename = `screenshots/dashboard-${theme}-${vp.name}.png`;
        fs.writeFileSync(filename, Buffer.from(shot.result.data, 'base64'));
        console.log(`Captured ${filename}`);

        // Screen 3: Flashcards
        await send('Page.navigate', { url: 'http://127.0.0.1:4173/#/s/evs/M01/cards' });
        await new Promise(r => setTimeout(r, 1200));
        shot = await send('Page.captureScreenshot', { format: 'png' });
        filename = `screenshots/flashcards-${theme}-${vp.name}.png`;
        fs.writeFileSync(filename, Buffer.from(shot.result.data, 'base64'));
        console.log(`Captured ${filename}`);

        // Screen 4: MCQ Practice
        await send('Page.navigate', { url: 'http://127.0.0.1:4173/#/s/evs/M01/practice' });
        await new Promise(r => setTimeout(r, 1200));
        shot = await send('Page.captureScreenshot', { format: 'png' });
        filename = `screenshots/mcq-${theme}-${vp.name}.png`;
        fs.writeFileSync(filename, Buffer.from(shot.result.data, 'base64'));
        console.log(`Captured ${filename}`);
      }
    }

    console.log('\n--- 4. WCAG Contrast Check ---');
    const contrastEval = await send('Runtime.evaluate', {
      expression: `(() => {
        function luminance(r, g, b) {
          const a = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          });
          return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
        }
        function contrastRatio(rgb1, rgb2) {
          const l1 = luminance(...rgb1);
          const l2 = luminance(...rgb2);
          const lighter = Math.max(l1, l2);
          const darker = Math.min(l1, l2);
          return (lighter + 0.05) / (darker + 0.05);
        }
        function parseRgb(str) {
          const m = str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
          return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0,0,0];
        }

        const checks = [];
        for (const t of ['light', 'dark']) {
          window.Theme.set(t);
          const cs = window.getComputedStyle(document.documentElement);
          const bg = parseRgb(cs.getPropertyValue('--bg'));
          const text = parseRgb(cs.getPropertyValue('--text'));
          const textSecondary = parseRgb(cs.getPropertyValue('--text-secondary'));
          const textMuted = parseRgb(cs.getPropertyValue('--text-muted'));
          const primaryBg = t === 'dark' ? [230, 237, 251] : [27, 36, 64];
          const primaryFg = parseRgb(cs.getPropertyValue('--primary-foreground'));

          checks.push({
            theme: t,
            textContrast: contrastRatio(text, bg).toFixed(2),
            textSecondaryContrast: contrastRatio(textSecondary, bg).toFixed(2),
            textMutedContrast: contrastRatio(textMuted, bg).toFixed(2),
            primaryButtonContrast: contrastRatio(primaryFg, primaryBg).toFixed(2)
          });
        }
        return checks;
      })()`,
      returnByValue: true
    });
    console.log('Contrast Verification:', JSON.stringify(contrastEval.result.value, null, 2));

    ws.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
