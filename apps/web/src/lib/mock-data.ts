export const dashboardStats = [
  { label: "First Timers Today", value: "24", delta: "+8 vs last Sunday", tone: "warm" as const },
  { label: "Guests This Week", value: "113", delta: "Across 3 services", tone: "cool" as const },
  { label: "Pending Follow-Up", value: "39", delta: "12 due today", tone: "warm" as const },
  { label: "Conversions", value: "17", delta: "This month", tone: "cool" as const },
];

export const guests = [
  {
    id: "GST-001",
    name: "Amara Johnson",
    phone: "(312) 555-0101",
    email: "amara.j@example.com",
    status: "First time",
    nextStep: "Assign worker",
    branch: "Downtown",
    service: "Sunday 9AM",
  },
  {
    id: "GST-002",
    name: "Daniel Okafor",
    phone: "(312) 555-0112",
    email: "daniel.o@example.com",
    status: "Returned",
    nextStep: "Convert to member",
    branch: "West Campus",
    service: "Sunday 11AM",
  },
  {
    id: "GST-003",
    name: "Ruth Mensah",
    phone: "(312) 555-0188",
    email: "ruth.m@example.com",
    status: "Contacted",
    nextStep: "Prayer call",
    branch: "Downtown",
    service: "Midweek",
  },
  {
    id: "GST-004",
    name: "Samuel Carter",
    phone: "(773) 555-0192",
    email: "samuel.c@example.com",
    status: "Assigned",
    nextStep: "Send welcome email",
    branch: "North Campus",
    service: "Sunday 9AM",
  },
];

export const followUpColumns = [
  {
    title: "New",
    count: 12,
    color: "bg-amber-50",
    items: [
      { name: "Chinelo Obi", action: "New guest card submitted", owner: "Unassigned" },
      { name: "Grace Bello", action: "Need welcome call", owner: "Unassigned" },
    ],
  },
  {
    title: "Assigned",
    count: 9,
    color: "bg-sky-50",
    items: [
      { name: "Nathan Cole", action: "Call by 4PM", owner: "Martha A." },
      { name: "Gift Samuel", action: "Family follow-up", owner: "Peter U." },
    ],
  },
  {
    title: "Contacted",
    count: 11,
    color: "bg-emerald-50",
    items: [
      { name: "Joan Felix", action: "Invite to next service", owner: "Lydia R." },
      { name: "Mary Okeke", action: "Shared prayer request", owner: "Daniel P." },
    ],
  },
  {
    title: "Returned",
    count: 7,
    color: "bg-violet-50",
    items: [
      { name: "Victor Lane", action: "Prepare member conversion", owner: "Pastoral Care" },
      { name: "Abigail Reed", action: "Class orientation invite", owner: "Growth Team" },
    ],
  },
];

export const members = [
  {
    id: "MBR-1001",
    name: "Daniel Okafor",
    status: "Active",
    baptism: "Completed",
    foundation: "Completed",
    serviceUnit: "Hospitality",
  },
  {
    id: "MBR-1002",
    name: "Abigail Reed",
    status: "New member",
    baptism: "Pending",
    foundation: "In progress",
    serviceUnit: "Choir",
  },
  {
    id: "MBR-1003",
    name: "Tosin Clark",
    status: "Active",
    baptism: "Completed",
    foundation: "Completed",
    serviceUnit: "Media",
  },
];

export const attendanceSummary = [
  { label: "Sunday 9AM", total: 286, guests: 31, members: 255 },
  { label: "Sunday 11AM", total: 344, guests: 42, members: 302 },
  { label: "Midweek", total: 128, guests: 9, members: 119 },
];

export const branches = [
  { name: "Downtown", members: 812, guests: 46, team: 18, status: "Healthy" },
  { name: "West Campus", members: 534, guests: 22, team: 11, status: "Growing" },
  { name: "North Campus", members: 321, guests: 15, team: 8, status: "Needs follow-up" },
];

export const activityFeed = [
  "17 first-time guests captured after Sunday 11AM service.",
  "5 guests moved from contacted to returned.",
  "3 people converted to member records this week.",
  "Attendance summary synced for all active branches.",
];

export const communicationTemplates = [
  "Welcome first-timer",
  "Thank you for worshipping with us",
  "Next service reminder",
  "Pastoral follow-up message",
];
