import React, { createContext, useContext } from 'react';
import { Database } from '@nozbe/watermelondb';
import database from './index';

const DatabaseContext = createContext<Database>(database);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  return (
    <DatabaseContext.Provider value={database}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): Database {
  return useContext(DatabaseContext);
}
