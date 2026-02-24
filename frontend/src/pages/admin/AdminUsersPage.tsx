import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import UserTable from '@/components/admin/UserTable';
import RoleEditor from '@/components/admin/RoleEditor';
import * as adminApi from '@/api/admin';
import toast from 'react-hot-toast';

export default function AdminUsersPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<adminApi.User | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, page],
    queryFn: () => adminApi.listUsers(search, page, 50),
  });

  const handleDeleteUser = async (user: adminApi.User) => {
    if (
      !confirm(
        `Are you sure you want to delete ${user.prenom} ${user.nom}? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await adminApi.deleteUser(user.id);
      toast.success('User deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to delete user');
    }
  };

  const handleRoleUpdateSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const totalPages = Math.ceil((data?.total || 0) / 50);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">User Management</h1>
          <p className="text-dark-50 text-sm mt-1">
            {data?.total || 0} users total
            {search && ` • ${data?.users.length || 0} matching "${search}"`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search by name, email, or club..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <UserTable
        users={data?.users || []}
        isLoading={isLoading}
        onEditRole={setEditingUser}
        onDelete={handleDeleteUser}
      />

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

      <RoleEditor
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        user={editingUser}
        onSuccess={handleRoleUpdateSuccess}
      />
    </div>
  );
}
