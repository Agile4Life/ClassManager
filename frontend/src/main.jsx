import React from 'react';
import ReactDOM from 'react-dom/client';
import { FluentProvider, createLightTheme } from '@fluentui/react-components';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import './styles.css';

const schoolBlue = {
  10: '#02040a',
  20: '#07101e',
  30: '#0b1c32',
  40: '#102846',
  50: '#15345a',
  60: '#1b416f',
  70: '#224e84',
  80: '#2b5c99',
  90: '#376aaf',
  100: '#4779c2',
  110: '#5b89d1',
  120: '#7399dc',
  130: '#8daae5',
  140: '#a8bced',
  150: '#c4cef4',
  160: '#e0e3f9',
};

const theme = createLightTheme(schoolBlue);
theme.fontFamilyBase = "'Avenir Next', 'Segoe UI', Arial, sans-serif";
theme.borderRadiusMedium = '12px';
theme.borderRadiusLarge = '16px';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FluentProvider theme={theme} className="theme-root">
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </FluentProvider>
  </React.StrictMode>,
);
