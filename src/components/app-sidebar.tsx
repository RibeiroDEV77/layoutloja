import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  Tags,
  Layers,
  ShoppingCart,
  Warehouse,
  Truck,
  Users,
  Building2,
  ShoppingBag,
  Receipt,
  Megaphone,
  Settings,
  Shield,
  FileText,
  UserCog,
  ClipboardList,
  Image as ImageIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";

type Item = { title: string; url: string; icon: React.ComponentType<{ className?: string }>; permission?: string };

const groups: { label: string; items: Item[] }[] = [
  {
    label: "Visão Geral",
    items: [{ title: "Dashboard", url: "/admin", icon: LayoutDashboard }],
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
      { title: "Clientes", url: "/admin/customers", icon: Users, permission: "customers.read" },
      { title: "Grupos de Clientes", url: "/admin/customer-groups", icon: Users, permission: "customers.read" },
      { title: "Listas de Preço", url: "/admin/price-lists", icon: Receipt, permission: "products.read" },
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
      { title: "Notas Fiscais", url: "/admin/invoices", icon: Receipt, permission: "finance.manage" },
    ],
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

export function AppSidebar() {
  const { hasPermission, isSuperAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => (url === "/admin" ? pathname === "/admin" : pathname.startsWith(url));
  const allow = (p?: string) => !p || isSuperAdmin() || hasPermission(p);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-3">
        <div className="text-sm font-semibold">Layout — Admin</div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => {
          const visible = g.items.filter((i) => allow(i.permission));
          if (!visible.length) return null;
          return (
            <SidebarGroup key={g.label}>
              <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visible.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
