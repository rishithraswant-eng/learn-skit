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

    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false
    });

    // 1. Dashboard (signed in)
    await send('Page.navigate', { url: 'http://127.0.0.1:4173/#/' });
    await new Promise(r => setTimeout(r, 1200));
    const dashShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('screenshots/current-light-dashboard.png', Buffer.from(dashShot.result.data, 'base64'));
    console.log('Saved screenshots/current-light-dashboard.png');

    // 2. Flashcards
    await send('Page.navigate', { url: 'http://127.0.0.1:4173/#/s/evs/M01/cards' });
    await new Promise(r => setTimeout(r, 1200));
    const flashShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('screenshots/current-light-flashcards.png', Buffer.from(flashShot.result.data, 'base64'));
    console.log('Saved screenshots/current-light-flashcards.png');

    // 3. MCQ
    await send('Page.navigate', { url: 'http://127.0.0.1:4173/#/s/evs/M01/practice' });
    await new Promise(r => setTimeout(r, 1200));
    const mcqShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('screenshots/current-light-mcq.png', Buffer.from(mcqShot.result.data, 'base64'));
    console.log('Saved screenshots/current-light-mcq.png');

    // 4. Landing Page (signed out)
    await send('Runtime.evaluate', {
      expression: `(async () => {
        window.__mockAuth = false;
        await window.LearnSkit.signOut();
        location.hash = '#/';
      })()`
    });
    await new Promise(r => setTimeout(r, 1000));
    const landingShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('screenshots/current-light-landing.png', Buffer.from(landingShot.result.data, 'base64'));
    console.log('Saved screenshots/current-light-landing.png');

    ws.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
