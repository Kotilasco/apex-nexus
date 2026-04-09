import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import { DocumentModel, FolderModel, NoteModel, NotificationModel, PendingActionModel } from './models';

const adapter = new SQLiteAdapter({
  schema,
  jsi: true,
  onSetUpError: (error) => {
    console.error('WatermelonDB setup error:', error);
  },
});

const database = new Database({
  adapter,
  modelClasses: [DocumentModel, FolderModel, NoteModel, NotificationModel, PendingActionModel],
});

export default database;
