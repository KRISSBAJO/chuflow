import type { PlanErrorCode } from "./entitlements";

/*
 * Plain-language text for plan refusals, outside React so the API client can throw it. The
 * language follows the picker's cookie on the client; server code falls back to English.
 */

const FEATURES: Record<string, Record<string, string>> = {
  en: { guests: "Guests", members: "Members", attendance: "Attendance", follow_up: "Follow-up", care: "Care", meetings: "Meetings", kids: "Kids ministry", finance: "Finance", communications: "Communications", reporting: "Reporting", exports: "Exports", api: "API access" },
  es: { guests: "Invitados", members: "Miembros", attendance: "Asistencia", follow_up: "Seguimiento", care: "Cuidado pastoral", meetings: "Reuniones", kids: "Ministerio infantil", finance: "Finanzas", communications: "Comunicaciones", reporting: "Informes", exports: "Exportaciones", api: "Acceso API" },
  fr: { guests: "Invités", members: "Membres", attendance: "Présences", follow_up: "Suivi", care: "Accompagnement", meetings: "Réunions", kids: "Ministère des enfants", finance: "Finances", communications: "Communications", reporting: "Rapports", exports: "Exports", api: "Accès API" },
  pt: { guests: "Visitantes", members: "Membros", attendance: "Presença", follow_up: "Acompanhamento", care: "Cuidado pastoral", meetings: "Reuniões", kids: "Ministério infantil", finance: "Finanças", communications: "Comunicações", reporting: "Relatórios", exports: "Exportações", api: "Acesso à API" },
};

const QUOTAS: Record<string, Record<string, string>> = {
  en: { branches: "branches", users: "staff accounts", members: "members", children: "children" },
  es: { branches: "sedes", users: "cuentas de personal", members: "miembros", children: "niños" },
  fr: { branches: "antennes", users: "comptes du personnel", members: "membres", children: "enfants" },
  pt: { branches: "congregações", users: "contas de equipe", members: "membros", children: "crianças" },
};

const MESSAGES: Record<string, Record<PlanErrorCode, string>> = {
  en: {
    feature_locked: "{feature} is not included in your plan. Contact the ChuFlow operators to upgrade.",
    quota_exceeded: "Your plan allows {limit} {quota} and you already have {current}. Contact the ChuFlow operators to raise the limit.",
    workspace_read_only: "This workspace is read-only until a payment is recorded. Nothing can be added or changed right now.",
    workspace_locked: "This workspace is locked. Contact the ChuFlow operators to restore access.",
    workspace_suspended: "This workspace has been suspended. Contact the ChuFlow operators.",
  },
  es: {
    feature_locked: "{feature} no está incluido en su plan. Contacte a los operadores de ChuFlow para ampliarlo.",
    quota_exceeded: "Su plan permite {limit} {quota} y ya tiene {current}. Contacte a los operadores de ChuFlow para aumentar el límite.",
    workspace_read_only: "Este espacio es de solo lectura hasta que se registre un pago. No se puede añadir ni cambiar nada por ahora.",
    workspace_locked: "Este espacio está bloqueado. Contacte a los operadores de ChuFlow para recuperar el acceso.",
    workspace_suspended: "Este espacio ha sido suspendido. Contacte a los operadores de ChuFlow.",
  },
  fr: {
    feature_locked: "{feature} ne fait pas partie de votre offre. Contactez les opérateurs ChuFlow pour l'ajouter.",
    quota_exceeded: "Votre offre autorise {limit} {quota} et vous en avez déjà {current}. Contactez les opérateurs ChuFlow pour relever la limite.",
    workspace_read_only: "Cet espace est en lecture seule jusqu'à l'enregistrement d'un paiement. Rien ne peut être ajouté ou modifié pour l'instant.",
    workspace_locked: "Cet espace est verrouillé. Contactez les opérateurs ChuFlow pour rétablir l'accès.",
    workspace_suspended: "Cet espace a été suspendu. Contactez les opérateurs ChuFlow.",
  },
  pt: {
    feature_locked: "{feature} não está incluído no seu plano. Fale com os operadores do ChuFlow para fazer o upgrade.",
    quota_exceeded: "O seu plano permite {limit} {quota} e você já tem {current}. Fale com os operadores do ChuFlow para aumentar o limite.",
    workspace_read_only: "Este espaço está em modo somente leitura até que um pagamento seja registrado. Nada pode ser adicionado ou alterado agora.",
    workspace_locked: "Este espaço está bloqueado. Fale com os operadores do ChuFlow para restaurar o acesso.",
    workspace_suspended: "Este espaço foi suspenso. Fale com os operadores do ChuFlow.",
  },
};

function currentLocale() {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/(?:^|;\s*)chuflow_locale=([a-z]{2})/);
  const locale = match?.[1] ?? document.documentElement.lang.slice(0, 2);
  return locale in MESSAGES ? locale : "en";
}

export function planErrorMessage(code: PlanErrorCode, details: { feature?: string; quota?: string; limit?: number; current?: number } = {}) {
  const locale = currentLocale();
  const feature = details.feature ? (FEATURES[locale][details.feature] ?? details.feature) : "";
  const quota = details.quota ? (QUOTAS[locale][details.quota] ?? details.quota) : "";
  return MESSAGES[locale][code]
    .replace("{feature}", feature)
    .replace("{quota}", quota)
    .replace("{limit}", String(details.limit ?? ""))
    .replace("{current}", String(details.current ?? ""));
}
