const CACHE_NAME = "mies-dashboard-v18";

const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./cloud.js",
  "./config.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
];

// ติดตั้ง: โหลดไฟล์ใหม่จากเซิร์ฟเวอร์เสมอ (ข้ามแคชของเบราว์เซอร์) และไม่ล้มทั้งชุดถ้าไฟล์ใดไฟล์หนึ่งหาย
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          fetch(new Request(url, { cache: "reload" }))
            .then((res) => (res.ok ? cache.put(url, res) : null))
            .catch(() => null)
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ออนไลน์: ดึงเวอร์ชันล่าสุดก่อนเสมอ แล้วเก็บสำเนาไว้ / ออฟไลน์: ใช้สำเนาที่เก็บไว้
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co")) return;

  event.respondWith(
    fetch(req, url.origin === self.location.origin ? { cache: "no-cache" } : undefined)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
