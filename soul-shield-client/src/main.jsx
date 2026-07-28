import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ApiProvider } from './context/ApiContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion';

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
    <BrowserRouter>
      <ApiProvider>
        <AuthProvider>
          <ToastProvider>
            <LazyMotion features={domAnimation}>
              <MotionConfig reducedMotion="user">
                <App />
              </MotionConfig>
            </LazyMotion>
          </ToastProvider>
        </AuthProvider>
      </ApiProvider>
    </BrowserRouter>
  // </React.StrictMode>
);