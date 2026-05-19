// Offline Indicator Component - Shows sync status
import React, { useEffect, useState } from 'react';
import { syncService } from '../services/syncService';

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  pendingOperations: number;
}

const OfflineIndicator: React.FC = () => {
  const [status, setStatus] = useState<SyncStatus>(syncService.getStatus());

  useEffect(() => {
    const unsubscribe = syncService.subscribe((newStatus) => {
      setStatus(newStatus);
    });

    return unsubscribe;
  }, []);

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const handleManualSync = async () => {
    if (status.isOnline && !status.isSyncing) {
      await syncService.manualSync();
    }
  };

  if (!status.isOnline) {
    return (
      <div className="fixed bottom-20 right-4 md:bottom-8 md:right-6 bg-yellow-500 text-white px-3 py-2 rounded-md shadow-lg flex items-center gap-2 z-50">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
        </svg>
        <span className="font-medium">Offline Mode</span>
        {status.pendingOperations > 0 && (
          <span className="bg-white text-yellow-600 px-2 py-1 rounded text-xs font-bold">
            {status.pendingOperations} pending
          </span>
        )}
      </div>
    );
  }

  if (status.isSyncing) {
    return (
      <div className="fixed bottom-20 right-4 md:bottom-8 md:right-6 bg-blue-500 text-white px-3 py-2 rounded-md shadow-lg flex items-center gap-2 z-50">
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="font-medium">Syncing data...</span>
      </div>
    );
  }

  if (status.pendingOperations > 0) {
    return (
      <div className="fixed bottom-20 right-4 md:bottom-8 md:right-6 bg-orange-500 text-white px-3 py-2 rounded-md shadow-lg flex items-center gap-2 z-50 cursor-pointer hover:bg-orange-600 transition-colors" onClick={handleManualSync}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span className="font-medium">{status.pendingOperations} pending sync</span>
        <span className="text-xs opacity-75">Click to sync now</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleManualSync}
      className="fixed bottom-20 right-4 md:bottom-8 md:right-6 z-40 flex items-center justify-center w-9 h-9 rounded-full bg-green-500 text-white shadow-lg opacity-70 hover:opacity-100 focus:outline-none"
      title={`All synced • ${formatLastSync(status.lastSyncTime)}`}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    </button>
  );
};

export default OfflineIndicator;

