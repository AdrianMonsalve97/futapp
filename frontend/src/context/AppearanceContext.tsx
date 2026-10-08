import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface Appearance { night: boolean; motion: boolean; toggleNight: () => void; toggleMotion: () => void }
const Context = createContext<Appearance | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [night, setNight] = useState(() => localStorage.getItem('futapp:night') === 'true');
  const [motion, setMotion] = useState(() => localStorage.getItem('futapp:motion') !== 'false');
  useEffect(() => {
    document.documentElement.dataset.theme = night ? 'dark' : 'emerald';
    document.documentElement.dataset.motion = motion ? 'on' : 'off';
    localStorage.setItem('futapp:night', String(night));
    localStorage.setItem('futapp:motion', String(motion));
  }, [night, motion]);
  return <Context.Provider value={{ night, motion, toggleNight: () => setNight(v => !v), toggleMotion: () => setMotion(v => !v) }}>{children}</Context.Provider>;
}

export function useAppearance() {
  const context = useContext(Context);
  if (!context) throw new Error('AppearanceProvider ausente');
  return context;
}
