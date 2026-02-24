import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/common/Button';
import * as adminApi from '@/api/admin';
import toast from 'react-hot-toast';

export default function BackupButton(): JSX.Element {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
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
      
      toast.success('Backup downloaded successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to export backup');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="secondary"
      onClick={handleExport}
      disabled={isExporting}
      className="flex items-center gap-2"
    >
      <Download size={16} />
      {isExporting ? 'Exporting...' : 'Export Backup'}
    </Button>
  );
}
