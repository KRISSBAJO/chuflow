export type SelectOption = {
  value: string;
  label: string;
};

export type MemberCourseFieldGroup = {
  key: string;
  title: string;
  statusName: string;
  dateName: string;
  locationName: string;
  question: string;
  helperText: string;
};

export const MEMBERSHIP_STATUS_OPTIONS: SelectOption[] = [
  { value: "active", label: "Active" },
  { value: "new_member", label: "New member" },
  { value: "worker", label: "Worker" },
  { value: "inactive", label: "Inactive" },
];

export const MEMBER_TITLE_OPTIONS: SelectOption[] = [
  { value: "bro", label: "Bro" },
  { value: "sister", label: "Sister" },
  { value: "pastor", label: "Pastor" },
  { value: "resident_pastor", label: "Resident Pastor" },
  { value: "associate_pastor", label: "Associate Pastor" },
  { value: "deacon", label: "Deacon" },
  { value: "deaconess", label: "Deaconess" },
  { value: "apostle", label: "Apostle" },
  { value: "other", label: "Other" },
];

export const YES_NO_OPTIONS: SelectOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export const WEEKDAY_OPTIONS: SelectOption[] = [
  { value: "Monday", label: "Monday" },
  { value: "Tuesday", label: "Tuesday" },
  { value: "Wednesday", label: "Wednesday" },
  { value: "Thursday", label: "Thursday" },
  { value: "Friday", label: "Friday" },
  { value: "Saturday", label: "Saturday" },
  { value: "Sunday", label: "Sunday" },
];

export const MEMBER_COURSE_GROUPS: MemberCourseFieldGroup[] = [
  {
    key: "believerFoundationClass",
    title: "Believers Foundation Class",
    statusName: "believerFoundationClassStatus",
    dateName: "believerFoundationClassDate",
    locationName: "believerFoundationClassLocation",
    question: "Have you attended Believers Foundation Class?",
    helperText: "Record whether the member has attended, plus the date and location when known.",
  },
  {
    key: "bcc",
    title: "BCC",
    statusName: "bccStatus",
    dateName: "bccDate",
    locationName: "bccLocation",
    question: "Have you attended BCC?",
    helperText: "Treat BCC as a Bible school course record with attendance, date, and location.",
  },
  {
    key: "lcc",
    title: "LCC",
    statusName: "lccStatus",
    dateName: "lccDate",
    locationName: "lccLocation",
    question: "Have you attended LCC?",
    helperText: "Treat LCC as a Bible school course record with attendance, date, and location.",
  },
  {
    key: "lcd",
    title: "LCD",
    statusName: "lcdStatus",
    dateName: "lcdDate",
    locationName: "lcdLocation",
    question: "Have you attended LCD?",
    helperText: "Treat LCD as a Bible school course record with attendance, date, and location.",
  },
];

export function normalizeYesNoValue(value?: string) {
  if (!value) {
    return "";
  }

  const normalized = value.toLowerCase();

  if (["yes", "completed", "received", "in_progress"].includes(normalized)) {
    return "yes";
  }

  if (["no", "not_started", "not_yet"].includes(normalized)) {
    return "no";
  }

  return value;
}

export function formatYesNoStatus(value?: string) {
  const normalized = normalizeYesNoValue(value);

  if (!normalized) {
    return "Not recorded";
  }

  if (normalized === "yes") {
    return "Yes";
  }

  if (normalized === "no") {
    return "No";
  }

  return (value || normalized)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatMembershipStatus(value?: string) {
  if (!value) {
    return "Not recorded";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatMemberTitle(value?: string) {
  if (!value) {
    return "";
  }

  return (
    MEMBER_TITLE_OPTIONS.find((option) => option.value === value.toLowerCase())?.label ||
    value
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}
