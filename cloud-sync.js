/* Draft adapter. No page currently loads this file. Uploads require enableUpload(). */
window.CloudSync = (() => {
  const CONFIG_KEY = 'project-notebook-cloud-config-v1';
  const SESSION_KEY = 'project-notebook-cloud-session-v1';
  const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
  let config = read(CONFIG_KEY);
  let session = read(SESSION_KEY);
  let revision = null;
  let callbacks = {};
  let pending = null;
  let saving = false;
  let conflict = false;
  let uploadEnabled = false;
  let retryTimer = null;
  let pollTimer = null;

  function configured() { return Boolean(config?.url && config?.key); }
  function signedIn() { return Boolean(configured() && session?.access_token && session?.user?.id); }
  function notify(state, detail = '') { callbacks.status?.(state, detail); }
  function setConfig(url, key) {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const cleanKey = key.trim();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cleanUrl)) throw new Error('Enter a valid https://…supabase.co project URL.');
    if (!cleanKey || /\s/.test(cleanKey)) throw new Error('Enter the project’s publishable or anon key.');
    if (config?.url !== cleanUrl || config?.key !== cleanKey) {
      session = null;
      localStorage.removeItem(SESSION_KEY);
      revision = null;
      pending = null;
      conflict = false;
      uploadEnabled = false;
    }
    config = { url: cleanUrl, key: cleanKey };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    notify(signedIn() ? 'connected' : 'ready');
  }
  function storeSession(value) {
    session = { ...value, expires_at: Date.now() + (Number(value.expires_in) || 3600) * 1000 };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  async function raw(path, options = {}) {
    if (!configured()) throw new Error('Save the cloud connection first.');
    const headers = { apikey: config.key, ...options.headers };
    if (options.auth !== false) {
      await ensureSession();
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await fetch(`${config.url}${path}`, { method: options.method || 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    } catch { throw new Error('Cannot reach Supabase. Check the connection and try again.'); }
    const body = await response.text();
    let value = null;
    if (body) { try { value = JSON.parse(body); } catch { value = body; } }
    if (!response.ok) throw new Error(value?.msg || value?.message || value?.error_description || value?.error || `Cloud request failed (${response.status}).`);
    return value;
  }
  async function ensureSession() {
    if (!session?.refresh_token) throw new Error('Sign in to continue syncing.');
    if (session.expires_at > Date.now() + 60000) return;
    try {
      const next = await raw('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: session.refresh_token } });
      storeSession(next);
    } catch (error) {
      session = null;
      localStorage.removeItem(SESSION_KEY);
      notify('signed_out', error.message);
      throw error;
    }
  }
  async function signIn(email, password) {
    const value = await raw('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email, password } });
    storeSession(value);
    revision = null;
    conflict = false;
    uploadEnabled = false;
    notify('connecting');
    return value;
  }
  async function signUp(email, password) {
    const value = await raw('/auth/v1/signup', { method: 'POST', auth: false, body: { email, password } });
    if (value?.access_token) storeSession(value);
    return value;
  }
  function signOut() {
    session = null;
    revision = null;
    pending = null;
    conflict = false;
    uploadEnabled = false;
    clearTimeout(retryTimer);
    clearInterval(pollTimer);
    localStorage.removeItem(SESSION_KEY);
    notify('signed_out');
  }
  const rowPath = () => `/rest/v1/notebooks?user_id=eq.${encodeURIComponent(session.user.id)}`;
  async function getRow() {
    const rows = await raw(`${rowPath()}&select=payload,revision&limit=1`);
    return rows?.[0] || null;
  }
  async function insert(payload) {
    const rows = await raw('/rest/v1/notebooks', { method: 'POST', headers: { Prefer: 'return=representation' }, body: { user_id: session.user.id, payload, revision: 1 } });
    revision = rows?.[0]?.revision || 1;
  }
  async function update(payload) {
    const rows = await raw(`${rowPath()}&revision=eq.${revision}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: { payload, revision: revision + 1, updated_at: new Date().toISOString() } });
    if (!rows?.length) {
      conflict = true;
      notify('conflict');
      callbacks.conflict?.();
      return false;
    }
    revision = rows[0].revision;
    return true;
  }
  async function connect(localPayload) {
    if (!signedIn()) return;
    notify('connecting');
    try {
      const row = await getRow();
      if (row) {
        revision = row.revision;
        conflict = false;
        pending = null;
        callbacks.remote?.(row.payload, localPayload);
      } else {
        revision = null;
        notify('empty');
        return;
      }
      notify('connected');
      clearInterval(pollTimer);
      pollTimer = setInterval(checkForUpdates, 15000);
    } catch (error) { notify('error', error.message); throw error; }
  }
  function queueSave(payload) {
    if (!uploadEnabled || !signedIn() || revision === null) return;
    pending = JSON.parse(JSON.stringify(payload));
    if (!saving && !conflict) { clearTimeout(retryTimer); retryTimer = setTimeout(flush, 350); }
  }
  async function flush() {
    if (saving || conflict || !signedIn() || revision === null) return;
    saving = true;
    while (pending && !conflict) {
      const payload = pending;
      pending = null;
      notify('syncing');
      try {
        const saved = await update(payload);
        if (!saved) { if (!pending) pending = payload; break; }
      } catch (error) {
        if (!pending) pending = payload;
        notify('error', error.message);
        retryTimer = setTimeout(flush, 5000);
        break;
      }
    }
    saving = false;
    if (!pending && !conflict && signedIn()) notify('connected');
  }
  async function checkForUpdates() {
    if (!signedIn() || revision === null || pending || saving || conflict || document.hidden) return;
    try {
      const row = await getRow();
      if (row && row.revision !== revision) {
        revision = row.revision;
        callbacks.remote?.(row.payload, null);
      }
      notify('connected');
    } catch (error) { notify('error', error.message); }
  }
  async function useCloud() {
    const row = await getRow();
    if (!row) throw new Error('No cloud copy found.');
    revision = row.revision;
    pending = null;
    conflict = false;
    callbacks.remote?.(row.payload, null);
    notify('connected');
  }
  async function replaceCloud(payload) {
    const row = await getRow();
    if (!row) { await insert(payload); }
    else {
      revision = row.revision;
      conflict = false;
      if (!await update(payload)) throw new Error('The cloud copy changed again. Please retry.');
    }
    pending = null;
    notify('connected');
  }
  async function enableUpload(payload) {
    if (!signedIn()) throw new Error('Sign in first.');
    if (revision === null) await insert(payload);
    uploadEnabled = true;
    notify('connected');
  }
  function on(callbackSet) { callbacks = callbackSet; }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdates(); });
  return { get config() { return config; }, get session() { return session; }, configured, signedIn, setConfig, signIn, signUp, signOut, connect, enableUpload, queueSave, useCloud, replaceCloud, on, checkForUpdates };
})();
