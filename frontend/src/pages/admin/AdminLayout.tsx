import { Outlet } from 'react-router-dom';

export default function AdminLayout(): JSX.Element {
  return (
    <div className="flex flex-col gap-6 w-full">
      <Outlet />
    </div>
  );
}
