import {
  LayoutDashboard, Package, Tags, Layers, ShoppingCart, Warehouse, Truck, Users,
  Building2, ShoppingBag, Receipt, Megaphone, Settings, Shield, FileText, UserCog,
  ClipboardList, Image as ImageIcon, Plug,
} from "lucide-react";

export type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  keywords?: string[];
};

export type NavGroup = { label: string; items: NavItem[] };

/** Single source of truth for sidebar + command palette + breadcrumbs. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Visão Geral",
    items: [{ title: "Dashboard", url: "/admin", icon: LayoutDashboard, keywords: ["home", "início"] }],
  },
  {
    label: "Catálogo",
    items: [
      { title: "Produtos", url: "/admin/products", icon: Package, permission: "products.read" },
      { title: "Categorias", url: "/admin/categories", icon: Layers, permission: "products.read" },
      { title: "Marcas", url: "/admin/brands", icon: Tags, permission: "products.read" },
      { title: "Coleções", url: "/admin/collections", icon: ClipboardList, permission: "products.read" },
      { title: "Atributos", url: "/admin/attributes", icon: ClipboardList, permission: "products.read" },
      { title: "Valores de Atributos", url: "/admin/attribute-values", icon: ClipboardList, permission: "products.read" },
      { title: "Atributos × Categoria", url: "/admin/category-attributes", icon: ClipboardList, permission: "products.read" },
    ],
  },
  {
    label: "Vendas",
    items: [
      { title: "Pedidos", url: "/admin/orders", icon: ShoppingCart, permission: "orders.read" },
      { title: "Carrinhos", url: "/admin/carts", icon: ShoppingCart, permission: "carts.read" },
      { title: "Clientes", url: "/admin/customers", icon: Users, permission: "customers.read" },
      { title: "Grupos de Clientes", url: "/admin/customer-groups", icon: Users, permission: "customers.read" },
      { title: "Listas de Preço", url: "/admin/price-lists", icon: Receipt, permission: "products.read" },
      { title: "Cupons", url: "/admin/coupons", icon: Tags, permission: "pricing.manage" },
      { title: "Empresas", url: "/admin/companies", icon: Building2, permission: "customers.read" },
    ],
  },
  {
    label: "Estoque & Compras",
    items: [
      { title: "Estoque", url: "/admin/inventory", icon: Warehouse, permission: "inventory.read" },
      { title: "Compras", url: "/admin/purchases", icon: ShoppingBag, permission: "purchases.read" },
      { title: "Fornecedores", url: "/admin/suppliers", icon: Building2, permission: "suppliers.read" },
    ],
  },
  {
    label: "Expedição & Fiscal",
    items: [
      { title: "Expedição", url: "/admin/shipping", icon: Truck, permission: "shipping.manage" },
      { title: "Integrações", url: "/admin/integracoes", icon: Plug, permission: "shipping.manage" },
      { title: "Notas Fiscais", url: "/admin/invoices", icon: Receipt, permission: "finance.manage" },
    ],
  },
  {
    label: "Mídias",
    items: [{ title: "Biblioteca (DAM)", url: "/admin/dam", icon: ImageIcon, permission: "dam.read" }],
  },
  {
    label: "Marketing",
    items: [{ title: "Campanhas", url: "/admin/marketing", icon: Megaphone, permission: "marketing.manage" }],
  },
  {
    label: "Administração",
    items: [
      { title: "Usuários & Papéis", url: "/admin/users", icon: UserCog, permission: "users.manage" },
      { title: "Funcionários", url: "/admin/employees", icon: Users, permission: "hr.manage" },
      { title: "Lojas", url: "/admin/stores", icon: Building2, permission: "stores.manage" },
      { title: "Configurações", url: "/admin/settings", icon: Settings, permission: "settings.manage" },
      { title: "Auditoria", url: "/admin/audit", icon: Shield, permission: "audit.read" },
      { title: "Logs", url: "/admin/logs", icon: FileText, permission: "system.logs.read" },
    ],
  },
];
