export const FOLLOW_UP_STATUS_OPTIONS = [
  {
    value: "new",
    label: "New",
    description: "Fresh guest record waiting for a care owner.",
  },
  {
    value: "assigned",
    label: "Assigned",
    description: "A branch admin or follow-up worker owns the next step.",
  },
  {
    value: "contacted",
    label: "Contacted",
    description: "The guest has been reached and the response was logged.",
  },
  {
    value: "prayed_with",
    label: "Prayed with",
    description: "Prayer or encouragement has already been offered.",
  },
  {
    value: "invited_back",
    label: "Invited back",
    description: "An invitation to the next service or gathering has been sent.",
  },
  {
    value: "returned",
    label: "Returned",
    description: "The guest came back to another service.",
  },
  {
    value: "converted",
    label: "Converted",
    description: "The guest is moving into the member pathway.",
  },
] as const;

export const FOLLOW_UP_CONTACT_METHOD_OPTIONS = [
  { value: "phone_call", label: "Phone call" },
  { value: "text_message", label: "Text message" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "in_person", label: "In person" },
  { value: "registration", label: "Registration" },
  { value: "attendance", label: "Attendance" },
] as const;

export function formatFollowUpValue(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeFollowUpStatus(status: string, assignedTo?: string | null) {
  if (assignedTo && status === "new") {
    return "assigned";
  }

  if (!assignedTo && status === "assigned") {
    return "new";
  }

  return status;
}
