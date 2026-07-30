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
const incrementCounter = (taskId, dateStr, incrementValue) => api.post(`/tasks/${taskId}/increment`, { date: dateStr, amount: incrementValue });
const completeTask = (taskId, dateStr) => api.post(`/tasks/${taskId}/complete`, { date: dateStr });

// Auth APIs
// Password reset is a two-step flow: verifySecurityAnswer proves identity and returns a
// short-lived reset_token, which resetPassword then redeems for the actual password change.
const registerUser = (full_name, email, password, security_answer) => api.post('/users/register', { full_name, email, password, security_answer }, { auth: false });
const verifySecurityAnswer = (email, security_answer) => api.post('/users/verify-security-answer', { email, security_answer }, { auth: false });
const resetPassword = (reset_token, new_password) => api.post('/users/reset-password', { reset_token, new_password }, { auth: false });
const getMe = () => api.get('/users/me');
const loginUser = (email, password) => api.post('/users/login', { email, password });

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
  registerUser,
  verifySecurityAnswer,
  resetPassword,
  getMe,
  loginUser,
};

export function ApiProvider({ children }) {
  return <ApiContext.Provider value={apiValue}>{children}</ApiContext.Provider>;
}

export const useApi = () => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};
