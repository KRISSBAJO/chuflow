"use client";

import { Toaster } from "sonner";
import { useLocale } from "next-intl";

const labels: Record<string, { notifications: string; dismiss: string }> = {
  en: { notifications: "Notifications", dismiss: "Dismiss notification" },
  es: { notifications: "Notificaciones", dismiss: "Cerrar notificación" },
  fr: { notifications: "Notifications", dismiss: "Fermer la notification" },
  pt: { notifications: "Notificações", dismiss: "Fechar notificação" },
};

export function AppToaster() {
  const locale = useLocale();
  const label = labels[locale] || labels.en;
  return (
    <Toaster
      theme="light"
      position="bottom-right"
      className="chuflow-toaster"
      containerAriaLabel={label.notifications}
      closeButton
      visibleToasts={3}
      duration={5500}
      gap={12}
      offset={{ bottom: "max(24px, env(safe-area-inset-bottom))", right: 24 }}
      mobileOffset={{
        bottom: "calc(84px + env(safe-area-inset-bottom))",
        left: 16,
        right: 16,
      }}
      toastOptions={{
        closeButtonAriaLabel: label.dismiss,
        classNames: {
          toast: "chuflow-toast",
          title: "chuflow-toast-title",
          description: "chuflow-toast-description",
          icon: "chuflow-toast-icon",
          closeButton: "chuflow-toast-close",
          actionButton: "chuflow-toast-action",
          cancelButton: "chuflow-toast-cancel",
        },
      }}
    />
  );
}
