import type { Locale } from './locales';

/*
 * Every message part in every language. Parts are small JSON files, one top-level key equal to
 * the part name, like the website's apps/web/messages. Add a part here and run
 * `node scripts/check-messages.mjs` to confirm all four languages match.
 */

import en_common from './messages/en/common.json';
import en_auth from './messages/en/auth.json';
import en_home from './messages/en/home.json';
import en_guests from './messages/en/guests.json';
import en_followUp from './messages/en/followUp.json';
import en_attendance from './messages/en/attendance.json';
import en_approvals from './messages/en/approvals.json';
import en_more from './messages/en/more.json';
import en_members from './messages/en/members.json';
import en_care from './messages/en/care.json';
import en_finance from './messages/en/finance.json';
import en_meetings from './messages/en/meetings.json';
import en_kids from './messages/en/kids.json';
import en_reports from './messages/en/reports.json';
import en_search from './messages/en/search.json';
import fr_common from './messages/fr/common.json';
import fr_auth from './messages/fr/auth.json';
import fr_home from './messages/fr/home.json';
import fr_guests from './messages/fr/guests.json';
import fr_followUp from './messages/fr/followUp.json';
import fr_attendance from './messages/fr/attendance.json';
import fr_approvals from './messages/fr/approvals.json';
import fr_more from './messages/fr/more.json';
import fr_members from './messages/fr/members.json';
import fr_care from './messages/fr/care.json';
import fr_finance from './messages/fr/finance.json';
import fr_meetings from './messages/fr/meetings.json';
import fr_kids from './messages/fr/kids.json';
import fr_reports from './messages/fr/reports.json';
import fr_search from './messages/fr/search.json';
import es_common from './messages/es/common.json';
import es_auth from './messages/es/auth.json';
import es_home from './messages/es/home.json';
import es_guests from './messages/es/guests.json';
import es_followUp from './messages/es/followUp.json';
import es_attendance from './messages/es/attendance.json';
import es_approvals from './messages/es/approvals.json';
import es_more from './messages/es/more.json';
import es_members from './messages/es/members.json';
import es_care from './messages/es/care.json';
import es_finance from './messages/es/finance.json';
import es_meetings from './messages/es/meetings.json';
import es_kids from './messages/es/kids.json';
import es_reports from './messages/es/reports.json';
import es_search from './messages/es/search.json';
import pt_common from './messages/pt/common.json';
import pt_auth from './messages/pt/auth.json';
import pt_home from './messages/pt/home.json';
import pt_guests from './messages/pt/guests.json';
import pt_followUp from './messages/pt/followUp.json';
import pt_attendance from './messages/pt/attendance.json';
import pt_approvals from './messages/pt/approvals.json';
import pt_more from './messages/pt/more.json';
import pt_members from './messages/pt/members.json';
import pt_care from './messages/pt/care.json';
import pt_finance from './messages/pt/finance.json';
import pt_meetings from './messages/pt/meetings.json';
import pt_kids from './messages/pt/kids.json';
import pt_reports from './messages/pt/reports.json';
import pt_search from './messages/pt/search.json';

export const MESSAGE_PARTS = ['common', 'auth', 'home', 'guests', 'followUp', 'attendance', 'approvals', 'more', 'members', 'care', 'finance', 'meetings', 'kids', 'reports', 'search'] as const;
export type MessagePart = (typeof MESSAGE_PARTS)[number];

export const MESSAGES: Record<Locale, Record<string, unknown>> = {
  en: { ...en_common, ...en_auth, ...en_home, ...en_guests, ...en_followUp, ...en_attendance, ...en_approvals, ...en_more, ...en_members, ...en_care, ...en_finance, ...en_meetings, ...en_kids, ...en_reports, ...en_search },
  fr: { ...fr_common, ...fr_auth, ...fr_home, ...fr_guests, ...fr_followUp, ...fr_attendance, ...fr_approvals, ...fr_more, ...fr_members, ...fr_care, ...fr_finance, ...fr_meetings, ...fr_kids, ...fr_reports, ...fr_search },
  es: { ...es_common, ...es_auth, ...es_home, ...es_guests, ...es_followUp, ...es_attendance, ...es_approvals, ...es_more, ...es_members, ...es_care, ...es_finance, ...es_meetings, ...es_kids, ...es_reports, ...es_search },
  pt: { ...pt_common, ...pt_auth, ...pt_home, ...pt_guests, ...pt_followUp, ...pt_attendance, ...pt_approvals, ...pt_more, ...pt_members, ...pt_care, ...pt_finance, ...pt_meetings, ...pt_kids, ...pt_reports, ...pt_search },
};
