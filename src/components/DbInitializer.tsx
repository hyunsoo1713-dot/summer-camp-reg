'use client';

import { useEffect, useState } from 'react';
import { db } from '../services/db';

export default function DbInitializer({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.resolve(db.init()).then(() => {
      setLoaded(true);
    });
  }, []);

  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-600 text-xs font-semibold">데이터를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

