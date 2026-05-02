'use client';
import React, { useEffect, useState, useCallback } from 'react';

type AuditLog = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: string | null;
  performedBy: string | null;
  createdAt: string;
};

export function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/audit-logs');
    if (r.ok) {
      setLogs(await r.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = logs.filter(log => {
    if (!filterText) return true;
    const text = filterText.toLowerCase();
    return (
      (log.action || '').toLowerCase().includes(text) ||
      (log.entityType || '').toLowerCase().includes(text) ||
      (log.entityId || '').toLowerCase().includes(text) ||
      (log.performedBy || '').toLowerCase().includes(text) ||
      (log.details || '').toLowerCase().includes(text)
    );
  });

  return (
    <div>
      <div className="al-bar">
        <div className="al-bar-left">
          <input
            type="text"
            className="al-search-input"
            placeholder="Search logs..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <span className="al-count">{filteredLogs.length} Audit Logs</span>
        </div>
        <button className="al-btn-refresh" onClick={loadLogs}>Refresh</button>
      </div>

      {loading ? (
        <div className="al-empty">Loading logs...</div>
      ) : (
        <div className="al-table-wrap">
          <table className="al-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Entity Type</th>
                <th>Entity ID</th>
                <th>User</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="al-row">
                  <td className="al-time">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="al-action"><span className="al-badge">{log.action}</span></td>
                  <td>{log.entityType || '—'}</td>
                  <td className="al-mono">{log.entityId || '—'}</td>
                  <td>{log.performedBy || 'System'}</td>
                  <td className="al-details">{log.details || '—'}</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="al-empty">No audit logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .al-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; gap: 1rem; }
        .al-bar-left { display: flex; align-items: center; gap: 1rem; flex: 1; }
        .al-search-input { padding: .5rem .8rem; background: rgba(255, 255, 255, .03); border: 1px solid rgba(255, 255, 255, .1); border-radius: 6px; color: #fff; font-size: .8125rem; width: 300px; outline: none; transition: all .2s; }
        .al-search-input:focus { border-color: rgba(99, 102, 241, .5); background: rgba(255, 255, 255, .05); }
        .al-count { font-size: .8125rem; color: rgba(255, 255, 255, .4); font-weight: 500; }
        .al-btn-refresh { padding: .4rem .8rem; background: rgba(255, 255, 255, .06); border: 1px solid rgba(255, 255, 255, .1); border-radius: 6px; color: #fff; font-size: .75rem; cursor: pointer; transition: all .2s; white-space: nowrap; }
        .al-btn-refresh:hover { background: rgba(255, 255, 255, .1); }
        .al-table-wrap { overflow-x: auto; border: 1px solid rgba(255, 255, 255, .08); border-radius: 14px; background: rgba(255, 255, 255, .02); }
        .al-table { width: 100%; border-collapse: collapse; font-size: .8125rem; }
        .al-table thead th { padding: .75rem 1rem; text-align: left; font-size: .6875rem; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: rgba(255, 255, 255, .3); border-bottom: 1px solid rgba(255, 255, 255, .07); }
        .al-row { border-bottom: 1px solid rgba(255, 255, 255, .05); transition: background .15s; }
        .al-row:hover { background: rgba(255, 255, 255, .03); }
        .al-row td { padding: .75rem 1rem; color: rgba(255, 255, 255, .8); vertical-align: middle; }
        .al-time { font-family: monospace; font-size: .75rem; color: rgba(255, 255, 255, .5); }
        .al-mono { font-family: monospace; font-size: .75rem; color: rgba(255, 255, 255, .6); }
        .al-badge { display: inline-block; padding: .2rem .5rem; background: rgba(99, 102, 241, .15); color: #a5b4fc; border-radius: 4px; font-size: .7rem; font-weight: 600; text-transform: uppercase; }
        .al-details { font-size: .75rem; color: rgba(255, 255, 255, .5); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .al-empty { padding: 3rem; text-align: center; color: rgba(255, 255, 255, .25); font-size: .875rem; }
      `}</style>
    </div>
  );
}
