export {
  ObjectStorageService,
  ObjectNotFoundError,
  objectStorageClient,
} from "./objectStorage";

export type {
  ObjectAclPolicy,
  ObjectAccessGroup,
  ObjectAccessGroupType,
  ObjectAclRule,
} from "./objectAcl";

export {
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

// Dev-only local filesystem fallback for the upload flow (no GCS in local dev).
export {
  isObjectStorageConfigured,
  isLocalFallbackEnabled,
  isValidObjectId,
  createLocalUpload,
  localObjectExists,
  writeLocalObject,
  streamLocalObject,
} from "./localObjectStorage";


