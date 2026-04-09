'use client';

import { useEffect, useState } from 'react';
import { presenceApi } from '@/lib/api';

interface Viewer {
  userId: string;
  username: string;
  displayName: string;
}

export default function PresenceIndicator({ documentId }: { documentId: string }) {
  const [viewers, setViewers] = useState<Viewer[]>([]);

  useEffect(() => {
    if (!documentId) return;

    const fetchViewers = async () => {
      try {
        const res = await presenceApi.getViewers(documentId);
        setViewers(res.data.data?.viewers || []);
      } catch {
        // Silently fail — presence is non-critical
      }
    };

    fetchViewers();
    const interval = setInterval(fetchViewers, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [documentId]);

  if (viewers.length === 0) return null;

  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];

  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-2">
        {viewers.slice(0, 5).map((v, i) => (
          <div
            key={v.userId}
            className={`w-7 h-7 rounded-full ${colors[i % colors.length]} text-white text-xs flex items-center justify-center ring-2 ring-white`}
            title={v.displayName || v.username}
          >
            {(v.displayName || v.username).charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
      <span className="text-xs text-gray-500 ml-1">
        {viewers.length} viewing
      </span>
    </div>
  );
}
