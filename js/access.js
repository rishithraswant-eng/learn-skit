/* Authentication and private content delivery. No study pack is bundled here. */
window.LearnSkit = (() => {
  let client, user, onChange = () => {}, timer, generation = 0;
  let pending = new Map(), saving = null;
  let syncError = null;
  // PostgREST turns a top-level JSON null into SQL NULL. The payload column is
  // NOT NULL, so keep cleared values as an explicit tombstone on the wire.
  const cloudRow = row => ({ ...row, payload: row.payload ?? { __learn_skit_null: true } });
  const devicePayload = payload => payload && typeof payload === 'object' &&
    payload.__learn_skit_null === true && Object.keys(payload).length === 1 ? null : payload;
  const empty = () => ({ box: {}, mcq: {}, position: {}, last: null });
  let state = empty();
  const message = text => { const node = document.querySelector('#toast'); node.textContent = text; node.classList.add('on'); setTimeout(() => node.classList.remove('on'), 5000); };
  const cacheKey = id => `learn-skit:v2:${id}`;
  const safeLast = value => value && /^#\/s\/[\w-]+\/[\w-]+\/(?:cards|practice|notes|video)$/.test(value.h) && typeof value.label === 'string' && typeof value.short === 'string' ? { h:value.h, label:value.label, short:value.short } : null;
  const writeCache = () => { if (user) try { localStorage.setItem(cacheKey(user.id), JSON.stringify({ state, pending: [...pending] })); } catch {} };
  let cacheQueued = false;
  function cache() {
    if (!user || cacheQueued) return;
    cacheQueued = true;
    Promise.resolve().then(() => { cacheQueued = false; writeCache(); });
  }
  function put(kind, item_id, payload) {
    if (!user) return;
    pending.set(`${kind}:${item_id}`, { user_id: user.id, kind, item_id, payload });
    cache(); clearTimeout(timer); timer = setTimeout(flush, 1500);
  }
  async function flush() {
    if (saving || !user || !pending.size) return saving;
    const batch = new Map(pending), owner = user.id;
    saving = (async () => {
      try {
        const { error } = await client.from('study_progress').upsert([...batch.values()].map(cloudRow), { onConflict: 'user_id,kind,item_id' });
        if (error) throw error;
        if (owner === user?.id) for (const [key, row] of batch) if (pending.get(key) === row) pending.delete(key);
        cache();
        if (owner === user?.id) {
          if (syncError && !pending.size) message('Cloud sync restored. Your saved progress is up to date.');
          syncError = null;
        }
      } catch (error) {
        for (const [key, row] of batch) if (row.user_id === user?.id && !pending.has(key)) pending.set(key, row);
        if (owner === user?.id) {
          if (!syncError) message('Cloud sync could not save progress. It is saved on this device and will retry.');
          syncError = { code: String(error?.code || 'NETWORK_ERROR'), status: error?.status || null };
        }
      } finally { saving = null; if (pending.size && owner === user?.id) { clearTimeout(timer); timer = setTimeout(flush, 10000); } }
    })();
    return saving;
  }
  function clearContent() {
    for (const s of window.SUBJECTS) for (const m of s.modules) for (const key of ['cards','mcq','bonus','facts','cardIds','questionIds','bonusIds','cardMeta','questionMeta','bonusMeta','note','videos','captions','verification']) delete m[key];
  }
  async function load(session) {
    const ticket = ++generation;
    const previousUser=user?.id;
    writeCache();
    clearTimeout(timer); clearContent(); state = empty(); pending = new Map();
    user = session?.user || null;
    syncError = null;
    if(previousUser&&previousUser!==user?.id&&window.PrivateStudyCache)PrivateStudyCache.remove(previousUser).catch(()=>{});
    onChange('loading');
    if (!user) { onChange('signed-out'); return; }
    const id = user.id;
    // Separate cache per account; legacy guest data is deliberately never merged.
    try {
      const stored = JSON.parse(localStorage.getItem(cacheKey(id)));
      if (stored?.state) state = { ...empty(), ...stored.state };
      state.last = safeLast(state.last);
      pending = new Map((stored?.pending || []).filter(([,row]) => row.user_id === id));
    } catch {}
    try {
      const progressRequest = (async () => {
        const rows = [];
        for (let offset = 0; ; offset += 1000) {
          const page = await client.from('study_progress').select('kind,item_id,payload').eq('user_id', id).order('kind').order('item_id').range(offset, offset + 999);
          if (page.error) throw page.error;
          rows.push(...page.data);
          if (page.data.length < 1000) return rows;
        }
      })();
      const [{data: modules, error}, progress] = await Promise.all([
        client.from('study_modules').select('subject,module_id,payload'), progressRequest
      ]);
      if (error) throw error;
      if (ticket !== generation) return;
      if(window.PrivateStudyCache)PrivateStudyCache.save(id,modules).catch(()=>{});
      for (const row of modules) {
        const m = window.SUBJECTS.find(s => s.slug === row.subject || s.sourceSlugs?.includes(row.subject))?.modules.find(m => m.id === row.module_id);
        if (m) Object.assign(m, row.payload);
      }
      // Server progress is authoritative on fresh sign-in. Offline changes stay cached.
      for (const row of progress) {
        const payload = devicePayload(row.payload);
        if (row.kind === 'last') state.last = safeLast(payload);
        else if (['box','mcq','position'].includes(row.kind)) state[row.kind][row.item_id] = payload;
      }
      for (const [,row] of pending) {
        if (row.kind === 'last') state.last = safeLast(row.payload);
        else if (['box','mcq','position'].includes(row.kind)) state[row.kind][row.item_id] = row.payload;
      }
      cache(); onChange('ready');
      flush();
    } catch {
      if(ticket===generation&&window.PrivateStudyCache&&navigator.onLine===false){
        try{const cached=await PrivateStudyCache.read(id);if(cached?.modules&&ticket===generation){for(const row of cached.modules){const m=window.SUBJECTS.find(s=>s.slug===row.subject||s.sourceSlugs?.includes(row.subject))?.modules.find(m=>m.id===row.module_id);if(m)Object.assign(m,row.payload);}onChange('ready');message('Offline: using study material saved for this account.');return;}}catch{}
      }
      if (ticket === generation) { clearContent(); onChange('error'); }
    }
  }
  async function start(callback) {
    onChange = callback;
    const cfg = window.LEARN_SKIT_CONFIG;
    if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey || !window.supabase) { callback('unconfigured'); return; }
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } });
    client.auth.onAuthStateChange((event, session) => {
      // Leave the auth callback before awaiting other Supabase calls.
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && session?.user.id !== user?.id)) setTimeout(() => load(session), 0);
      if (event === 'TOKEN_REFRESHED') setTimeout(() => { flush(); retryRpcs(); }, 0);
    });
    const params = new URLSearchParams(location.search);
    if (params.has('error')) { message('Google sign-in was cancelled or failed. Please try again.'); history.replaceState(null, '', location.pathname + location.hash); }
    if (params.has('code')) {
      // detectSessionInUrl exchanges the code. getSession waits for initialization.
      const { error } = await client.auth.getSession();
      if (error) message('Sign-in could not finish. Please try again.');
      const nextTarget = params.get('next');
      history.replaceState(null, '', location.pathname + (nextTarget ? (nextTarget.startsWith('#') ? nextTarget : '#' + nextTarget) : (location.hash || '#/')));
    }
  }
  async function signIn(nextTarget) {
    if (!client) return message('Google sign-in needs the Supabase project configuration.');
    const redirect = new URL(location.pathname, location.origin);
    const searchParams = new URLSearchParams(location.search);
    const target = nextTarget || searchParams.get('next') || (location.hash !== '#/' ? location.hash : '');
    if (target) {
      redirect.searchParams.set('next', target.startsWith('#') ? target : '#' + target);
    }
    const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect.href } });
    if (error) message('Unable to open Google sign-in. Please try again.');
  }
  async function signOut() {
    await flush();
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) return message('Could not sign out. Please try again.');
    if(window.PrivateStudyCache&&user)await PrivateStudyCache.remove(user.id).catch(()=>{});
    await load(null);
  }
  addEventListener('online', () => flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) writeCache(); flush(); if (!document.hidden) retryRpcs(); });
  addEventListener('pagehide', () => {
    writeCache();
    if (!client || !user || !pending.size) return;
    // keepalive supports the Authorization header required by RLS.
    client.auth.getSession().then(({data}) => {
      if (!data.session) return;
      fetch(`${window.LEARN_SKIT_CONFIG.supabaseUrl}/rest/v1/study_progress?on_conflict=user_id,kind,item_id`, {
        method:'POST', keepalive:true, headers:{ apikey:window.LEARN_SKIT_CONFIG.supabaseAnonKey, Authorization:`Bearer ${data.session.access_token}`, 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates' }, body:JSON.stringify([...pending.values()].map(cloudRow))
      }).catch(() => {});
    });
  });
  async function rpc(name,args={}) { if(!client||!user)throw Error('Sign in required');const {data,error}=await client.rpc(name,args);if(error)throw error;return data; }
  async function queueRpc(name,args) { const owner=user?.id,id=args.p_id||crypto.randomUUID(),key='_rpc:'+id;if(!owner)return;state.position[key]={name,args};cache();try{await rpc(name,args);if(user?.id===owner){delete state.position[key];cache();}}catch{} }
  let retrying=false;
  async function retryRpcs(){if(retrying)return;retrying=true;const owner=user?.id;try{for(const [key,value] of Object.entries(state.position))if(key.startsWith('_rpc:')&&value){try{await rpc(value.name,value.args);if(user?.id!==owner)return;delete state.position[key];cache();}catch{break;}}}finally{retrying=false;}}
  addEventListener('online',retryRpcs);
  async function deleteAccount(){await rpc('study_delete_account');const id=user.id;try{localStorage.removeItem(cacheKey(id));}catch{}pending.clear();state=empty();await signOut();}
  return { start, signIn, signOut, message, rpc,queueRpc,retryRpcs,deleteAccount, retry: () => client.auth.getSession().then(({data}) => load(data.session)), videoUrl: path => client.storage.from('study-videos').createSignedUrl(path, 3600), courseUrls: paths => client.storage.from('study-videos').createSignedUrls(paths, 21600), get user() { return user; }, get state() { return state; }, get syncStatus() { return { pending: pending.size, error: syncError }; }, put, flush };
})();
