export const IMPORT_CONFIG = {
  guests: {
    label: "Guests",
    path: "/guests",
    fields: [
      "firstName",
      "lastName",
      "fullName",
      "title",
      "phone",
      "email",
      "gender",
      "dateOfBirth",
      "address",
      "city",
      "state",
      "zipCode",
      "maritalStatus",
      "invitedBy",
      "heardAboutChurch",
    ],
  },
  members: {
    label: "Members",
    path: "/members",
    fields: [
      "firstName",
      "lastName",
      "fullName",
      "title",
      "phone",
      "email",
      "membershipStatus",
      "dateJoinedChurch",
      "familyDetails",
      "serviceGroups",
      "believerFoundationClassStatus",
      "believerFoundationClassDate",
      "believerFoundationClassLocation",
      "bccStatus",
      "bccDate",
      "bccLocation",
      "lccStatus",
      "lccDate",
      "lccLocation",
      "lcdStatus",
      "lcdDate",
      "lcdLocation",
      "holySpiritBaptismStatus",
      "waterBaptismStatus",
    ],
  },
  service_units: {
    label: "Service groups",
    path: "/service-units",
    fields: ["name", "meetingDay", "prayerDay", "notes"],
  },
} as const;
export type ImportKind = keyof typeof IMPORT_CONFIG;
const labels: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name",
  phone: "Phone",
  email: "Email",
  dateOfBirth: "Date of birth",
  zipCode: "Postal / ZIP code",
  dateJoinedChurch: "Date joined church",
  serviceGroups: "Service groups",
  believerFoundationClassStatus: "Foundation class completed",
  believerFoundationClassDate: "Foundation class date",
  believerFoundationClassLocation: "Foundation class location",
  holySpiritBaptismStatus: "Holy Ghost baptism",
  waterBaptismStatus: "Water baptism",
  bccStatus: "BCC completed",
  bccDate: "BCC date",
  bccLocation: "BCC location",
  lccStatus: "LCC completed",
  lccDate: "LCC date",
  lccLocation: "LCC location",
  lcdStatus: "LCD completed",
  lcdDate: "LCD date",
  lcdLocation: "LCD location",
  name: "Group name",
};
export function importFieldLabel(key: string) {
  return (
    labels[key] ||
    key
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (c) => c.toUpperCase())
  );
}
const aliases: Record<string, string[]> = {
  firstName: ["first name", "given name", "nombre", "prenom"],
  lastName: [
    "last name",
    "surname",
    "family name",
    "apellido",
    "nom de famille",
  ],
  fullName: [
    "full name",
    "name",
    "member name",
    "guest name",
    "nombre completo",
    "nom complet",
  ],
  phone: [
    "phone",
    "telephone",
    "mobile",
    "phone number",
    "contact number",
    "telefono",
    "celular",
  ],
  email: ["email", "email address", "e mail", "correo", "courriel"],
  dateOfBirth: ["date of birth", "birth date", "dob", "fecha de nacimiento"],
  dateJoinedChurch: ["date joined", "joined date", "membership date"],
  serviceGroups: [
    "service groups",
    "service units",
    "ministry",
    "departments",
    "department",
  ],
  membershipStatus: ["membership status", "status"],
  name: ["group name", "unit name", "service group", "service unit", "name"],
  meetingDay: ["meeting day"],
  prayerDay: ["prayer day"],
};
const normalized = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function matchImportColumns(headers: string[], kind: ImportKind) {
  const result: Record<string, string> = {};
  const used = new Set<number>();
  for (const field of IMPORT_CONFIG[kind].fields) {
    const names = [
      field,
      importFieldLabel(field),
      ...(aliases[field] || []),
    ].map(normalized);
    const i = headers.findIndex(
      (h, index) => !used.has(index) && names.includes(normalized(h)),
    );
    if (i >= 0) {
      result[field] = String(i);
      used.add(i);
    }
  }
  return result;
}
