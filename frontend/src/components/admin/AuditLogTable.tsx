import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import * as adminApi from '@/api/admin';
import { cn } from '@/lib/utils';

interface AuditLogTableProps {
  logs: adminApi.AuditLog[];
  isLoading: boolean;
}

const actionColors: Record<string, string> = {
  CLEAR_ALL_DATA: 'badge-danger',
  DELETE_USER: 'badge-danger',
  UPDATE_USER_ROLE: 'badge-warning',
  EXPORT_BACKUP: 'badge-primary',
  DELETE_TOURNAMENT: 'badge-warning',
};

const actionLabels: Record<string, string> = {
  CLEAR_ALL_DATA: 'Clear All Data',
  DELETE_USER: 'Delete User',
  UPDATE_USER_ROLE: 'Update Role',
  EXPORT_BACKUP: 'Export Backup',
  DELETE_TOURNAMENT: 'Delete Tournament',
};

export default function AuditLogTable({ logs, isLoading }: AuditLogTableProps): JSX.Element {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="card">
        <div className="card-body">
          <p className="text-dark-50 text-center py-8">Loading audit logs...</p>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="card">
        <div className="card-body">
          <p className="text-dark-50 text-center py-8">No audit logs found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-300">
              <th className="text-left p-4 text-sm font-medium text-dark-50">Timestamp</th>
              <th className="text-left p-4 text-sm font-medium text-dark-50">Action</th>
              <th className="text-left p-4 text-sm font-medium text-dark-50">Actor</th>
              <th className="text-left p-4 text-sm font-medium text-dark-50">IP Address</th>
              <th className="text-left p-4 text-sm font-medium text-dark-50">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <>
                <tr key={log.id} className="border-b border-dark-300 hover:bg-dark-400/50">
                  <td className="p-4">
                    <span className="text-dark-50 text-sm">
                      {new Date(log.createdAt).toLocaleString('fr-FR')}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={cn('badge', actionColors[log.action] || 'badge-secondary')}>
                      {actionLabels[log.action] || log.action}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-gray-100 text-sm">
                        {log.actor.prenom} {log.actor.nom}
                      </span>
                      <span className="text-dark-50 text-xs">{log.actor.email}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-dark-50 text-sm font-mono">
                      {log.ipAddress || '—'}
                    </span>
                  </td>
                  <td className="p-4">
                    {log.details && (
                      <button
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        className="text-primary-400 hover:text-primary-300 text-sm flex items-center gap-1"
                      >
                        {expandedId === log.id ? (
                          <>
                            <ChevronUp size={14} />
                            Hide
                          </>
                        ) : (
                          <>
                            <ChevronDown size={14} />
                            Show
                          </>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
                {expandedId === log.id && log.details && (
                  <tr className="bg-dark-400/30">
                    <td colSpan={5} className="p-4">
                      <pre className="text-xs text-dark-50 bg-dark-500 p-3 rounded overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
