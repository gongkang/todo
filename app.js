// TODO PWA 应用主要功能
class TodoApp {
    constructor() {
        this.todos = [];
        this.currentId = 1;
        this.isOnline = navigator.onLine;
        
        // DOM 元素
        this.todoForm = document.getElementById('todo-form');
        this.todoInput = document.getElementById('todo-input');
        this.todoList = document.getElementById('todo-list');
        this.emptyState = document.getElementById('empty-state');
        this.totalTasks = document.getElementById('total-tasks');
        this.completedTasks = document.getElementById('completed-tasks');
        this.clearCompleted = document.getElementById('clear-completed');
        this.clearAll = document.getElementById('clear-all');
        this.offlineIndicator = document.getElementById('offline-indicator');
        this.installBtn = document.getElementById('install-btn');
        this.installPrompt = document.getElementById('install-prompt');
        this.installToast = document.getElementById('install-toast');
        
        this.init();
    }
    
    init() {
        this.loadTodos();
        this.bindEvents();
        this.updateUI();
        this.checkOnlineStatus();
        this.registerServiceWorker();
        this.handleInstallPrompt();
        
        // 检查 URL 参数
        this.handleUrlParams();
    }
    
    // 从 localStorage 加载任务
    loadTodos() {
        try {
            const savedTodos = localStorage.getItem('todos');
            if (savedTodos) {
                this.todos = JSON.parse(savedTodos);
                // 为旧任务添加默认进度值
                this.todos.forEach(todo => {
                    if (typeof todo.progress === 'undefined') {
                        todo.progress = todo.completed ? 100 : 0;
                    }
                });
                // 确保 ID 从最大值开始
                this.currentId = Math.max(...this.todos.map(todo => todo.id), 0) + 1;
            }
        } catch (error) {
            console.error('加载任务失败:', error);
            this.todos = [];
        }
    }
    
    // 保存到 localStorage
    saveTodos() {
        try {
            localStorage.setItem('todos', JSON.stringify(this.todos));
        } catch (error) {
            console.error('保存任务失败:', error);
            this.showNotification('保存失败', 'error');
        }
    }
    
    // 绑定事件
    bindEvents() {
        // 表单提交
        this.todoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTodo();
        });
        
        // 清除已完成任务
        this.clearCompleted.addEventListener('click', () => {
            this.clearCompletedTodos();
        });
        
        // 清除所有任务
        this.clearAll.addEventListener('click', () => {
            if (confirm('确定要清除所有任务吗？')) {
                this.clearAllTodos();
            }
        });
        
        // 网络状态监听
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.checkOnlineStatus();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.checkOnlineStatus();
        });
        
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'Enter':
                        e.preventDefault();
                        this.todoInput.focus();
                        break;
                    case 'Backspace':
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.clearCompletedTodos();
                        }
                        break;
                }
            }
            
            // 进度调整快捷键（选中任务时）
            if (e.target.closest('.todo-item')) {
                const todoItem = e.target.closest('.todo-item');
                const todoId = parseInt(todoItem.getAttribute('data-id'));
                
                if (e.key === '+' || e.key === '=') {
                    e.preventDefault();
                    const currentProgress = this.getTodoProgress(todoId);
                    this.updateTodoProgress(todoId, Math.min(100, currentProgress + 10));
                } else if (e.key === '-') {
                    e.preventDefault();
                    const currentProgress = this.getTodoProgress(todoId);
                    this.updateTodoProgress(todoId, Math.max(0, currentProgress - 10));
                }
            }
        });
    }
    
    // 添加任务
    addTodo() {
        const text = this.todoInput.value.trim();
        if (!text) return;
        
        const todo = {
            id: this.currentId++,
            text: text,
            completed: false,
            progress: 0,
            createdAt: new Date().toISOString(),
            completedAt: null
        };
        
        this.todos.unshift(todo); // 新任务添加到顶部
        this.todoInput.value = '';
        this.saveTodos();
        this.updateUI();
        this.showNotification('任务添加成功');
        
        // 如果是通过快捷方式访问，聚焦输入框
        if (window.location.search.includes('action=new')) {
            this.todoInput.focus();
        }
    }
    
    // 切换任务完成状态
    toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            todo.progress = todo.completed ? 100 : (todo.progress || 0);
            todo.completedAt = todo.completed ? new Date().toISOString() : null;
            this.saveTodos();
            this.updateUI();
            
            const status = todo.completed ? '已完成' : '未完成';
            this.showNotification(`任务标记为${status}`);
        }
    }
    
    // 更新任务进度
    updateTodoProgress(id, progress, skipUIUpdate = false) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.progress = Math.round(Math.max(0, Math.min(100, progress)));
            todo.completed = todo.progress >= 100;
            todo.completedAt = todo.completed ? new Date().toISOString() : null;
            this.saveTodos();
            
            if (!skipUIUpdate) {
                this.updateUI();
                this.showNotification(`任务进度更新为 ${todo.progress}%`);
            }
        }
    }
    
    // 删除任务
    deleteTodo(id) {
        // 重置所有滑动状态
        this.resetAllSwipeStates();
        
        const todoElement = document.querySelector(`[data-id="${id}"]`);
        if (todoElement) {
            todoElement.classList.add('removing');
            setTimeout(() => {
                this.todos = this.todos.filter(t => t.id !== id);
                this.saveTodos();
                this.updateUI();
                this.showNotification('任务已删除');
            }, 300);
        }
    }
    
    // 清除已完成任务
    clearCompletedTodos() {
        const completedCount = this.todos.filter(t => t.completed).length;
        if (completedCount === 0) {
            this.showNotification('没有已完成的任务');
            return;
        }
        
        if (confirm(`确定要清除 ${completedCount} 个已完成的任务吗？`)) {
            this.todos = this.todos.filter(t => !t.completed);
            this.saveTodos();
            this.updateUI();
            this.showNotification(`已清除 ${completedCount} 个任务`);
        }
    }
    
    // 清除所有任务
    clearAllTodos() {
        this.todos = [];
        this.saveTodos();
        this.updateUI();
        this.showNotification('所有任务已清除');
    }
    
    // 更新UI
    updateUI() {
        this.renderTodos();
        this.updateStats();
    }
    
    // 渲染任务列表
    renderTodos() {
        this.todoList.innerHTML = '';
        
        if (this.todos.length === 0) {
            this.emptyState.classList.remove('hidden');
            return;
        }
        
        this.emptyState.classList.add('hidden');
        
        this.todos.forEach(todo => {
            const li = this.createTodoElement(todo);
            this.todoList.appendChild(li);
        });
        
        // 初始化拖拽功能
        this.initDragHandlers();
    }
    
    // 创建任务元素
    createTodoElement(todo) {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        li.setAttribute('data-id', todo.id);
        
        const createdTime = new Date(todo.createdAt).toLocaleString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // 格式化完成时间
        let completedTime = '';
        if (todo.completed && todo.completedAt) {
            completedTime = new Date(todo.completedAt).toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        const progress = todo.progress || 0;
        
        li.innerHTML = `
            <div class="todo-content-wrapper">
                <div class="task-header">
                    <input 
                        type="checkbox" 
                        class="todo-checkbox desktop-checkbox" 
                        ${todo.completed ? 'checked' : ''}
                        onchange="todoApp.toggleTodo(${todo.id})"
                    >
                    <div class="mobile-task-content">
                        <div class="task-text-with-progress">
                            <span class="todo-text">${this.escapeHtml(todo.text)}</span>
                            <div class="inline-progress-bar">
                                <div class="inline-progress-fill" style="width: ${Math.round(progress)}%"></div>
                                <div class="inline-progress-handle" 
                                     data-todo-id="${todo.id}"
                                     style="left: ${Math.round(progress)}%"
                                     title="拖拽调整进度">
                                </div>
                            </div>
                        </div>
                    </div>
                    <span class="progress-percentage">${Math.round(progress)}%</span>
                    <div class="todo-times">
                        <span class="todo-time created-time" title="创建时间">${createdTime}</span>
                        ${todo.completed && completedTime ? `<span class="todo-time completed-time" title="完成时间">${completedTime}</span>` : ''}
                    </div>
                    <button 
                        class="delete-btn desktop-delete" 
                        onclick="todoApp.deleteTodo(${todo.id})"
                        title="删除任务"
                    >
                        ×
                    </button>
                </div>
            </div>
            <div class="swipe-delete-area">
                <button class="swipe-delete-btn" onclick="todoApp.deleteTodo(${todo.id})">
                    <span>删除</span>
                </button>
            </div>
            <div class="swipe-complete-area">
                <button class="swipe-complete-btn" onclick="todoApp.toggleTodo(${todo.id})">
                    <span>${todo.completed ? '取消' : '完成'}</span>
                </button>
            </div>
        `;
        
        // 添加左滑删除功能
        this.addSwipeToDelete(li, todo.id);
        
        return li;
    }
    
    // 更新统计信息
    updateStats() {
        const total = this.todos.length;
        const completed = this.todos.filter(t => t.completed).length;
        
        // 计算平均进度
        let averageProgress = 0;
        if (total > 0) {
            const totalProgress = this.todos.reduce((sum, todo) => sum + (todo.progress || 0), 0);
            averageProgress = Math.round(totalProgress / total);
        }
        
        this.totalTasks.textContent = `总任务: ${total}`;
        this.completedTasks.textContent = `已完成: ${completed} (平均进度: ${averageProgress}%)`;
    }
    
    // 只更新统计信息（用于拖拽过程中）
    updateStatsOnly(currentTodoId, currentProgress) {
        const total = this.todos.length;
        let completed = 0;
        let totalProgress = 0;
        
        this.todos.forEach(todo => {
            if (todo.id === currentTodoId) {
                // 使用当前拖拽的进度
                totalProgress += currentProgress;
                if (currentProgress >= 100) completed++;
            } else {
                totalProgress += (todo.progress || 0);
                if (todo.completed) completed++;
            }
        });
        
        const averageProgress = total > 0 ? Math.round(totalProgress / total) : 0;
        
        this.totalTasks.textContent = `总任务: ${total}`;
        this.completedTasks.textContent = `已完成: ${completed} (平均进度: ${averageProgress}%)`;
    }
    
    // 检查网络状态
    checkOnlineStatus() {
        if (this.isOnline) {
            this.offlineIndicator.classList.remove('show');
        } else {
            this.offlineIndicator.classList.add('show');
        }
    }
    
    // 注册 Service Worker
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker 注册成功:', registration);
                
                // 监听更新
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showNotification('应用已更新，请刷新页面');
                        }
                    });
                });
            } catch (error) {
                console.error('Service Worker 注册失败:', error);
            }
        }
    }
    
    // 处理 PWA 安装
    handleInstallPrompt() {
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            this.installPrompt.classList.remove('hidden');
        });
        
        this.installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                
                if (outcome === 'accepted') {
                    this.showInstallToast();
                }
                
                deferredPrompt = null;
                this.installPrompt.classList.add('hidden');
            }
        });
        
        window.addEventListener('appinstalled', () => {
            this.showInstallToast();
            this.installPrompt.classList.add('hidden');
        });
    }
    
    // 显示安装成功提示
    showInstallToast() {
        this.installToast.classList.add('show');
        setTimeout(() => {
            this.installToast.classList.remove('show');
        }, 3000);
    }
    
    // 处理 URL 参数
    handleUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'new') {
            setTimeout(() => {
                this.todoInput.focus();
            }, 100);
        }
    }
    
    // 显示通知
    showNotification(message, type = 'success') {
        // 简单的通知实现，可以扩展为更复杂的通知系统
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // 如果浏览器支持通知API且在离线状态，显示系统通知
        if ('Notification' in window && !this.isOnline && Notification.permission === 'granted') {
            new Notification('todo', {
                body: message,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png'
            });
        }
    }
    
    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 导出数据
    exportData() {
        const data = {
            todos: this.todos,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `todos-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('数据导出成功');
    }
    
    // 导入数据
    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.todos && Array.isArray(data.todos)) {
                    this.todos = data.todos;
                    this.currentId = Math.max(...this.todos.map(todo => todo.id), 0) + 1;
                    this.saveTodos();
                    this.updateUI();
                    this.showNotification(`成功导入 ${data.todos.length} 个任务`);
                } else {
                    throw new Error('无效的数据格式');
                }
            } catch (error) {
                console.error('导入失败:', error);
                this.showNotification('导入失败，请检查文件格式', 'error');
            }
        };
        reader.readAsText(file);
    }
    
    // 初始化拖拽处理器
    initDragHandlers() {
        const handles = document.querySelectorAll('.inline-progress-handle');
        console.log('找到进度条手柄数量:', handles.length);
        
        handles.forEach((handle, index) => {
            console.log(`初始化第${index + 1}个手柄，ID:`, handle.getAttribute('data-todo-id'));
            this.makeDraggable(handle);
        });
        
        // 为进度条添加点击事件
        const progressBars = document.querySelectorAll('.inline-progress-bar');
        progressBars.forEach(bar => {
            this.addProgressBarClickHandler(bar);
        });
    }
    
    // 使元素可拖拽
    makeDraggable(handle) {
        console.log('开始初始化手柄拖拽，手柄元素:', handle);
        let isDragging = false;
        let startX = 0;
        let startProgress = 0;
        let currentProgress = 0; // 跟踪当前进度
        
        const todoId = parseInt(handle.getAttribute('data-todo-id'));
        console.log('手柄的任务ID:', todoId);
        const progressBar = handle.closest('.inline-progress-bar');
        console.log('找到的进度条:', progressBar);
        const progressFill = progressBar.querySelector('.inline-progress-fill');
        const progressText = handle.closest('.task-header').querySelector('.progress-percentage');
        
        // 鼠标事件
        handle.addEventListener('mousedown', (e) => {
            console.log('🖱️ 鼠标按下事件触发，任务ID:', todoId);
            console.log('事件目标:', e.target, '是否为手柄:', e.target === handle);
            console.log('手柄的 data-todo-id:', handle.getAttribute('data-todo-id'));
            isDragging = true;
            startX = e.clientX;
            startProgress = this.getTodoProgress(todoId);
            currentProgress = startProgress; // 初始化当前进度
            console.log('开始拖拽，起始位置:', startX, '起始进度:', startProgress);
            document.body.style.userSelect = 'none';
            handle.classList.add('dragging');
            // 添加拖拽类以禁用过渡效果
            handle.closest('.todo-item').classList.add('dragging-progress');
            e.preventDefault();
            e.stopPropagation(); // 阻止事件冒泡
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            console.log('🖱️ 鼠标移动，当前位置:', e.clientX, '起始位置:', startX);
            
            const rect = progressBar.getBoundingClientRect();
            const deltaX = e.clientX - startX;
            const deltaProgress = (deltaX / rect.width) * 100;
            const newProgress = Math.round(Math.max(0, Math.min(100, startProgress + deltaProgress)));
            currentProgress = newProgress; // 更新当前进度
            
            console.log('进度变化:', newProgress, '从', startProgress, '到', newProgress);
            
            // 只更新视觉效果，不重新渲染 UI
            this.updateProgressDisplay(handle, progressFill, progressText, newProgress);
            // 更新复选框状态
            const checkbox = handle.closest('.todo-item').querySelector('.todo-checkbox');
            checkbox.checked = newProgress >= 100;
            // 更新统计信息（不重新渲染列表）
            this.updateStatsOnly(todoId, newProgress);
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                console.log('🖱️ 鼠标释放，结束拖拽');
                isDragging = false;
                document.body.style.userSelect = '';
                handle.classList.remove('dragging');
                // 移除拖拽类恢复过渡效果
                handle.closest('.todo-item').classList.remove('dragging-progress');
                
                console.log('最终进度:', currentProgress);
                // 拖拽结束后才完整更新 UI
                this.updateTodoProgress(todoId, currentProgress);
            }
        });
        
        // 触摸事件（移动设备支持）
        handle.addEventListener('touchstart', (e) => {
            console.log('👍 进度条手柄触摸开始事件触发，任务ID:', todoId);
            console.log('触摸目标:', e.target, '是否为手柄:', e.target === handle);
            isDragging = true;
            startX = e.touches[0].clientX;
            startProgress = this.getTodoProgress(todoId);
            currentProgress = startProgress; // 初始化当前进度
            handle.classList.add('dragging');
            // 添加拖拽类以禁用过渡效果
            handle.closest('.todo-item').classList.add('dragging-progress');
            e.preventDefault();
            e.stopPropagation(); // 阻止事件冒泡
        }, { passive: false });
        
        // 直接在手柄上绑定触摸移动事件
        handle.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            
            console.log('👍 进度条手柄触摸移动，当前位置:', e.touches[0].clientX, '起始位置:', startX);
            
            const rect = progressBar.getBoundingClientRect();
            const deltaX = e.touches[0].clientX - startX;
            const deltaProgress = (deltaX / rect.width) * 100;
            const newProgress = Math.round(Math.max(0, Math.min(100, startProgress + deltaProgress)));
            currentProgress = newProgress; // 更新当前进度
            
            console.log('手柄触摸进度变化:', newProgress, '从', startProgress, '到', newProgress);
            
            // 只更新视觉效果，不重新渲染 UI
            this.updateProgressDisplay(handle, progressFill, progressText, newProgress);
            // 更新复选框状态
            const checkbox = handle.closest('.todo-item').querySelector('.todo-checkbox');
            checkbox.checked = newProgress >= 100;
            // 更新统计信息（不重新渲染列表）
            this.updateStatsOnly(todoId, newProgress);
            e.preventDefault();
        }, { passive: false });
        
        // 直接在手柄上绑定触摸结束事件
        handle.addEventListener('touchend', (e) => {
            if (isDragging) {
                console.log('👍 进度条手柄触摸结束，最终进度:', currentProgress);
                isDragging = false;
                handle.classList.remove('dragging');
                // 移除拖拽类恢复过渡效果
                handle.closest('.todo-item').classList.remove('dragging-progress');
                
                // 触摸结束后才完整更新 UI
                this.updateTodoProgress(todoId, currentProgress);
            }
            e.preventDefault();
        }, { passive: false });
    }
    
    // 添加左滑删除和右滑完成功能
    addSwipeToDelete(todoElement, todoId) {
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let isDragging = false;
        let isSwipeDeleteActive = false;
        let isSwipeCompleteActive = false;
        let hasMovedHorizontally = false;
        
        const contentWrapper = todoElement.querySelector('.todo-content-wrapper');
        const deleteArea = todoElement.querySelector('.swipe-delete-area');
        const completeArea = todoElement.querySelector('.swipe-complete-area');
        const mobileTaskContent = todoElement.querySelector('.mobile-task-content');
        
        // 触摸开始
        todoElement.addEventListener('touchstart', (e) => {
            // 检查是否在进度条区域内
            if (e.target.closest('.inline-progress-bar') || e.target.closest('.inline-progress-handle')) {
                console.log('触摸在进度条区域，不处理滑动手势');
                return; // 在进度条区域内，不处理滑动
            }
            
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            currentX = startX;
            isDragging = false;
            hasMovedHorizontally = false;
        }, { passive: true });
        
        // 触摸移动
        todoElement.addEventListener('touchmove', (e) => {
            if (!startX) return;
            
            // 检查是否在进度条区域内
            if (e.target.closest('.inline-progress-bar') || e.target.closest('.inline-progress-handle')) {
                console.log('触摸移动在进度条区域，不处理滑动手势');
                return; // 在进度条区域内，不处理滑动
            }
            
            currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const deltaX = currentX - startX;
            const deltaY = currentY - startY;
            
            // 判断是否为水平滑动
            if (!hasMovedHorizontally && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
                hasMovedHorizontally = Math.abs(deltaX) > Math.abs(deltaY);
                if (!hasMovedHorizontally) {
                    return; // 垂直滑动，不处理
                }
            }
            
            if (hasMovedHorizontally) {
                isDragging = true;
                
                if (deltaX < -10) {
                    // 左滑删除 - 动态调整宽度
                    const moveDistance = Math.max(deltaX, -100);
                    const deleteWidth = Math.min(Math.abs(moveDistance), 100);
                    
                    contentWrapper.style.transform = `translateX(${moveDistance}px)`;
                    deleteArea.style.width = `${deleteWidth}px`;
                    deleteArea.style.opacity = Math.abs(moveDistance) / 100;
                    completeArea.style.opacity = 0;
                    completeArea.style.width = '0px';
                    
                    // 超过80px时显示将要直接删除的提示
                    if (Math.abs(deltaX) > 80) {
                        deleteArea.style.background = '#d32f2f'; // 更深的红色
                        deleteArea.querySelector('.swipe-delete-btn span').textContent = '松手删除';
                    } else {
                        deleteArea.style.background = 'var(--danger-color)';
                        deleteArea.querySelector('.swipe-delete-btn span').textContent = '删除';
                    }
                } else if (deltaX > 10) {
                    // 右滑完成 - 动态调整宽度
                    const moveDistance = Math.min(deltaX, 100);
                    const completeWidth = Math.min(moveDistance, 100);
                    
                    contentWrapper.style.transform = `translateX(${moveDistance}px)`;
                    completeArea.style.width = `${completeWidth}px`;
                    completeArea.style.opacity = moveDistance / 100;
                    deleteArea.style.opacity = 0;
                    deleteArea.style.width = '0px';
                    
                    // 超过80px时显示将要直接完成的提示
                    if (deltaX > 80) {
                        completeArea.style.background = '#388e3c'; // 更深的绿色
                        const todo = this.todos.find(t => t.id === todoId);
                        const actionText = todo && todo.completed ? '松手取消' : '松手完成';
                        completeArea.querySelector('.swipe-complete-btn span').textContent = actionText;
                    } else {
                        completeArea.style.background = 'var(--success-color)';
                        const todo = this.todos.find(t => t.id === todoId);
                        const actionText = todo && todo.completed ? '取消' : '完成';
                        completeArea.querySelector('.swipe-complete-btn span').textContent = actionText;
                    }
                } else {
                    // 重置状态
                    contentWrapper.style.transform = 'translateX(0)';
                    deleteArea.style.opacity = 0;
                    completeArea.style.opacity = 0;
                    deleteArea.style.width = '0px';
                    completeArea.style.width = '0px';
                }
                
                e.preventDefault();
            }
        }, { passive: false });
        
        // 触摸结束
        todoElement.addEventListener('touchend', (e) => {
            // 检查是否在进度条区域内
            if (e.target.closest('.inline-progress-bar') || e.target.closest('.inline-progress-handle')) {
                console.log('触摸结束在进度条区域，不处理滑动手势');
                return; // 在进度条区域内，不处理滑动
            }
            
            if (!isDragging) {
                startX = 0;
                return;
            }
            
            const deltaX = currentX - startX;
            
            if (deltaX < -80) {
                // 左滑超过80px，直接删除
                this.deleteTodo(todoId);
            } else if (deltaX < -50) {
                // 左滑超过50px，显示删除按钮
                contentWrapper.style.transform = 'translateX(-80px)';
                deleteArea.style.width = '80px';
                deleteArea.style.opacity = '1';
                completeArea.style.opacity = '0';
                completeArea.style.width = '0px';
                isSwipeDeleteActive = true;
                isSwipeCompleteActive = false;
                todoElement.classList.add('swipe-active');
            } else if (deltaX > 80) {
                // 右滑超过80px，直接完成
                this.toggleTodo(todoId);
                // 短暂显示反馈后恢复
                contentWrapper.style.transform = 'translateX(80px)';
                completeArea.style.opacity = '1';
                setTimeout(() => {
                    this.resetSwipeState(todoElement);
                }, 200);
            } else if (deltaX > 50) {
                // 右滑超过50px，显示完成按钮
                contentWrapper.style.transform = 'translateX(80px)';
                completeArea.style.width = '80px';
                completeArea.style.opacity = '1';
                deleteArea.style.opacity = '0';
                deleteArea.style.width = '0px';
                isSwipeCompleteActive = true;
                isSwipeDeleteActive = false;
                todoElement.classList.add('swipe-active');
            } else {
                // 恢复原状
                this.resetSwipeState(todoElement);
            }
            
            startX = 0;
            isDragging = false;
            hasMovedHorizontally = false;
        });
        
        // 点击其他区域时恢复
        document.addEventListener('touchstart', (e) => {
            if (!todoElement.contains(e.target) && (isSwipeDeleteActive || isSwipeCompleteActive)) {
                this.resetSwipeState(todoElement);
            }
        });
    }
    
    // 重置滑动状态
    resetSwipeState(todoElement) {
        const contentWrapper = todoElement.querySelector('.todo-content-wrapper');
        const deleteArea = todoElement.querySelector('.swipe-delete-area');
        const completeArea = todoElement.querySelector('.swipe-complete-area');
        
        contentWrapper.style.transform = 'translateX(0)';
        deleteArea.style.opacity = '0';
        completeArea.style.opacity = '0';
        deleteArea.style.width = '0px';
        completeArea.style.width = '0px';
        
        // 重置背景色和文字
        deleteArea.style.background = 'var(--danger-color)';
        completeArea.style.background = 'var(--success-color)';
        deleteArea.querySelector('.swipe-delete-btn span').textContent = '删除';
        
        // 重置完成按钮文字
        const todoId = parseInt(todoElement.getAttribute('data-id'));
        const todo = this.todos.find(t => t.id === todoId);
        const actionText = todo && todo.completed ? '取消' : '完成';
        completeArea.querySelector('.swipe-complete-btn span').textContent = actionText;
        
        todoElement.classList.remove('swipe-active');
    }
    
    // 重置所有滑动状态
    resetAllSwipeStates() {
        const activeItems = document.querySelectorAll('.todo-item.swipe-active');
        activeItems.forEach(item => {
            this.resetSwipeState(item);
        });
    }
    
    // 获取任务进度
    getTodoProgress(id) {
        const todo = this.todos.find(t => t.id === id);
        return todo ? (todo.progress || 0) : 0;
    }
    
    // 更新进度显示
    updateProgressDisplay(handle, progressFill, progressText, progress) {
        const roundedProgress = Math.round(progress);
        handle.style.left = `${roundedProgress}%`;
        progressFill.style.width = `${roundedProgress}%`;
        progressText.textContent = `${roundedProgress}%`;
    }
    
    // 为进度条添加点击事件
    addProgressBarClickHandler(progressBar) {
        // 阻止进度条区域的滑动手势
        progressBar.addEventListener('touchstart', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到父元素
        }, { passive: true });
        
        progressBar.addEventListener('touchmove', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到父元素
        }, { passive: false });
        
        progressBar.addEventListener('touchend', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到父元素
        }, { passive: true });
        
        progressBar.addEventListener('click', (e) => {
            const handle = progressBar.querySelector('.inline-progress-handle');
            const todoId = parseInt(handle.getAttribute('data-todo-id'));
            
            const rect = progressBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const newProgress = Math.round(Math.max(0, Math.min(100, (clickX / rect.width) * 100)));
            
            this.updateTodoProgress(todoId, newProgress);
        });
        
        // 双击事件，显示进度输入框
        progressBar.addEventListener('dblclick', (e) => {
            const handle = progressBar.querySelector('.inline-progress-handle');
            const todoId = parseInt(handle.getAttribute('data-todo-id'));
            const currentProgress = this.getTodoProgress(todoId);
            
            const newProgress = prompt('请输入进度百分比 (0-100):', currentProgress);
            if (newProgress !== null) {
                const progress = parseInt(newProgress);
                if (!isNaN(progress) && progress >= 0 && progress <= 100) {
                    this.updateTodoProgress(todoId, progress);
                } else {
                    this.showNotification('请输入 0-100 之间的数字', 'error');
                }
            }
        });
    }
}

// 初始化应用
let todoApp;

document.addEventListener('DOMContentLoaded', () => {
    todoApp = new TodoApp();
    
    // 请求通知权限
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

// 导出到全局作用域，供 HTML 中的事件处理器使用
window.todoApp = todoApp;