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
            dueDate
        };

        addTask(task);
        taskForm.reset();
    });

    function addTask(task) {
        const taskItem = document.createElement('li');
        taskItem.textContent = `${task.title} - ${task.description} - ${task.priority} - ${task.dueDate}`;
        taskList.appendChild(taskItem);
    }

    function updateTask(taskId, updatedTask) {
        const taskItems = taskList.querySelectorAll('li');
        taskItems.forEach((taskItem) => {
            if (taskItem.dataset.id === taskId.toString()) {
                taskItem.textContent = `${updatedTask.title} - ${updatedTask.description} - ${updatedTask.priority} - ${updatedTask.dueDate}`;
            }
        });
    }

    function deleteTask(taskId) {
        const taskItems = taskList.querySelectorAll('li');
        taskItems.forEach((taskItem) => {
            if (taskItem.dataset.id === taskId.toString()) {
                taskList.removeChild(taskItem);
            }
        });
    }
});
