export function childrenApiAllowed(
  role: string | undefined,
  controller: unknown,
  handler: unknown,
) {
  if (role !== 'children_worker' && role !== 'children_supervisor') return true;
  if (controller === 'children') return true;
  return (
    controller === 'auth' &&
    ['me', 'logout', 'change-password', 'workspaces', 'workspaces/:workspaceId/handoff', 'browser-handoff'].includes(String(handler))
  );
}
