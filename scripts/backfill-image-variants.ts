import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

import { buildVariantStoragePath } from "../src/lib/utils/image";
import {
  GALLERY_BUCKET_NAME,
  GALLERY_DISPLAY_MAX_EDGE,
  GALLERY_DISPLAY_QUALITY,
  GALLERY_THUMBNAIL_MAX_EDGE,
  GALLERY_THUMBNAIL_QUALITY,
} from "../src/types/gallery";

type ScriptOptions = {
  dryRun: boolean;
  force: boolean;
  limit: number;
};

type ImageBackfillRow = {
  id: string;
  user_id: string;
  storage_path: string;
  thumbnail_path: string | null;
  display_path: string | null;
  file_name: string;
};

type ProcessResult =
  | { status: "updated"; id: string }
  | { status: "dry-run"; id: string }
  | { status: "skipped"; id: string; reason: string }
  | { status: "failed"; id: string; reason: string };

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

  console.log(
    `[backfill-image-variants] start dryRun=${options.dryRun} force=${options.force} limit=${options.limit} bucket=${bucketName}`,
  );

  const rows = await fetchTargetRows(supabase, options.limit, options.force);

  console.log(`[backfill-image-variants] fetched ${rows.length} row(s)`);

  if (rows.length === 0) {
    return;
  }

  let updatedCount = 0;
  let dryRunCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const row of rows) {
    const result = await processRow(supabase, bucketName, row, options);

    if (result.status === "updated") {
      updatedCount += 1;
    }

    if (result.status === "dry-run") {
      dryRunCount += 1;
    }

    if (result.status === "skipped") {
      skippedCount += 1;
      console.log(`[skip] ${row.id} ${result.reason}`);
    }

    if (result.status === "failed") {
      failedCount += 1;
      console.error(`[fail] ${row.id} ${result.reason}`);
    }
  }

  console.log(
    `[backfill-image-variants] done updated=${updatedCount} dryRun=${dryRunCount} skipped=${skippedCount} failed=${failedCount}`,
  );

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

async function fetchTargetRows(
  supabase: SupabaseClient,
  limit: number,
  force: boolean,
) {
  let query = supabase
    .from("images")
    .select("id,user_id,storage_path,thumbnail_path,display_path,file_name")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!force) {
    query = query.or("thumbnail_path.is.null,display_path.is.null");
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to fetch target images.");
  }

  return (data ?? []) as ImageBackfillRow[];
}

async function processRow(
  supabase: SupabaseClient,
  bucketName: string,
  row: ImageBackfillRow,
  options: ScriptOptions,
): Promise<ProcessResult> {
  if (!row.storage_path) {
    return { status: "skipped", id: row.id, reason: "storage_path is empty" };
  }

  const thumbnailPath = buildVariantStoragePath("thumbnails", row.user_id, row.id, "webp");
  const displayPath = buildVariantStoragePath("display", row.user_id, row.id, "webp");
  const needsThumbnail = options.force || !row.thumbnail_path;
  const needsDisplay = options.force || !row.display_path;

  if (!needsThumbnail && !needsDisplay) {
    return { status: "skipped", id: row.id, reason: "derivatives already exist" };
  }

  if (options.dryRun) {
    console.log(
      `[dry-run] ${row.id} storage=${row.storage_path} thumbnail=${thumbnailPath} display=${displayPath}`,
    );
    return { status: "dry-run", id: row.id };
  }

  try {
    const { data: downloadData, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(row.storage_path);

    if (downloadError || !downloadData) {
      throw new Error(downloadError?.message || "Failed to download source image.");
    }

    const sourceBuffer = Buffer.from(await downloadData.arrayBuffer());
    const sourceImage = sharp(sourceBuffer, { failOn: "none" }).rotate();
    const [{ data: thumbnailBuffer, info: thumbnailInfo }, { data: displayBuffer, info: displayInfo }] =
      await Promise.all([
        sourceImage
          .clone()
          .resize({
            width: GALLERY_THUMBNAIL_MAX_EDGE,
            height: GALLERY_THUMBNAIL_MAX_EDGE,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: Math.round(GALLERY_THUMBNAIL_QUALITY * 100) })
          .toBuffer({ resolveWithObject: true }),
        sourceImage
          .clone()
          .resize({
            width: GALLERY_DISPLAY_MAX_EDGE,
            height: GALLERY_DISPLAY_MAX_EDGE,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: Math.round(GALLERY_DISPLAY_QUALITY * 100) })
          .toBuffer({ resolveWithObject: true }),
      ]);

    if (needsThumbnail) {
      const { error: thumbnailUploadError } = await supabase.storage.from(bucketName).upload(
        thumbnailPath,
        thumbnailBuffer,
        {
          contentType: "image/webp",
          upsert: options.force,
        },
      );

      if (thumbnailUploadError) {
        throw new Error(`Failed to upload thumbnail: ${thumbnailUploadError.message}`);
      }
    }

    if (needsDisplay) {
      const { error: displayUploadError } = await supabase.storage.from(bucketName).upload(
        displayPath,
        displayBuffer,
        {
          contentType: "image/webp",
          upsert: options.force,
        },
      );

      if (displayUploadError) {
        throw new Error(`Failed to upload display image: ${displayUploadError.message}`);
      }
    }

    const updatePayload: Record<string, string | number> = {};

    if (needsThumbnail) {
      updatePayload.thumbnail_path = thumbnailPath;
    }

    if (needsDisplay) {
      updatePayload.display_path = displayPath;
      updatePayload.mime_type = "image/webp";
      updatePayload.size_bytes = displayBuffer.byteLength;
      updatePayload.width = displayInfo.width;
      updatePayload.height = displayInfo.height;
    }

    const { error: updateError } = await supabase.from("images").update(updatePayload).eq("id", row.id);

    if (updateError) {
      throw new Error(updateError.message || "Failed to update image row.");
    }

    console.log(
      `[updated] ${row.id} thumbnail=${needsThumbnail ? thumbnailPath : row.thumbnail_path} display=${needsDisplay ? displayPath : row.display_path}`,
    );

    return { status: "updated", id: row.id };
  } catch (error) {
    return {
      status: "failed",
      id: row.id,
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function parseOptions(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    dryRun: false,
    force: false,
    limit: 10,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (argument === "--force") {
      options.force = true;
      continue;
    }

    if (argument === "--limit") {
      const nextValue = argv[index + 1];
      options.limit = parseLimit(nextValue);
      index += 1;
      continue;
    }

    if (argument.startsWith("--limit=")) {
      options.limit = parseLimit(argument.split("=")[1]);
      continue;
    }

    throw new Error(`Unknown option: ${argument}`);
  }

  return options;
}

function parseLimit(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("--limit must be a positive integer.");
  }

  return parsed;
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
