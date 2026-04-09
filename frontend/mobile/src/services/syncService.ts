import database from '../db';
import { DocumentModel, FolderModel, NoteModel, NotificationModel, PendingActionModel } from '../db/models';
import { documentApi, notificationApi } from '../lib/api';
import * as FileSystem from 'expo-file-system';
import { Q } from '@nozbe/watermelondb';

const DOCS_DIR = `${FileSystem.documentDirectory}apex_docs/`;

/** Sync documents from server → local WatermelonDB */
export async function syncDocuments(folderId?: string): Promise<void> {
  try {
    const res = await documentApi.list(folderId, 0, 100);
    const data = res.data?.data ?? res.data;
    const serverDocs = data?.content ?? (Array.isArray(data) ? data : []);

    await database.write(async () => {
      const docsCollection = database.get<DocumentModel>('documents');

      for (const doc of serverDocs) {
        const existing = await docsCollection.query(Q.where('server_id', doc.id)).fetch();

        if (existing.length > 0) {
          await existing[0].update((d) => {
            d.title = doc.title;
            d.description = doc.description || '';
            d.status = doc.status;
            d.version = doc.version;
            d.checkedOut = doc.checkedOut;
            d.legalHold = doc.legalHold;
            d.tags = JSON.stringify(doc.tags || []);
            d.syncedAt = Date.now();
          });
        } else {
          await docsCollection.create((d) => {
            d.serverId = doc.id;
            d.title = doc.title;
            d.description = doc.description || '';
            d.mimeType = doc.mimeType;
            d.fileSize = doc.fileSize;
            d.status = doc.status;
            d.folderId = doc.folderId || '';
            d.folderPath = doc.folderPath || '';
            d.version = doc.version;
            d.checkedOut = doc.checkedOut;
            d.legalHold = doc.legalHold;
            d.tags = JSON.stringify(doc.tags || []);
            d.authorName = doc.authorName;
            d.isPinned = false;
            d.syncedAt = Date.now();
          });
        }
      }
    });
  } catch (e) {
    console.log('Document sync failed (offline?):', e);
  }
}

/** Sync folders from server */
export async function syncFolders(parentId?: string): Promise<void> {
  try {
    const res = await documentApi.getFolders(parentId);
    const data = res.data?.data ?? res.data;
    const serverFolders = Array.isArray(data) ? data : data?.content ?? [];

    await database.write(async () => {
      const foldersCollection = database.get<FolderModel>('folders');

      for (const folder of serverFolders) {
        const existing = await foldersCollection.query(Q.where('server_id', folder.id)).fetch();

        if (existing.length === 0) {
          await foldersCollection.create((f) => {
            f.serverId = folder.id;
            f.name = folder.name;
            f.parentId = folder.parentId || '';
            f.path = folder.path;
          });
        }
      }
    });
  } catch (e) {
    console.log('Folder sync failed (offline?):', e);
  }
}

/** Pin document for offline access — downloads the file */
export async function pinDocument(serverId: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(DOCS_DIR, { intermediates: true });

  const res = await documentApi.download(serverId);
  const filePath = `${DOCS_DIR}${serverId}`;
  await FileSystem.writeAsStringAsync(filePath, res.data, { encoding: FileSystem.EncodingType.Base64 });

  await database.write(async () => {
    const docs = await database.get<DocumentModel>('documents')
      .query(Q.where('server_id', serverId)).fetch();
    if (docs.length > 0) {
      await docs[0].update((d) => {
        d.isPinned = true;
        d.localFilePath = filePath;
      });
    }
  });
}

/** Unpin — remove local file */
export async function unpinDocument(serverId: string): Promise<void> {
  await database.write(async () => {
    const docs = await database.get<DocumentModel>('documents')
      .query(Q.where('server_id', serverId)).fetch();
    if (docs.length > 0) {
      const localPath = docs[0].localFilePath;
      if (localPath) {
        try { await FileSystem.deleteAsync(localPath); } catch { /* ok */ }
      }
      await docs[0].update((d) => {
        d.isPinned = false;
        d.localFilePath = '';
      });
    }
  });
}

/** Sync notifications */
export async function syncNotifications(): Promise<void> {
  try {
    const res = await notificationApi.getMy(0, 50);
    const data = res.data?.data ?? res.data;
    const serverNotifs = data?.content ?? (Array.isArray(data) ? data : []);

    await database.write(async () => {
      const notifsCollection = database.get<NotificationModel>('notifications');

      for (const n of serverNotifs) {
        const existing = await notifsCollection.query(Q.where('server_id', n.id)).fetch();
        if (existing.length === 0) {
          await notifsCollection.create((rec) => {
            rec.serverId = n.id;
            rec.type = n.type;
            rec.title = n.title;
            rec.message = n.message || '';
            rec.isRead = n.read ?? n.isRead ?? false;
          });
        } else {
          await existing[0].update((rec) => {
            rec.isRead = n.read ?? n.isRead ?? false;
          });
        }
      }
    });
  } catch (e) {
    console.log('Notification sync failed (offline?):', e);
  }
}

/** Process pending offline actions queue */
export async function processPendingActions(): Promise<void> {
  const pending = await database.get<PendingActionModel>('pending_actions')
    .query(Q.where('status', 'pending')).fetch();

  for (const action of pending) {
    try {
      const payload = JSON.parse(action.payload);

      switch (action.actionType) {
        case 'ADD_NOTE':
          await documentApi.addNote(action.resourceId, payload);
          break;
        case 'MARK_NOTIFICATION_READ':
          await notificationApi.markRead(action.resourceId);
          break;
        default:
          console.log('Unknown pending action:', action.actionType);
      }

      await database.write(async () => {
        await action.update((a) => { a.status = 'synced'; });
      });
    } catch (e) {
      await database.write(async () => {
        await action.update((a) => {
          a.status = action.retryCount >= 3 ? 'failed' : 'pending';
          a.retryCount = action.retryCount + 1;
        });
      });
    }
  }
}

/** Queue an action for offline execution */
export async function queueAction(
  actionType: string,
  resourceType: string,
  resourceId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await database.write(async () => {
    await database.get<PendingActionModel>('pending_actions').create((a) => {
      a.actionType = actionType;
      a.resourceType = resourceType;
      a.resourceId = resourceId;
      a.payload = JSON.stringify(payload);
      a.status = 'pending';
      a.retryCount = 0;
    });
  });
}

/** Full sync — call on app foreground / pull to refresh */
export async function fullSync(): Promise<void> {
  await Promise.all([
    syncDocuments(),
    syncFolders(),
    syncNotifications(),
  ]);
  await processPendingActions();
}
