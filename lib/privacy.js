const OWNER_LABEL = 'Owner';

async function getOwnerUsernames(db) {
  const { data } = await db.from('users').select('username').eq('role', 'owner');
  return new Set((data || []).map((u) => (u.username || '').toLowerCase()).filter(Boolean));
}

function maskUsername(name, ownerNames, viewerAuth) {
  if (!name) return name;
  const lower = name.toLowerCase();
  const viewerLower = (viewerAuth?.username || '').toLowerCase();
  if (ownerNames.has(lower) && lower !== viewerLower) return OWNER_LABEL;
  return name;
}

function maskUserRow(user, viewerAuth) {
  if (!user) return user;
  const role = user.role || 'player';
  if (role === 'owner' && user.id !== viewerAuth?.id) {
    return { ...user, username: OWNER_LABEL };
  }
  return user;
}

function maskUserRows(users, viewerAuth) {
  return (users || []).map((u) => maskUserRow(u, viewerAuth));
}

async function maskAuditLogs(logs, db, viewerAuth) {
  const ownerNames = await getOwnerUsernames(db);
  return (logs || []).map((l) => ({
    ...l,
    actor_username: maskUsername(l.actor_username, ownerNames, viewerAuth),
    target_username: maskUsername(l.target_username, ownerNames, viewerAuth)
  }));
}

async function maskRequestRows(requests, db, viewerAuth) {
  const ownerNames = await getOwnerUsernames(db);
  return (requests || []).map((r) => ({
    ...r,
    username: maskUsername(r.username, ownerNames, viewerAuth),
    processed_by: r.processed_by ? maskUsername(r.processed_by, ownerNames, viewerAuth) : r.processed_by
  }));
}

async function maskLeaderboard(entries, db, viewerAuth = null) {
  const { data: owners } = await db.from('users').select('id, username').eq('role', 'owner');
  const ownerByName = new Map((owners || []).map((o) => [(o.username || '').toLowerCase(), o.id]));

  return (entries || []).map((e) => {
    const ownerId = ownerByName.get((e.username || '').toLowerCase());
    if (!ownerId) return e;
    if (viewerAuth?.id === ownerId) return e;
    return { ...e, username: OWNER_LABEL };
  });
}

module.exports = {
  OWNER_LABEL,
  maskUsername,
  maskUserRow,
  maskUserRows,
  maskAuditLogs,
  maskRequestRows,
  maskLeaderboard
};
