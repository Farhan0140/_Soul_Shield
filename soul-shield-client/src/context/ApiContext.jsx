import { createContext, useContext } from 'react';
import { api } from '../services/api';

const ApiContext = createContext(null);

// Categories APIs
const getCategories = () => api.get('/categories');
const createCategory = (name, color_hex) => api.post('/categories', { name, color_hex });
const updateCategory = (id, name, color_hex) => api.patch(`/categories/${id}`, { name, color_hex });
const deleteCategory = (id) => api.delete(`/categories/${id}`);

// Tasks APIs
const getTasks = (dateStr) => api.get(`/tasks?date=${dateStr}`);
const getTasksHistory = (fromStr, toStr) => api.get(`/tasks/history?from=${fromStr}&to=${toStr}`);
const createTask = (payload) => api.post('/tasks', payload);
const updateTask = (id, payload) => api.patch(`/tasks/${id}`, payload);
const deleteTask = (id) => api.delete(`/tasks/${id}`);
const incrementCounter = (taskId, dateStr, incrementValue, opts) => api.post(`/tasks/${taskId}/increment`, { date: dateStr, amount: incrementValue }, opts);
const completeTask = (taskId, dateStr) => api.post(`/tasks/${taskId}/complete`, { date: dateStr });
const addTaskToMyTasks = (taskId) => api.post(`/tasks/${taskId}/add-to-my-tasks`, {});
const completeSubTask = (taskId, subTaskId, dateStr) => api.post(`/tasks/${taskId}/subtasks/${subTaskId}/complete`, { date: dateStr });
const incrementSubTask = (taskId, subTaskId, dateStr, incrementValue) => api.post(`/tasks/${taskId}/subtasks/${subTaskId}/increment`, { date: dateStr, amount: incrementValue });
// Undo a completion (normal/timer tasks; counters are reset by their own flow).
const uncompleteTask = (taskId, dateStr) => api.post(`/tasks/${taskId}/uncomplete`, { date: dateStr });
const uncompleteSubTask = (taskId, subTaskId, dateStr) => api.post(`/tasks/${taskId}/subtasks/${subTaskId}/uncomplete`, { date: dateStr });
// Server-computed personal stats (rate, streak, favourite category, best weekday).
const getPersonalStats = (days = 365) => api.get(`/tasks/stats?days=${days}`);
// Admin only: real usage across all users.
const getAdminStats = (days = 30) => api.get(`/admin/stats?days=${days}`);
// Admin only: app ratings + feedback sent from the mobile app.
// getFeedback -> { items, summary: { counts, total, average }, unread, next_before }.
const getFeedback = (before = 0, limit = 30) =>
  api.get(`/admin/feedback?limit=${limit}${before ? `&before=${before}` : ''}`);
const getFeedbackUnreadCount = () => api.get('/admin/feedback/unread-count');
const markFeedbackRead = () => api.post('/admin/feedback/read', {});

// Auth APIs
// Password reset is a two-step flow: verifySecurityAnswer proves identity and returns a
// short-lived reset_token, which resetPassword then redeems for the actual password change.
const registerUser = (full_name, email, password, security_answer) => api.post('/users/register', { full_name, email, password, security_answer }, { auth: false });
const verifySecurityAnswer = (email, security_answer) => api.post('/users/verify-security-answer', { email, security_answer }, { auth: false });
const resetPassword = (reset_token, new_password) => api.post('/users/reset-password', { reset_token, new_password }, { auth: false });
const getMe = () => api.get('/users/me');
// auth: false - a wrong password must not look like an expired session. retry:
// logging in is safe to repeat, so it rides through a server cold start.
const loginUser = (email, password) => api.post('/users/login', { email, password }, { auth: false, retry: true });
// Signed-in account management. A wrong password answers 400 (not 401).
// changePassword signs out every other session and returns { message, token }:
// the caller must store the new token (see ChangePasswordModal).
const changePassword = (current_password, new_password) => api.post('/users/change-password', { current_password, new_password });
const deleteAccount = (password) => api.delete('/users/me', { body: { password } });

// Stable across renders — no component state involved — so context consumers
// (effects, callbacks) don't see a new function identity on every render.
const apiValue = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getTasks,
  getTasksHistory,
  createTask,
  updateTask,
  deleteTask,
  incrementCounter,
  completeTask,
  addTaskToMyTasks,
  completeSubTask,
  incrementSubTask,
  uncompleteTask,
  uncompleteSubTask,
  getPersonalStats,
  getAdminStats,
  getFeedback,
  getFeedbackUnreadCount,
  markFeedbackRead,
  registerUser,
  verifySecurityAnswer,
  resetPassword,
  getMe,
  loginUser,
  changePassword,
  deleteAccount,
};

/** `demoApi` is the in-browser demo API while a tour runs ("Take a tour"):
 * main.jsx loads it before the first render and it stays fixed for the whole
 * page load, so the value is stable. Otherwise the real server is used. */
export function ApiProvider({ demoApi = null, children }) {
  return <ApiContext.Provider value={demoApi ?? apiValue}>{children}</ApiContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- the provider's hook lives beside it
export const useApi = () => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};
