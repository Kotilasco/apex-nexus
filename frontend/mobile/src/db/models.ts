import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly, json } from '@nozbe/watermelondb/decorators';

export class DocumentModel extends Model {
  static table = 'documents';

  @text('server_id') serverId!: string;
  @text('title') title!: string;
  @text('description') description!: string;
  @text('mime_type') mimeType!: string;
  @field('file_size') fileSize!: number;
  @text('status') status!: string;
  @text('folder_id') folderId!: string;
  @text('folder_path') folderPath!: string;
  @field('version') version!: number;
  @field('checked_out') checkedOut!: boolean;
  @field('legal_hold') legalHold!: boolean;
  @text('tags') tags!: string;
  @text('author_name') authorName!: string;
  @field('is_pinned') isPinned!: boolean;
  @text('local_file_path') localFilePath!: string;
  @field('synced_at') syncedAt!: number;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}

export class FolderModel extends Model {
  static table = 'folders';

  @text('server_id') serverId!: string;
  @text('name') name!: string;
  @text('parent_id') parentId!: string;
  @text('path') path!: string;
  @readonly @date('created_at') createdAt!: Date;
}

export class NoteModel extends Model {
  static table = 'notes';

  @text('server_id') serverId!: string;
  @text('document_id') documentId!: string;
  @text('content') content!: string;
  @text('color') color!: string;
  @field('pinned') pinned!: boolean;
  @text('author_name') authorName!: string;
  @readonly @date('created_at') createdAt!: Date;
}

export class NotificationModel extends Model {
  static table = 'notifications';

  @text('server_id') serverId!: string;
  @text('type') type!: string;
  @text('title') title!: string;
  @text('message') message!: string;
  @field('is_read') isRead!: boolean;
  @readonly @date('created_at') createdAt!: Date;
}

export class PendingActionModel extends Model {
  static table = 'pending_actions';

  @text('action_type') actionType!: string;
  @text('resource_type') resourceType!: string;
  @text('resource_id') resourceId!: string;
  @text('payload') payload!: string;
  @text('status') status!: string;
  @field('retry_count') retryCount!: number;
  @readonly @date('created_at') createdAt!: Date;
}
