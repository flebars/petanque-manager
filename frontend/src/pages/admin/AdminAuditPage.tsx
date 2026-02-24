import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/common/Button';
import AuditLogTable from '@/components/admin/AuditLogTable';
import * as adminApi from '@/api/admin';

const actionOptions = [
  { value: '', label: 'All actions' },
  { value: 'CLEAR_ALL_DATA', label: 'Clear All Data' },
  { value: 'DELETE_USER', label: 'Delete User' },
  { value: 'UPDATE_USER_ROLE', label: 'Update Role' },
  { value: 'EXPORT_BACKUP', label: 'Export Backup' },
  { value: 'DELETE_TOURNAMENT', label: 'Delete Tournament' },
];

export default function AdminAuditPage(): JSX.Element {
  const [actionFilter, setActionFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', actionFilter, page],
    queryFn: () => adminApi.listAuditLogs(actionFilter || undefined, page, 50),
  });

  const totalPages = Math.ceil((data?.total || 0) / 50);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Audit Log</h1>
        <p className="text-dark-50 text-sm mt-1">
          {data?.total || 0} audit entries
          {actionFilter && ` • Filtered by ${actionOptions.find((a) => a.value === actionFilter)?.label}`}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-64">
          <label className="block text-sm font-medium text-dark-50 mb-2">Filter by Action</label>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="input w-full"
          >
            {actionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <AuditLogTable logs={data?.logs || []} isLoading={isLoading} />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-dark-50 text-sm px-4">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
