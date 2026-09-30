// ===== ตั้งค่า Supabase (ใส่ 2 ค่านี้ตามขั้นตอนในไฟล์ supabase-setup.sql) =====
export const CLOUD = {
  url: "",      // เช่น https://abcdxyz.supabase.co
  anonKey: "",  // Project Settings > API > anon public key
};
// ============================================================================
const SKEY = "mies_session";
const base = () => CLOUD.url.replace(/\/+$/, "");
export const cloudConfigured = () => !!(CLOUD.url && CLOUD.anonKey);

function readSession() { try { return JSON.parse(localStorage.getItem(SKEY)); } catch (e) { return null; } }
function writeSession(s) { try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch (e) {} }
function toSession(j) {
  return { access_token: j.access_token, refresh_token: j.refresh_token,
    expires_at: Date.now() + (j.expires_in - 30) * 1000, user_id: j.user && j.user.id };
}
export function getSession() { return readSession(); }
export function signOut() { writeSession(null); }

export async function signIn(email, password) {
  const r = await fetch(base() + "/auth/v1/token?grant_type=password", {
    method: "POST", headers: { apikey: CLOUD.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.msg || "เข้าสู่ระบบไม่สำเร็จ");
  const s = toSession(j); writeSession(s); return s;
}

async function activeSession() {
  let s = readSession();
  if (!s) throw new Error("session expired");
  if (Date.now() < s.expires_at) return s;
  const r = await fetch(base() + "/auth/v1/token?grant_type=refresh_token", {
    method: "POST", headers: { apikey: CLOUD.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: s.refresh_token }),
  });
  if (r.status === 400 || r.status === 401) { writeSession(null); throw new Error("session expired"); }
  if (!r.ok) throw new Error("refresh failed");
  s = toSession(await r.json()); writeSession(s); return s;
}

export async function loadRemote() {
  const s = await activeSession();
  const r = await fetch(base() + "/rest/v1/app_state?select=data&limit=1", {
    headers: { apikey: CLOUD.anonKey, Authorization: "Bearer " + s.access_token },
  });
  if (!r.ok) throw new Error("load failed " + r.status);
  const rows = await r.json();
  return rows.length ? rows[0].data : null;
}

export async function saveRemote(data) {
  const s = await activeSession();
  const r = await fetch(base() + "/rest/v1/app_state?on_conflict=user_id", {
    method: "POST",
    headers: { apikey: CLOUD.anonKey, Authorization: "Bearer " + s.access_token,
      "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ user_id: s.user_id, data, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error("save failed " + r.status);
}
