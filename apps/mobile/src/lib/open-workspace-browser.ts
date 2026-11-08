import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { toast } from '@/components/toast';
import { translate } from '@/i18n/provider';
import { getApiSession, request } from './api';
import { SHARED_WORKSPACES } from './config';

export async function openWorkspaceBrowser(path: string, workspace?: { id: string; name: string }) {
  const session = getApiSession();
  try {
    if (!SHARED_WORKSPACES || !workspace || Platform.OS === 'web') {
      const url = SHARED_WORKSPACES
        ? `${session.webUrl}/login?returnTo=${encodeURIComponent(path)}`
        : session.webUrl + path;
      await WebBrowser.openBrowserAsync(url);
      return;
    }

    const { handoff } = await request<{ handoff: string }>('POST', '/auth/browser-handoff', {}, { ...session });
    if (session !== getApiSession()) return;
    const fragment = new URLSearchParams({ handoff, workspace: workspace.id, name: workspace.name, returnTo: path });
    await WebBrowser.openBrowserAsync(`${session.webUrl}/open-in-browser#${fragment}`);
  } catch {
    toast.error(translate('auth.workspacePicker.failed'));
  }
}
