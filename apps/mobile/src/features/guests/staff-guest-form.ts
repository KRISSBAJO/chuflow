export type StaffGuestForm = {
  revision: number;
  branchId?: string | null;
  hiddenStaff: string[];
  fields: {
    key: string;
    label: string;
    labelEs?: string;
    labelFr?: string;
    labelPt?: string;
    type: 'text' | 'textarea' | 'number' | 'select' | 'email' | 'tel';
    options: string[];
    required: boolean;
  }[];
};
