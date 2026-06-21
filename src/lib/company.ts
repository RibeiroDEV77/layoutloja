/**
 * Dados institucionais da empresa — fonte única para Navbar, Footer,
 * página de contato, links de WhatsApp e demais blocos institucionais
 * da Loja Pública.
 *
 * Quando o módulo "Dados da Empresa" do Painel Administrativo for
 * implementado, esses valores devem migrar para o banco e os componentes
 * passar a consumir o registro carregado por server function — a forma
 * dos dados aqui já espelha esse contrato.
 */
export const COMPANY = {
  legalName: "Layout Indústria do Vestuário",
  tradeName: "Layout",
  cnpj: "03.261.517/0001-22",
  stateRegistration: "28.310.209-8",
  email: "layout.vest@hotmail.com",
  whatsapp: {
    display: "+55 (67) 99662-0187",
    e164: "5567996620187",
  },
  address: {
    street: "Rodovia BR-163",
    number: "71",
    district: "Bairro Universitário",
    zip: "79982-384",
    full: "Rodovia BR-163, nº 71 — Bairro Universitário — CEP 79982-384",
  },
} as const;

export const whatsappUrl = (text?: string) =>
  `https://wa.me/${COMPANY.whatsapp.e164}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export const mailtoUrl = (subject?: string) =>
  `mailto:${COMPANY.email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
