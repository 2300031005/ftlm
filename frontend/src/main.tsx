import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import fontsource packages
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono';
import '@fontsource/instrument-serif';

// Import design tokens and Tailwind CSS
import './styles/tokens.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
