import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { ApiProvider } from './context/ApiContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/Toast';
import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion';
import { warmUpServer } from './services/api';

// Start waking a sleeping API host right away, before the user even signs in.
warmUpServer();

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
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
      </ThemeProvider>
    </BrowserRouter>
  // </React.StrictMode>
);