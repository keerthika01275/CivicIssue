import api from './api';

// Store token + user in localStorage
const setSession = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
};

// Clear session on logout
const clearSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
};

// Register a new user
export const register = async ({ name, email, password, location, role }) => {
    const res = await api.post('/register', { name, email, password, location, role });
    setSession(res.data.token, res.data.user);
    return res.data;
};

// Login with email and password
export const login = async ({ email, password }) => {
    const res = await api.post('/login', { email, password });
    setSession(res.data.token, res.data.user);
    return res.data;
};

// Logout — clear local session
export const logout = () => {
    clearSession();
    window.location.href = '/login';
};

// Get current user from localStorage (decoded from stored JSON)
export const getCurrentUser = () => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
};

// Get token
export const getToken = () => localStorage.getItem('token');

// Check if user is logged in (has a valid token in storage)
export const isAuthenticated = () => !!localStorage.getItem('token');

// Fetch fresh user profile from backend using JWT
export const fetchMe = async () => {
    const res = await api.get('/me');
    return res.data.user;
};

// Update profile (name, email, location, profilePhoto) — refreshes stored token + user
export const updateProfile = async ({ name, email, location, profilePhoto }) => {
    const res = await api.patch('/me', { name, email, location, profilePhoto });
    // Backend returns a new token with updated claims
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    // Notify same-tab listeners (e.g. NavBar avatar) to re-read from localStorage
    window.dispatchEvent(new Event('userUpdated'));
    return res.data.user;
};

// Change password
export const changePassword = async ({ currentPassword, newPassword }) => {
    const res = await api.patch('/me/password', { currentPassword, newPassword });
    return res.data;
};

// Admin-only: Get all users (for admin dashboard)
export const getAllUsers = async () => {
  const res = await api.get("/users");
  return res.data.users;
};
