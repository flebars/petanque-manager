import { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import * as adminApi from '@/api/admin';
import toast from 'react-hot-toast';

interface RoleEditorProps {
  isOpen: boolean;
  onClose: () => void;
  user: adminApi.User | null;
  onSuccess: () => void;
}

const roleOptions = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', color: 'text-danger-400' },
  { value: 'ORGANISATEUR', label: 'Organisateur', color: 'text-warning-400' },
  { value: 'ARBITRE', label: 'Arbitre', color: 'text-primary-400' },
  { value: 'CAPITAINE', label: 'Capitaine', color: 'text-success-400' },
  { value: 'SPECTATEUR', label: 'Spectateur', color: 'text-dark-50' },
];

export default function RoleEditor({
  isOpen,
  onClose,
  user,
  onSuccess,
}: RoleEditorProps): JSX.Element {
  const [newRole, setNewRole] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user || !newRole || !password) {
      toast.error('Please fill all fields');
      return;
    }

    if (newRole === user.role) {
      toast.error('New role must be different from current role');
      return;
    }

    setIsLoading(true);
    try {
      await adminApi.updateUserRole(user.id, { newRole, password });
      toast.success(`Role updated to ${roleOptions.find((r) => r.value === newRole)?.label}`);
      onSuccess();
      onClose();
      setNewRole('');
      setPassword('');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to update role');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return <></>;

  return (
    <Modal open={isOpen} onClose={onClose} title="Edit User Role">
      <div className="space-y-4">
        <div className="bg-dark-400 p-4 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-dark-50">User:</span>
            <span className="text-gray-100 font-medium">
              {user.prenom} {user.nom}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-dark-50">Email:</span>
            <span className="text-gray-100">{user.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-dark-50">Current Role:</span>
            <span className={roleOptions.find((r) => r.value === user.role)?.color}>
              {roleOptions.find((r) => r.value === user.role)?.label}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-50 mb-2">New Role</label>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="input w-full"
          >
            <option value="">Select a role...</option>
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value} disabled={option.value === user.role}>
                {option.label}
                {option.value === user.role ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </div>

        {user.role === 'SUPER_ADMIN' && (
          <div className="bg-warning-900/20 border border-warning-600 rounded-lg p-3">
            <p className="text-warning-400 text-sm">
              ⚠️ Warning: Removing SUPER_ADMIN privileges requires password confirmation
            </p>
          </div>
        )}

        <Input
          type="password"
          label="Your password to confirm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
        />

        <div className="flex gap-3 justify-end pt-4 border-t border-dark-300">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!newRole || !password || isLoading}
          >
            {isLoading ? 'Updating...' : 'Update Role'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
