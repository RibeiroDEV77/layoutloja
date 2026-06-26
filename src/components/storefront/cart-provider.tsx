/**
 * CartProvider — instância única de `useStorefrontCart` + estado UI do Mini Cart.
 * Todos os consumidores (Navbar, MiniCart, Sacola, Produto) usam `useCart()`
 * para compartilhar o mesmo estado, sem duplicar consultas.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useStorefrontCart, type SalesChannel } from '@/hooks/use-storefront-cart';
import { useSalesChannel } from '@/components/storefront/sales-channel-provider';

type Cart = ReturnType<typeof useStorefrontCart>;

type CartContextValue = Cart & {
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  salesChannel: SalesChannel;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { channel: salesChannel } = useSalesChannel();
  const cart = useStorefrontCart(salesChannel);
  const [isOpen, setIsOpen] = useState(false);
  const value = useMemo<CartContextValue>(() => ({
    ...cart,
    isOpen,
    openCart: () => setIsOpen(true),
    closeCart: () => setIsOpen(false),
    toggleCart: () => setIsOpen((v) => !v),
    salesChannel,
  }), [cart, isOpen, salesChannel]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart deve ser usado dentro de <CartProvider>');
  return ctx;
}
