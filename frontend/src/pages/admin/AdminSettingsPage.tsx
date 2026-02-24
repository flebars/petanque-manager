import { useState } from 'react';
import { Button } from '@/components/common/Button';
import ClearDataModal from '@/components/admin/ClearDataModal';
import BackupButton from '@/components/admin/BackupButton';

export default function AdminSettingsPage(): JSX.Element {
  const [clearModalOpen, setClearModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">System Settings</h1>
        <p className="text-dark-50 text-sm mt-1">Manage system data and configuration</p>
      </div>

      <div className="card border-2 border-danger-600">
        <div className="card-header bg-danger-900/20">
          <h2 className="text-lg font-bold text-danger-400 flex items-center gap-2">
            <span>⚠️</span>
            <span>Danger Zone</span>
          </h2>
        </div>
        <div className="card-body space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-100">Clear All Data</h3>
              <p className="text-sm text-dark-50 mt-1">
                Permanently delete all users (except SUPER_ADMINs) and all tournament data
              </p>
            </div>
            <Button variant="danger" onClick={() => setClearModalOpen(true)}>
              Clear All Data
            </Button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-bold text-gray-100">Database Backup</h2>
        </div>
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-100">Export Database</h3>
              <p className="text-sm text-dark-50 mt-1">
                Download a complete backup of all data as JSON
              </p>
            </div>
            <BackupButton />
          </div>
        </div>
      </div>

      <ClearDataModal
        isOpen={clearModalOpen}
        onClose={() => setClearModalOpen(false)}
        onSuccess={() => {
          setClearModalOpen(false);
          setTimeout(() => window.location.reload(), 1000);
        }}
      />
    </div>
  );
}
