import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initApiInterceptor } from './services/apiInterceptor';

// Initialize zero-cost direct cloud bridge for GitHub Pages / static deployment
initApiInterceptor();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
