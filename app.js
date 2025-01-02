document.addEventListener('DOMContentLoaded', () => {
    const taskForm = document.querySelector('#task-form form');
    const taskList = document.querySelector('#task-list ul');

    taskForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const title = document.querySelector('#task-title').value;
        const description = document.querySelector('#task-desc').value;
        const priority = document.querySelector('#task-priority').value;
        const dueDate = document.querySelector('#task-due-date').value;

        const task = {
            id: Date.now(),
            title,
            description,
            priority,
            dueDate,
        };

        addTask(task);
        taskForm.reset();
    });

    function addTask(task) {
        const taskItem = document.createElement('li');
        taskItem.innerHTML = `
            <div class="task-info">
                <h3>${task.title}</h3>
                <p>${task.description}</p>
                <p>Priority: ${task.priority}</p>
                <p>Due Date: ${task.dueDate}</p>
            </div>
            <div class="task-actions">
                <button class="edit-task">Edit</button>
                <button class="delete-task">Delete</button>
            </div>
        `;

        taskList.appendChild(taskItem);

        const editButton = taskItem.querySelector('.edit-task');
        const deleteButton = taskItem.querySelector('.delete-task');

        editButton.addEventListener('click', () => {
            editTask(task, taskItem);
        });

        deleteButton.addEventListener('click', () => {
            deleteTask(taskItem);
        });
    }

    function editTask(task, taskItem) {
        const title = prompt('Edit Title', task.title);
        const description = prompt('Edit Description', task.description);
        const priority = prompt('Edit Priority', task.priority);
        const dueDate = prompt('Edit Due Date', task.dueDate);

        if (title && description && priority && dueDate) {
            task.title = title;
            task.description = description;
            task.priority = priority;
            task.dueDate = dueDate;

            taskItem.querySelector('.task-info').innerHTML = `
                <h3>${task.title}</h3>
                <p>${task.description}</p>
                <p>Priority: ${task.priority}</p>
                <p>Due Date: ${task.dueDate}</p>
            `;
        }
    }

    function deleteTask(taskItem) {
        taskList.removeChild(taskItem);
    }
});
