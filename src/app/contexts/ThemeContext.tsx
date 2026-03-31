import { createContext, useContext } from 'react';

export const ThemeContext = createContext<boolean>(true); // true = dark

export function useIsDark(): boolean {
  return useContext(ThemeContext);
}
