import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'classmanager-color-theme';
const DAY_THEME_IDS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const THEME_OPTIONS = [
  {
    id: 'monday', label: 'Thứ 2', color: '#2563a6',
    variables: {
      '--accent': '#2563a6', '--accent-dark': '#174a82', '--accent-soft': '#e1edfa',
      '--accent-rgb': '37, 99, 166', '--canvas': '#f3f6fa', '--paper-blue': '#eef4fb',
    },
  },
  {
    id: 'tuesday', label: 'Thứ 3', color: '#287052',
    variables: {
      '--accent': '#287052', '--accent-dark': '#194e38', '--accent-soft': '#def1e7',
      '--accent-rgb': '40, 112, 82', '--canvas': '#f2f7f4', '--paper-blue': '#eaf4ee',
    },
  },
  {
    id: 'wednesday', label: 'Thứ 4', color: '#6c4d97',
    variables: {
      '--accent': '#6c4d97', '--accent-dark': '#4d356f', '--accent-soft': '#ece5f6',
      '--accent-rgb': '108, 77, 151', '--canvas': '#f6f3f9', '--paper-blue': '#f0ebf7',
    },
  },
  {
    id: 'thursday', label: 'Thứ 5', color: '#a95520',
    variables: {
      '--accent': '#a95520', '--accent-dark': '#783912', '--accent-soft': '#f7e7dc',
      '--accent-rgb': '169, 85, 32', '--canvas': '#f9f5f1', '--paper-blue': '#f7ece4',
    },
  },
  {
    id: 'friday', label: 'Thứ 6', color: '#a9405b',
    variables: {
      '--accent': '#a9405b', '--accent-dark': '#792c40', '--accent-soft': '#f6e3e8',
      '--accent-rgb': '169, 64, 91', '--canvas': '#faf4f6', '--paper-blue': '#f8e9ed',
    },
  },
  {
    id: 'saturday', label: 'Thứ 7', color: '#1d727b',
    variables: {
      '--accent': '#1d727b', '--accent-dark': '#124f56', '--accent-soft': '#dcf0f1',
      '--accent-rgb': '29, 114, 123', '--canvas': '#f1f7f7', '--paper-blue': '#e7f3f3',
    },
  },
  {
    id: 'sunday', label: 'Chủ nhật', color: '#a94e38',
    variables: {
      '--accent': '#a94e38', '--accent-dark': '#783526', '--accent-soft': '#f7e5e0',
      '--accent-rgb': '169, 78, 56', '--canvas': '#faf5f3', '--paper-blue': '#f8ebe7',
    },
  },
];

function getTodayThemeId() {
  return DAY_THEME_IDS[new Date().getDay()];
}

function getInitialSelection() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored?.startsWith('random:')) {
      const randomThemeId = stored.slice('random:'.length);
      if (THEME_OPTIONS.some((theme) => theme.id === randomThemeId)) {
        return { preference: 'random', randomThemeId };
      }
    }
    if (THEME_OPTIONS.some((theme) => theme.id === stored)) {
      return { preference: stored, randomThemeId: null };
    }
    // The old "auto" setting followed the current day, so migrate it to the new default.
    if (stored === 'auto') return { preference: 'today', randomThemeId: null };
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
  return { preference: 'today', randomThemeId: null };
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [selection, setSelection] = useState(getInitialSelection);
  const [todayThemeId, setTodayThemeId] = useState(getTodayThemeId);
  const { preference, randomThemeId } = selection;
  const activeThemeId = preference === 'today'
    ? todayThemeId
    : preference === 'random' ? randomThemeId : preference;
  const activeTheme = THEME_OPTIONS.find((theme) => theme.id === activeThemeId) || THEME_OPTIONS[0];

  useEffect(() => {
    const syncDay = () => setTodayThemeId(getTodayThemeId());
    window.addEventListener('focus', syncDay);
    const intervalId = window.setInterval(syncDay, 60_000);
    return () => {
      window.removeEventListener('focus', syncDay);
      window.clearInterval(intervalId);
    };
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.colorTheme = activeTheme.id;
    Object.entries(activeTheme.variables).forEach(([name, value]) => root.style.setProperty(name, value));
  }, [activeTheme]);

  const saveSelection = useCallback((nextSelection, storedValue) => {
    setSelection(nextSelection);
    try {
      localStorage.setItem(STORAGE_KEY, storedValue);
    } catch {
      // The selected theme still applies for the current session.
    }
  }, []);

  const setPreference = useCallback((value) => {
    const nextValue = THEME_OPTIONS.some((theme) => theme.id === value) ? value : 'today';
    saveSelection({ preference: nextValue, randomThemeId: null }, nextValue);
  }, [saveSelection]);

  const randomizeTheme = useCallback(() => {
    const candidates = THEME_OPTIONS.filter((theme) => theme.id !== activeThemeId);
    const randomTheme = candidates[Math.floor(Math.random() * candidates.length)] || THEME_OPTIONS[0];
    saveSelection({ preference: 'random', randomThemeId: randomTheme.id }, `random:${randomTheme.id}`);
  }, [activeThemeId, saveSelection]);

  const contextValue = useMemo(() => ({
    preference, setPreference, randomizeTheme, activeTheme, todayThemeId,
  }), [activeTheme, preference, randomizeTheme, setPreference, todayThemeId]);

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
