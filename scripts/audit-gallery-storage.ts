import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getStoragePathOwnerId } from "../src/lib/gallery/storage-path-policy";
import { GALLERY_BUCKET_NAME } from "../src/types/gallery";

type AuditOptions = {
  skipStorage: boolean;
};

type ImageAuditRow = {
  id: string;
  user_id: string;
  folder_id: string | null;
  storage_path: string;
  thumbnail_path: string | null;
  display_path: string | null;
  original_path: string | null;
};

type FolderAuditRow = {
  id: string;
  user_id: string;
};

void main();

async function main() {
  loadLocalEnvIfAvailable();

  const options = parseOptions(process.argv.slice(2));
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const bucketName =
    process.env.SUPABASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ||
    GALLERY_BUCKET_NAME;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const [images, folders] = await Promise.all([fetchImages(supabase), fetchFolders(supabase)]);
  const folderUserById = new Map(folders.map((folder) => [folder.id, folder.user_id]));
  const dbPaths = createDbPathSet(images);
  const crossUserFolderRows = images.filter((image) => {
    if (!image.folder_id) {
      return false;
    }

    return folderUserById.get(image.folder_id) !== image.user_id;
  });
  const pathOwnerMismatches = images.flatMap((image) =>
    getImagePaths(image)
      .filter((path) => getStoragePathOwnerId(path) !== image.user_id)
      .map((path) => ({ id: image.id, path })),
  );
  const duplicatePaths = findDuplicatePaths(images);
  const missingDerivativeRows = images.filter((image) => !image.thumbnail_path || !image.display_path);

  console.log(`[audit-gallery-storage] images=${images.length} folders=${folders.length} bucket=${bucketName}`);
  console.log(`[audit-gallery-storage] crossUserFolderRows=${crossUserFolderRows.length}`);
  console.log(`[audit-gallery-storage] pathOwnerMismatches=${pathOwnerMismatches.length}`);
  console.log(`[audit-gallery-storage] duplicatePaths=${duplicatePaths.length}`);
  console.log(`[audit-gallery-storage] missingDerivativeRows=${missingDerivativeRows.length}`);

  if (!options.skipStorage) {
    const storagePaths = await listStoragePaths(supabase, bucketName);
    const orphanStoragePaths = storagePaths.filter((path) => !dbPaths.has(path));
    const missingStoragePaths = Array.from(dbPaths).filter((path) => !storagePaths.includes(path));

    console.log(`[audit-gallery-storage] storageObjects=${storagePaths.length}`);
    console.log(`[audit-gallery-storage] orphanStoragePaths=${orphanStoragePaths.length}`);
    console.log(`[audit-gallery-storage] missingStoragePaths=${missingStoragePaths.length}`);
    logSample("orphan", orphanStoragePaths);
    logSample("missing", missingStoragePaths);
  }

  logSample(
    "cross-user-folder",
    crossUserFolderRows.map((row) => `${row.id} folder=${row.folder_id}`),
  );
  logSample(
    "path-owner-mismatch",
    pathOwnerMismatches.map((row) => `${row.id} path=${row.path}`),
  );
  logSample("duplicate-path", duplicatePaths);

  if (crossUserFolderRows.length > 0 || pathOwnerMismatches.length > 0 || duplicatePaths.length > 0) {
    process.exitCode = 1;
  }
}

async function fetchImages(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("images")
    .select("id,user_id,folder_id,storage_path,thumbnail_path,display_path,original_path");

  if (error) {
    throw new Error(error.message || "Failed to fetch images.");
  }

  return (data ?? []) as ImageAuditRow[];
}

async function fetchFolders(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("folders").select("id,user_id");

  if (error) {
    throw new Error(error.message || "Failed to fetch folders.");
  }

  return (data ?? []) as FolderAuditRow[];
}

function createDbPathSet(images: ImageAuditRow[]) {
  return new Set(images.flatMap(getImagePaths));
}

function getImagePaths(image: ImageAuditRow) {
  return [image.storage_path, image.thumbnail_path, image.display_path, image.original_path].filter(
    (path): path is string => Boolean(path),
  );
}

function findDuplicatePaths(images: ImageAuditRow[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const path of images.flatMap(getImagePaths)) {
    if (seen.has(path)) {
      duplicates.add(path);
      continue;
    }

    seen.add(path);
  }

  return Array.from(duplicates);
}

async function listStoragePaths(supabase: SupabaseClient, bucketName: string) {
  const paths: string[] = [];
  const stack = [""];

  while (stack.length > 0) {
    const prefix = stack.pop() ?? "";
    const { data, error } = await supabase.storage.from(bucketName).list(prefix, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error(error.message || `Failed to list storage prefix: ${prefix}`);
    }

    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;

      if (item.id === null) {
        stack.push(path);
        continue;
      }

      paths.push(path);
    }
  }

  return paths;
}

function logSample(label: string, values: string[]) {
  if (values.length === 0) {
    return;
  }

  console.log(`[audit-gallery-storage] ${label} sample:`);
  values.slice(0, 10).forEach((value) => console.log(`  - ${value}`));
}

function parseOptions(argv: string[]): AuditOptions {
  const options: AuditOptions = {
    skipStorage: false,
  };

  for (const argument of argv) {
    if (argument === "--skip-storage") {
      options.skipStorage = true;
      continue;
    }

    throw new Error(`Unknown option: ${argument}`);
  }

  return options;
}

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function loadLocalEnvIfAvailable() {
  const loadEnvFile = (process as NodeJS.Process & {
    loadEnvFile?: (path?: string) => void;
  }).loadEnvFile;

  if (!loadEnvFile) {
    return;
  }

  for (const fileName of [".env.local", ".env"]) {
    const resolvedPath = resolve(process.cwd(), fileName);

    if (!existsSync(resolvedPath)) {
      continue;
    }

    loadEnvFile(resolvedPath);
  }
}
