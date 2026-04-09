import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'documents',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'mime_type', type: 'string' },
        { name: 'file_size', type: 'number' },
        { name: 'status', type: 'string' },
        { name: 'folder_id', type: 'string', isOptional: true },
        { name: 'folder_path', type: 'string', isOptional: true },
        { name: 'version', type: 'number' },
        { name: 'checked_out', type: 'boolean' },
        { name: 'legal_hold', type: 'boolean' },
        { name: 'tags', type: 'string' }, // JSON array
        { name: 'author_name', type: 'string' },
        { name: 'is_pinned', type: 'boolean' }, // offline pin
        { name: 'local_file_path', type: 'string', isOptional: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'folders',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'parent_id', type: 'string', isOptional: true },
        { name: 'path', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'notes',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'document_id', type: 'string', isIndexed: true },
        { name: 'content', type: 'string' },
        { name: 'color', type: 'string' },
        { name: 'pinned', type: 'boolean' },
        { name: 'author_name', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'notifications',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'type', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'message', type: 'string', isOptional: true },
        { name: 'is_read', type: 'boolean' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'pending_actions',
      columns: [
        { name: 'action_type', type: 'string' },
        { name: 'resource_type', type: 'string' },
        { name: 'resource_id', type: 'string' },
        { name: 'payload', type: 'string' }, // JSON
        { name: 'status', type: 'string' }, // pending, syncing, synced, failed
        { name: 'retry_count', type: 'number' },
        { name: 'created_at', type: 'number' },
      ],
    }),
  ],
});
