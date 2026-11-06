/** Browser fallback used only when the app runs on the web for previews. */
export const secureStorage = {
  get: async (key: string) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: async (key: string, value: string) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private mode: the session just won't survive a reload.
    }
  },
  remove: async (key: string) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing stored.
    }
  },
};
