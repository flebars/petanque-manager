import { useState, useEffect } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import * as adminApi from '@/api/admin';
import toast from 'react-hot-toast';

type Step = 'preview' | 'backup' | 'confirm';

interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ClearDataModal({
  isOpen,
  onClose,
  onSuccess,
}: ClearDataModalProps): JSX.Element {
  const [step, setStep] = useState<Step>('preview');
  const [stats, setStats] = useState<adminApi.SystemStats | null>(null);
  const [createBackup, setCreateBackup] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('preview');
      setConfirmText('');
      setPassword('');
      setCreateBackup(true);
      setIsLoadingStats(true);
      adminApi
        .getStats()
        .then(setStats)
        .catch(() => toast.error('Failed to load stats'))
        .finally(() => setIsLoadingStats(false));
    }
  }, [isOpen]);

  const handleNext = async () => {
    if (step === 'preview') {
      setStep('backup');
    } else if (step === 'backup') {
      if (createBackup) {
        try {
          const data = await adminApi.exportBackup();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `petanque-backup-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success('Backup downloaded');
        } catch (error: any) {
          toast.error('Failed to create backup');
          return;
        }
      }
      setStep('confirm');
    }
  };

  const handleConfirm = async () => {
    if (confirmText !== 'DELETE') {
      toast.error('You must type DELETE to confirm');
      return;
    }
    if (!password) {
      toast.error('Password is required');
      return;
    }

    setIsLoading(true);
    try {
      const result = await adminApi.clearAllData({ confirmText, password });
      toast.success(
        `Deleted ${result.deleted.tournaments} tournaments and ${result.deleted.users} users`,
      );
      onSuccess();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to clear data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Clear All Data">
      {step === 'preview' && (
        <div className="space-y-4">
          <p className="text-dark-50">
            This action will <strong className="text-danger-400">permanently delete</strong>:
          </p>
          {isLoadingStats ? (
            <p className="text-dark-50">Loading statistics...</p>
          ) : (
            <ul className="space-y-2 bg-dark-400 p-4 rounded-lg">
              <li className="flex justify-between text-sm">
                <span className="text-dark-50">Tournaments:</span>
                <span className="text-gray-100 font-medium">{stats?.tournaments || 0}</span>
              </li>
              <li className="flex justify-between text-sm">
                <span className="text-dark-50">Teams:</span>
                <span className="text-gray-100 font-medium">{stats?.teams || 0}</span>
              </li>
              <li className="flex justify-between text-sm">
                <span className="text-dark-50">Matches:</span>
                <span className="text-gray-100 font-medium">{stats?.matches || 0}</span>
              </li>
              <li className="flex justify-between text-sm border-t border-dark-300 pt-2 mt-2">
                <span className="text-dark-50">Users (excluding admins):</span>
                <span className="text-gray-100 font-medium">
                  {(stats?.users || 0) - (stats?.adminUsers || 0)}
                </span>
              </li>
            </ul>
          )}
          <p className="text-success-400 text-sm">
            ✓ Preserved: {stats?.adminUsers || 0} SUPER_ADMIN user(s)
          </p>
          <div className="flex gap-3 justify-end pt-4 border-t border-dark-300">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="warning" onClick={handleNext}>
              Next: Backup Options
            </Button>
          </div>
        </div>
      )}

      {step === 'backup' && (
        <div className="space-y-4">
          <p className="text-dark-50">Before clearing all data, you can create a backup.</p>
          <label className="flex items-center gap-3 bg-dark-400 p-4 rounded-lg cursor-pointer hover:bg-dark-300 transition-colors">
            <input
              type="checkbox"
              checked={createBackup}
              onChange={(e) => setCreateBackup(e.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <span className="text-gray-100 font-medium block">
                Create backup before clearing
              </span>
              <span className="text-dark-50 text-sm">Recommended for data recovery</span>
            </div>
          </label>
          <div className="flex gap-3 justify-end pt-4 border-t border-dark-300">
            <Button variant="ghost" onClick={() => setStep('preview')}>
              Back
            </Button>
            <Button variant="warning" onClick={handleNext}>
              {createBackup ? 'Download Backup & Continue' : 'Skip to Confirmation'}
            </Button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="bg-danger-900/20 border border-danger-600 rounded-lg p-4">
            <p className="text-danger-400 font-bold text-center">
              ⚠️ THIS ACTION CANNOT BE UNDONE ⚠️
            </p>
          </div>
          <div className="space-y-4">
            <Input
              label='Type "DELETE" to confirm'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
            <Input
              type="password"
              label="Enter your password to confirm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-dark-300">
            <Button variant="ghost" onClick={() => setStep('backup')} disabled={isLoading}>
              Back
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirm}
              disabled={confirmText !== 'DELETE' || !password || isLoading}
            >
              {isLoading ? 'Deleting...' : 'Delete Everything'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
