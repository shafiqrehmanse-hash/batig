const SYSTEM_LABEL = 'System';

function isOwner(user) {
  return (user?.role || 'player') === 'owner';
}

function isViewerOwner(viewerAuth) {
  return viewerAuth?.role === 'owner';
}

async function getOwnerUsernames(db) {
  const { data } = await db.from('users').select('username').eq('role', 'owner');
  return new Set((data || []).map((u) => (u.username || '').toLowerCase()).filter(Boolean));
}

async function getHiddenOwnerCount(db) {
  const { count } = await db.from('users').select('*', { count: 'exact', head: true }).eq('role', 'owner');
  return count || 0;
}

function maskUsername(name, ownerNames, viewerAuth) {
  if (!name) return name;
  if (isViewerOwner(viewerAuth)) return name;
  const lower = name.toLowerCase();
  if (ownerNames.has(lower)) return SYSTEM_LABEL;
  return name;
}

/** Remove owner account from lists shown to staff (owner still sees themselves). */
function filterOwnerRows(users, viewerAuth) {
  if (isViewerOwner(viewerAuth)) return users || [];
  return (users || []).filter((u) => !isOwner(u));
}

function visibleUserCount(totalCount, viewerAuth, hiddenOwnerCount = 1) {
  if (isViewerOwner(viewerAuth)) return totalCount;
  return Math.max(0, totalCount - hiddenOwnerCount);
}

async function maskAuditLogs(logs, db, viewerAuth) {
  if (isViewerOwner(viewerAuth)) return logs || [];
  const ownerNames = await getOwnerUsernames(db);
  return (logs || []).map((l) => ({
    ...l,
    actor_username: maskUsername(l.actor_username, ownerNames, viewerAuth),
    target_username: maskUsername(l.target_username, ownerNames, viewerAuth)
  }));
}

async function filterOwnerRequests(requests, db, viewerAuth) {
  if (isViewerOwner(viewerAuth)) return requests || [];
  const ownerNames = await getOwnerUsernames(db);
  return (requests || []).filter((r) => !ownerNames.has((r.username || '').toLowerCase()));
}

async function filterLeaderboard(entries, db, viewerAuth = null) {
  if (isViewerOwner(viewerAuth)) return entries || [];
  const ownerNames = await getOwnerUsernames(db);
  return (entries || []).filter((e) => !ownerNames.has((e.username || '').toLowerCase()));
}

module.exports = {
  SYSTEM_LABEL,
  filterOwnerRows,
  visibleUserCount,
  getHiddenOwnerCount,
  maskAuditLogs,
  filterOwnerRequests,
  filterLeaderboard
};
