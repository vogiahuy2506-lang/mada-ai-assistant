// Safe storage wrapper for Zustand persist middleware
// Handles hydration errors gracefully
import { createJSONStorage, StateStorage } from 'zustand/middleware';

function getStorage(): StateStorage {
  // SSR check
  if (typeof window === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
  
  return {
    getItem: (name: string): string | null => {
      try {
        const value = localStorage.getItem(name);
        return value;
      } catch (error) {
        console.warn(`[storage] Failed to get ${name}:`, error);
        return null;
      }
    },
    setItem: (name: string, value: string): void => {
      try {
        localStorage.setItem(name, value);
      } catch (error) {
        console.warn(`[storage] Failed to set ${name}:`, error);
      }
    },
    removeItem: (name: string): void => {
      try {
        localStorage.removeItem(name);
      } catch (error) {
        console.warn(`[storage] Failed to remove ${name}:`, error);
      }
    },
  };
}

export const zustandStorage = getStorage();

// Export a function to create the JSON storage for use in persist config
export function createSafeJSONStorage() {
  return createJSONStorage(() => zustandStorage);
}
