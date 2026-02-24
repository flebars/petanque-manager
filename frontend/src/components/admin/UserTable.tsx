import { Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import * as adminApi from '@/api/admin';
import { cn } from '@/lib/utils';

interface UserTableProps {
  users: adminApi.User[];
  isLoading: boolean;
  onEditRole: (user: adminApi.User) => void;
  onDelete: (user: adminApi.User) => void;
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'badge-danger',
  ORGANISATEUR: 'badge-warning',
  ARBITRE: 'badge-primary',
  CAPITAINE: 'badge-success',
  SPECTATEUR: 'badge-secondary',
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ORGANISATEUR: 'Organisateur',
  ARBITRE: 'Arbitre',
  CAPITAINE: 'Capitaine',
  SPECTATEUR: 'Spectateur',
};

export default function UserTable({
  users,
  isLoading,
  onEditRole,
  onDelete,
}: UserTableProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="card">
        <div className="card-body">
          <p className="text-dark-50 text-center py-8">Loading users...</p>
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="card">
        <div className="card-body">
          <p className="text-dark-50 text-center py-8">No users found</p>
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
              <th className="text-left p-4 text-sm font-medium text-dark-50">Name</th>
              <th className="text-left p-4 text-sm font-medium text-dark-50">Email</th>
              <th className="text-left p-4 text-sm font-medium text-dark-50">Club</th>
              <th className="text-left p-4 text-sm font-medium text-dark-50">Role</th>
              <th className="text-left p-4 text-sm font-medium text-dark-50">Created</th>
              <th className="text-right p-4 text-sm font-medium text-dark-50">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-dark-300 hover:bg-dark-400/50">
                <td className="p-4">
                  <span className="text-gray-100 font-medium">
                    {user.prenom} {user.nom}
                  </span>
                </td>
                <td className="p-4">
                  <span className="text-dark-50">{user.email}</span>
                </td>
                <td className="p-4">
                  <span className="text-dark-50">{user.club || '—'}</span>
                </td>
                <td className="p-4">
                  <span className={cn('badge', roleColors[user.role] || 'badge-secondary')}>
                    {roleLabels[user.role] || user.role}
                  </span>
                </td>
                <td className="p-4">
                  <span className="text-dark-50 text-sm">
                    {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => onEditRole(user)}
                      className="p-2"
                      title="Edit role"
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => onDelete(user)}
                      className="p-2 text-danger-400 hover:text-danger-300"
                      title="Delete user"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
