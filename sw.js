// Service Worker for todo
const CACHE_NAME = 'todo-v5.4';
const STATIC_CACHE_NAME = 'todo-static-v5.4';
const DYNAMIC_CACHE_NAME = 'todo-dynamic-v5.4';

// 需要缓存的静态资源
const STATIC_FILES = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/icons/icon-72x72.png',
    '/icons/icon-96x96.png',
    '/icons/icon-128x128.png',
    '/icons/icon-144x144.png',
    '/icons/icon-152x152.png',
    '/icons/icon-192x192.png',
    '/icons/icon-384x384.png',
    '/icons/icon-512x512.png'
];

// 安装事件 - 缓存静态资源
self.addEventListener('install', (event) => {
    console.log('Service Worker 安装中...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => {
                console.log('正在缓存静态文件...');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('静态文件缓存完成');
                return self.skipWaiting(); // 强制激活新的 Service Worker
            })
            .catch((error) => {
                console.error('缓存静态文件失败:', error);
            })
    );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
    console.log('Service Worker 激活中...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // 删除旧版本的缓存
                        if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
                            console.log('删除旧缓存:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker 激活完成');
                return self.clients.claim(); // 立即控制所有页面
            })
    );
});

// 拦截网络请求
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // 只处理 GET 请求
    if (request.method !== 'GET') {
        return;
    }
    
    // 处理静态资源
    if (STATIC_FILES.includes(url.pathname) || url.pathname === '/') {
        event.respondWith(cacheFirst(request));
        return;
    }
    
    // 处理图标资源
    if (url.pathname.startsWith('/icons/')) {
        event.respondWith(cacheFirst(request));
        return;
    }
    
    // 处理其他资源
    event.respondWith(networkFirst(request));
});

// 缓存优先策略（适用于静态资源）
async function cacheFirst(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        
        // 如果网络请求成功，更新缓存
        if (networkResponse.status === 200) {
            const cache = await caches.open(STATIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('缓存优先策略失败:', error);
        
        // 如果是导航请求，返回离线页面
        if (request.destination === 'document') {
            const cachedResponse = await caches.match('/index.html');
            if (cachedResponse) {
                return cachedResponse;
            }
        }
        
        // 返回错误响应
        return new Response('离线状态下无法访问此资源', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// 网络优先策略（适用于动态内容）
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        // 如果网络请求成功，缓存响应
        if (networkResponse.status === 200) {
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('网络请求失败，尝试从缓存获取:', error);
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // 如果是导航请求，返回主页面
        if (request.destination === 'document') {
            const cachedResponse = await caches.match('/index.html');
            if (cachedResponse) {
                return cachedResponse;
            }
        }
        
        // 返回错误响应
        return new Response('离线状态下无法访问此资源', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// 监听消息事件
self.addEventListener('message', (event) => {
    const { action, data } = event.data;
    
    switch (action) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'GET_VERSION':
            event.ports[0].postMessage({
                version: CACHE_NAME,
                static: STATIC_CACHE_NAME,
                dynamic: DYNAMIC_CACHE_NAME
            });
            break;
            
        case 'CLEAR_CACHE':
            clearCache()
                .then(() => {
                    event.ports[0].postMessage({ success: true });
                })
                .catch((error) => {
                    event.ports[0].postMessage({ success: false, error: error.message });
                });
            break;
            
        default:
            console.log('未知消息:', action);
    }
});

// 清理缓存
async function clearCache() {
    const cacheNames = await caches.keys();
    return Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
    );
}

// 后台同步支持（如果浏览器支持）
if ('sync' in self.registration) {
    self.addEventListener('sync', (event) => {
        console.log('后台同步事件:', event.tag);
        
        if (event.tag === 'todo-sync') {
            event.waitUntil(syncTodos());
        }
    });
}

// 同步待办事项（占位功能，可扩展为与服务器同步）
async function syncTodos() {
    try {
        console.log('开始同步待办事项...');
        // 这里可以添加与服务器同步的逻辑
        // 比如上传本地更改，下载服务器更新等
        
        // 通知所有客户端同步完成
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                data: { success: true }
            });
        });
        
        console.log('待办事项同步完成');
    } catch (error) {
        console.error('同步失败:', error);
        
        // 通知客户端同步失败
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                data: { success: false, error: error.message }
            });
        });
    }
}

// 推送通知支持
self.addEventListener('push', (event) => {
    console.log('收到推送消息');
    
    const options = {
        body: '您有新的待办事项提醒',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'todo-reminder',
        renotify: true,
        actions: [
            {
                action: 'view',
                title: '查看',
                icon: '/icons/icon-72x72.png'
            },
            {
                action: 'dismiss',
                title: '忽略'
            }
        ]
    };
    
    if (event.data) {
        try {
            const data = event.data.json();
            options.body = data.message || options.body;
            options.data = data;
        } catch (error) {
            console.error('解析推送数据失败:', error);
        }
    }
    
    event.waitUntil(
        self.registration.showNotification('todo', options)
    );
});

// 通知点击事件
self.addEventListener('notificationclick', (event) => {
    console.log('通知被点击:', event.action);
    
    event.notification.close();
    
    if (event.action === 'view') {
        // 打开应用
        event.waitUntil(
            clients.openWindow('/')
        );
    }
    // 'dismiss' 或其他动作不需要特殊处理
});

// 错误处理
self.addEventListener('error', (event) => {
    console.error('Service Worker 错误:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Service Worker 未处理的 Promise 拒绝:', event.reason);
    event.preventDefault();
});

console.log('Service Worker 脚本加载完成');