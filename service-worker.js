const CACHE_NAME = 'mei-na-mao-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json'
    // Adicione aqui os caminhos para icon-192.png e icon-512.png
];

// Instalação: Armazena todos os ativos
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache de ativos aberto');
                return cache.addAll(urlsToCache);
            })
            .catch(err => {
                console.error('Falha ao carregar cache:', err);
            })
    );
});

// Busca: Serve os ativos do cache quando possível
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Retorna o cache se encontrado, senão faz requisição normal
                return response || fetch(event.request);
            })
    );
});

// Ativação: Limpa caches antigos
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});