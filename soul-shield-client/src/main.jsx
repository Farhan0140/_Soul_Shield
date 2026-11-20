import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/newsreader';
import './index.css';
import { ApiProvider } from './context/ApiContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/Toast';
import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion';
import { warmUpServer } from './services/api';
import { isDemoMode, exitDemo } from './demo/demoMode';

// Start waking a sleeping API host right away, before the user even signs in.
// Skipped when it already answered recently in this tab session (see api.js).
// The demo runs entirely in the browser, so it never needs the server.
if (!isDemoMode()) warmUpServer();

const root = ReactDOM.createRoot(document.getElementById('root'));

function render(demoApi = null) {
  root.render(
    // <React.StrictMode>
      <BrowserRouter>
        <ThemeProvider>
          <ApiProvider demoApi={demoApi}>
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
}

if (isDemoMode()) {
  // The demo's API and sample data are their own chunk, fetched only when a
  // tour is running. If it can't be loaded, leave the tour for sign-in rather
  // than running the demo against the real server.
  import('./demo/demoApi')
    .then(({ demoApi }) => render(demoApi))
    .catch(() => exitDemo('/login'));
} else {
  render();
}
