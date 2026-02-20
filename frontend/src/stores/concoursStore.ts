import { create } from 'zustand';
import { Concours } from '@/types';

interface ConcoursStore {
  current: Concours | null;
  setCurrent: (c: Concours | null) => void;
}

export const useConcoursStore = create<ConcoursStore>((set) => ({
  current: null,
  setCurrent: (c) => set({ current: c }),
}));
