import { createFileRoute, Outlet } from '@tanstack/react-router';
import { StoreHeader } from '@/components/storefront/header';
import { StoreFooter } from '@/components/storefront/footer';
import { CartDrawer } from '@/components/storefront/cart-drawer';

export const Route = createFileRoute('/_store')({
  component: StoreLayout,
});

function StoreLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <StoreHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <StoreFooter />
      <CartDrawer />
    </div>
  );
}
