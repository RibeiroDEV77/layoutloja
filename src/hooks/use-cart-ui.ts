/**
 * Estado global UI do carrinho (apenas open/close do drawer).
 * O conteúdo do carrinho vem de useQuery(getPublicCart).
 */
import { create } from 'zustand';

interface CartUiState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useCartUi = create<CartUiState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
