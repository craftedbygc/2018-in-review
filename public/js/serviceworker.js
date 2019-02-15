const latest = {
    cache: 'some-cache-name/v1'
};
  
self.addEventListener('install', event => {
event.waitUntil(
    caches.open(latest.cache).then(cache => {
    return cache.addAll([
        '/'
    ]);
    })
);
});

self.addEventListener('fetch', event => {
// exclude requests that start with chrome-extension://
if (event.request.url.startsWith('chrome-extension://')) return;
event.respondWith(
    caches.open(latest.cache).then(cache => {
    return cache.match(event.request).then(response => {
        var fetchPromise = fetch(event.request).then(networkResponse => {
        cache.put(event.request, networkResponse.clone());
        return networkResponse;
        })
        return response || fetchPromise;
    })
    })
);
});

self.addEventListener('activate', event => {
event.waitUntil(
    caches.keys().then(cacheNames => {
    return Promise.all(
        cacheNames.filter(cacheName => {
        if (cacheName === latest.cache) {
            return false;
        }

        return true;
        }).map(cacheName => {
        return caches.delete(cacheName)
        })
    );
    })
);
});