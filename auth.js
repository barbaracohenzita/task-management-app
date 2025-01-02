const users = [];
let currentUser = null;

function register(username, password) {
    if (users.find(user => user.username === username)) {
        throw new Error('User already exists');
    }
    const newUser = { username, password };
    users.push(newUser);
    return newUser;
}

function login(username, password) {
    const user = users.find(user => user.username === username && user.password === password);
    if (!user) {
        throw new Error('Invalid username or password');
    }
    currentUser = user;
    return user;
}

function logout() {
    currentUser = null;
}

function checkPermission(task) {
    if (!currentUser) {
        throw new Error('User not logged in');
    }
    // Add logic to check if the current user has permission to access or modify the task
    return true;
}

export { register, login, logout, checkPermission };
