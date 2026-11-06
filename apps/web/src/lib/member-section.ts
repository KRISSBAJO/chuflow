export type MemberSection = "all" | "profile" | "growth" | "groups";
const profileFields = [
  "title",
  "firstName",
  "lastName",
  "email",
  "phone",
  "membershipStatus",
  "dateJoinedChurch",
  "familyDetails",
];
const growthFields = [
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
];
export function memberSectionPayload(data: FormData, section: MemberSection) {
  const fields =
    section === "profile"
      ? profileFields
      : section === "growth"
        ? growthFields
        : section === "all"
          ? [...profileFields, ...growthFields]
          : [];
  const payload: Record<string, unknown> = {};
  for (const key of fields)
    if (data.has(key))
      payload[key] = key === "email" && !data.get(key) ? null : data.get(key);
  if (section === "all" || section === "groups")
    payload.serviceUnitIds = data.getAll("serviceUnitIds");
  return payload;
}
