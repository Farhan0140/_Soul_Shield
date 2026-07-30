import { createContext, useContext } from 'react';
import { api } from '../services/api';

const ApiContext = createContext(null);

export function ApiProvider({ children }) {
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

  // Auth/OTP APIs
  // const sendOtp = (email) => api.post('/send-otp', { email }, { auth: false });
  // const verifyOtp = (email, otp) => api.post('/verify-otp', { email, otp }, { auth: false });
  const registerUser = (full_name, email, password) => api.post('/users/register', { full_name, email, password }, { auth: false });
  const resetPassword = (email, new_password) => api.post('/users/reset-password', { email, new_password }, { auth: false });
  const getMe = () => api.get('/users/me');
  const loginUser = (email, password) => api.post('/users/login', { email, password });

  return (
    <ApiContext.Provider value={{
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
      // sendOtp,
      // verifyOtp,
      registerUser,
      resetPassword,
      getMe,
      loginUser
    }}>
      {children}
    </ApiContext.Provider>
  );
}

export const useApi = () => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};
