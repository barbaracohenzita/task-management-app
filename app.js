document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'taskManagementApp.tasks.v2';
    const THEME_KEY = 'taskManagementApp.theme';
    const TAG_COLORS = ['tag-blue', 'tag-green', 'tag-orange', 'tag-purple', 'tag-pink', 'tag-teal'];

    const taskForm = document.querySelector('#task-form form');
    const taskList = document.querySelector('#tasks-root');
    const searchInput = document.querySelector('#task-search');
    const themeToggle = document.querySelector('#theme-toggle');
    const progressFill = document.querySelector('#progress-fill');
    const progressText = document.querySelector('#progress-text');
    const toast = document.querySelector('#toast');
    const toastText = document.querySelector('#toast-text');
    const undoBtn = document.querySelector('#undo-btn');

    const formTitle = document.querySelector('#task-title');
    const formDesc = document.querySelector('#task-desc');
    const formPriority = document.querySelector('#task-priority');
    const formDueDate = document.querySelector('#task-due-date');
    const formTags = document.querySelector('#task-tags');
    const formNotes = document.querySelector('#task-notes');

    const state = {
        tasks: loadTasks(),
        search: '',
        activeItemId: null,
        dragInfo: null,
        undoTimer: null,
        lastDeleted: null,
    };

    applySavedTheme();
    render();

    taskForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const task = {
            id: createId(),
            parentId: null,
            title: formTitle.value.trim(),
            description: formDesc.value.trim(),
            priority: formPriority.value,
            dueDate: formDueDate.value || null,
            notes: formNotes.value.trim(),
            tags: parseTags(formTags.value),
            completed: false,
            children: [],
            expanded: true,
        };

        if (!task.title) {
            return;
        }

        state.tasks.push(task);
        persistAndRender();
        taskForm.reset();
        formTitle.focus();
    });

    searchInput.addEventListener('input', () => {
        state.search = searchInput.value.trim().toLowerCase();
        render();
    });

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
        themeToggle.textContent = isDark ? '☀️ Light mode' : '🌙 Dark mode';
        themeToggle.setAttribute('aria-pressed', String(isDark));
    });

    undoBtn.addEventListener('click', () => {
        if (!state.lastDeleted) {
            return;
        }
        state.tasks.splice(state.lastDeleted.index, 0, state.lastDeleted.task);
        hideToast();
        persistAndRender();
    });

    document.addEventListener('keydown', (event) => {
        if (event.target.matches('input, textarea, [contenteditable="true"]')) {
            return;
        }

        if (event.key === 'n' || event.key === 'N') {
            event.preventDefault();
            formTitle.focus();
            return;
        }

        const focusable = [...taskList.querySelectorAll('.task-card')].filter((item) => item.offsetParent !== null);
        if (!focusable.length) {
            return;
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            let index = focusable.findIndex((el) => el.dataset.id === state.activeItemId);
            if (index === -1) {
                index = 0;
            } else {
                index = event.key === 'ArrowDown'
                    ? Math.min(focusable.length - 1, index + 1)
                    : Math.max(0, index - 1);
            }
            focusItem(focusable[index].dataset.id);
        }

        if (event.key === ' ') {
            event.preventDefault();
            if (!state.activeItemId) {
                return;
            }
            const item = findNodeById(state.activeItemId, state.tasks);
            if (!item) {
                return;
            }
            item.completed = !item.completed;
            persistAndRender();
        }
    });

    function render() {
        taskList.innerHTML = '';

        const normalizedSearch = state.search;
        const visibleTasks = normalizedSearch ? filterNodes(state.tasks, normalizedSearch) : structuredClone(state.tasks);
        visibleTasks.forEach((task) => taskList.appendChild(renderTask(task, 0)));

        if (!taskList.children.length) {
            const emptyState = document.createElement('li');
            emptyState.className = 'empty-state';
            emptyState.textContent = normalizedSearch ? 'No tasks match your search.' : 'No tasks yet. Add one above.';
            taskList.appendChild(emptyState);
        }

        refreshActiveHighlight();
        updateProgress();
    }

    function renderTask(task, level) {
        const item = document.createElement('li');
        item.className = `task-card priority-${task.priority}`;
        item.dataset.id = task.id;
        item.dataset.level = String(level);
        item.draggable = true;

        if (task.completed) {
            item.classList.add('completed');
        }
        if (isOverdue(task)) {
            item.classList.add('overdue');
        }

        const dueText = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date';

        item.innerHTML = `
            <div class="task-main">
                <div class="task-line">
                    <input class="task-toggle" type="checkbox" ${task.completed ? 'checked' : ''} aria-label="Toggle task completion">
                    <span class="task-title" role="button" tabindex="0">${escapeHtml(task.title)}</span>
                    <span class="task-priority">${task.priority}</span>
                    <span class="task-due">${escapeHtml(dueText)}</span>
                </div>
                <p class="task-description">${escapeHtml(task.description)}</p>
                <div class="task-tags">${task.tags.map((tag) => `<span class="task-tag ${tagColor(tag)}">${escapeHtml(tag)}</span>`).join('')}</div>
                <details ${task.expanded ? 'open' : ''}>
                    <summary>Notes</summary>
                    <textarea class="task-notes" placeholder="Add notes...">${escapeHtml(task.notes || '')}</textarea>
                </details>
            </div>
            <div class="task-actions">
                <button class="add-subtask" type="button">+ Subtask</button>
                <button class="delete-task" type="button">Delete</button>
            </div>
            <ul class="subtasks"></ul>
        `;

        const subtaskList = item.querySelector('.subtasks');
        task.children.forEach((child) => {
            subtaskList.appendChild(renderTask(child, level + 1));
        });

        bindTaskEvents(item, task);
        return item;
    }

    function bindTaskEvents(item, task) {
        const toggle = item.querySelector('.task-toggle');
        const title = item.querySelector('.task-title');
        const notes = item.querySelector('.task-notes');
        const details = item.querySelector('details');

        item.addEventListener('click', () => focusItem(task.id));
        item.addEventListener('dragstart', (event) => {
            state.dragInfo = { id: task.id };
            item.classList.add('dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', task.id);
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        });

        item.addEventListener('dragover', (event) => {
            event.preventDefault();
            item.classList.add('drop-target');
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drop-target');
        });

        item.addEventListener('drop', (event) => {
            event.preventDefault();
            item.classList.remove('drop-target');
            if (!state.dragInfo || state.dragInfo.id === task.id) {
                return;
            }
            moveNode(state.dragInfo.id, task.id);
            state.dragInfo = null;
            persistAndRender();
        });

        toggle.addEventListener('change', () => {
            task.completed = toggle.checked;
            persistAndRender();
        });

        title.addEventListener('click', () => makeInlineEditable(title, task));
        title.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                makeInlineEditable(title, task);
            }
        });

        notes.addEventListener('change', () => {
            task.notes = notes.value;
            persistAndRender();
        });

        details.addEventListener('toggle', () => {
            task.expanded = details.open;
            saveTasks();
        });

        item.querySelector('.add-subtask').addEventListener('click', () => {
            const subtaskTitle = prompt('Subtask name');
            if (!subtaskTitle) {
                return;
            }
            task.children.push({
                id: createId(),
                parentId: task.id,
                title: subtaskTitle.trim(),
                description: 'Subtask',
                priority: task.priority,
                dueDate: task.dueDate,
                notes: '',
                tags: [...task.tags],
                completed: false,
                children: [],
                expanded: true,
            });
            persistAndRender();
        });

        item.querySelector('.delete-task').addEventListener('click', () => {
            const removed = removeNode(task.id, state.tasks);
            if (!removed) {
                return;
            }
            state.lastDeleted = removed;
            persistAndRender();
            showToast(`Deleted “${removed.task.title}”`);
        });
    }

    function makeInlineEditable(titleElement, task) {
        titleElement.contentEditable = 'true';
        titleElement.focus();
        document.getSelection()?.selectAllChildren(titleElement);

        const commit = () => {
            titleElement.contentEditable = 'false';
            const value = titleElement.textContent.trim();
            if (value) {
                task.title = value;
                persistAndRender();
            } else {
                render();
            }
            teardown();
        };

        const onKeyDown = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                commit();
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                render();
                teardown();
            }
        };

        const teardown = () => {
            titleElement.removeEventListener('blur', commit);
            titleElement.removeEventListener('keydown', onKeyDown);
        };

        titleElement.addEventListener('blur', commit, { once: true });
        titleElement.addEventListener('keydown', onKeyDown);
    }

    function filterNodes(nodes, term) {
        return nodes
            .map((node) => {
                const filteredChildren = filterNodes(node.children || [], term);
                const matchesSelf = [node.title, node.description, node.notes, ...(node.tags || [])]
                    .join(' ')
                    .toLowerCase()
                    .includes(term);

                if (matchesSelf || filteredChildren.length) {
                    return { ...node, children: filteredChildren };
                }
                return null;
            })
            .filter(Boolean);
    }

    function removeNode(id, nodes) {
        const index = nodes.findIndex((node) => node.id === id);
        if (index > -1) {
            const [task] = nodes.splice(index, 1);
            return { task, index };
        }

        for (const node of nodes) {
            const removed = removeNode(id, node.children || []);
            if (removed) {
                return removed;
            }
        }

        return null;
    }

    function moveNode(sourceId, targetId) {
        const removed = removeNode(sourceId, state.tasks);
        if (!removed) {
            return;
        }

        const target = findNodeById(targetId, state.tasks);
        if (!target) {
            state.tasks.push(removed.task);
            return;
        }

        if (containsNode(removed.task, targetId)) {
            state.tasks.splice(removed.index, 0, removed.task);
            return;
        }

        removed.task.parentId = target.id;
        target.children.push(removed.task);
        target.expanded = true;
    }

    function containsNode(node, id) {
        if (node.id === id) {
            return true;
        }
        return (node.children || []).some((child) => containsNode(child, id));
    }

    function findNodeById(id, nodes) {
        for (const node of nodes) {
            if (node.id === id) {
                return node;
            }
            const nested = findNodeById(id, node.children || []);
            if (nested) {
                return nested;
            }
        }
        return null;
    }

    function updateProgress() {
        const flat = flatten(state.tasks);
        if (!flat.length) {
            progressFill.style.width = '0%';
            progressText.textContent = '0%';
            return;
        }

        const completed = flat.filter((task) => task.completed).length;
        const percent = Math.round((completed / flat.length) * 100);
        progressFill.style.width = `${percent}%`;
        progressText.textContent = `${percent}%`;
    }

    function flatten(nodes) {
        return nodes.flatMap((node) => [node, ...flatten(node.children || [])]);
    }

    function focusItem(id) {
        state.activeItemId = id;
        refreshActiveHighlight();
        const activeEl = taskList.querySelector(`.task-card[data-id="${id}"]`);
        activeEl?.scrollIntoView({ block: 'nearest' });
    }

    function refreshActiveHighlight() {
        taskList.querySelectorAll('.task-card').forEach((el) => {
            el.classList.toggle('active', el.dataset.id === state.activeItemId);
        });
    }

    function isOverdue(task) {
        if (!task.dueDate || task.completed) {
            return false;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(task.dueDate);
        return dueDate < today;
    }

    function parseTags(tagString) {
        return tagString
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);
    }

    function tagColor(tag) {
        const index = Math.abs(hash(tag)) % TAG_COLORS.length;
        return TAG_COLORS[index];
    }

    function hash(text) {
        return [...text].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0);
    }

    function showToast(message) {
        toastText.textContent = message;
        toast.setAttribute('aria-hidden', 'false');
        toast.classList.add('visible');

        clearTimeout(state.undoTimer);
        state.undoTimer = setTimeout(() => {
            hideToast();
            state.lastDeleted = null;
        }, 5000);
    }

    function hideToast() {
        toast.setAttribute('aria-hidden', 'true');
        toast.classList.remove('visible');
        clearTimeout(state.undoTimer);
    }

    function persistAndRender() {
        saveTasks();
        render();
    }

    function saveTasks() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
    }

    function loadTasks() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (error) {
            console.error('Unable to load tasks', error);
            return [];
        }
    }

    function applySavedTheme() {
        const theme = localStorage.getItem(THEME_KEY);
        const dark = theme === 'dark';
        document.body.classList.toggle('dark-mode', dark);
        themeToggle.textContent = dark ? '☀️ Light mode' : '🌙 Dark mode';
        themeToggle.setAttribute('aria-pressed', String(dark));
    }

    function createId() {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
});
