type WhatsAppFabProps = {
  /** Telefone no formato internacional, somente dígitos. Ex: 5511999999999 */
  phone?: string;
  message?: string;
};

export function WhatsAppFab({
  phone = "5511999999999",
  message = "Olá! Gostaria de mais informações.",
}: WhatsAppFabProps) {
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fale conosco no WhatsApp"
      className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-all duration-300 hover:scale-105 hover:bg-[#1FB855] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
    >
      <svg
        viewBox="0 0 32 32"
        className="h-6 w-6 md:h-7 md:w-7"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.478-1.318.13-.33.244-.762.244-1.118 0-.073 0-.144-.014-.215-.1-.172-2.434-1.39-2.692-1.39zm-2.792 9.292c-1.92 0-3.84-.602-5.43-1.69L7.04 26l1.226-3.605c-1.231-1.65-1.86-3.624-1.86-5.687 0-5.32 4.43-9.612 9.913-9.612s9.913 4.292 9.913 9.612-4.43 9.799-9.913 9.799zm0-21.197c-6.464 0-11.7 5.067-11.7 11.328 0 2.064.546 4.084 1.602 5.85L4 30l5.572-1.802a11.79 11.79 0 0 0 5.745 1.483h.006c6.46 0 12.157-5.067 12.157-11.328 0-3.024-1.298-5.866-3.464-8.003a11.945 11.945 0 0 0-8.464-3.353z" />
      </svg>
    </a>
  );
}
