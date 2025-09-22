import { useState, useEffect, Dispatch, SetStateAction } from 'react';

// Custom hook for persisting state to localStorage, moved here for centralization
// FIX: Import Dispatch and SetStateAction from react to correctly type the hook's return value.
const usePersistentState = <T,>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item, (k, v) => {
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)) {
          return new Date(v);
        }
        return v;
      }) : defaultValue;
    } catch (error) {
      console.error(error);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(error);
    }
  }, [key, value]);

  return [value, setValue];
};

export default usePersistentState;