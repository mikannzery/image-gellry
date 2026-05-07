export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
export const SUPPORTED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

export type ImageMetadata = {
  width: number;
  height: number;
};

export type GeneratedImageAsset = ImageMetadata & {
  blob: Blob;
  fileName: string;
  mimeType: "image/webp";
  sizeBytes: number;
};

type GenerateImageAssetOptions = {
  fileName: string;
  maxLongEdge: number;
  quality: number;
};

export function isSupportedImageType(mimeType: string): mimeType is SupportedImageMimeType {
  return SUPPORTED_IMAGE_MIME_TYPES.includes(mimeType as SupportedImageMimeType);
}

export function canGenerateCompressedImageAsset() {
  return (
    typeof createImageBitmap === "function" &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.toBlob === "function"
  );
}

export function assertImageCompressionSupported() {
  if (!canGenerateCompressedImageAsset()) {
    throw new Error("このブラウザでは画像の圧縮変換に対応していません。別のブラウザでお試しください。");
  }
}

export function sanitizeFileName(fileName: string): string {
  const sanitized = fileName
    .normalize("NFKC")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || "image";
}

export function buildVariantStoragePath(
  kind: "thumbnails" | "display" | "originals",
  userId: string,
  imageId: string,
  extension: string,
): string {
  return `${kind}/${userId}/${imageId}.${extension}`;
}

export async function getImageMetadata(file: Blob): Promise<ImageMetadata> {
  const bitmap = await createImageBitmap(file);

  try {
    return {
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}

export async function generateCompressedImageAsset(
  source: File,
  options: GenerateImageAssetOptions,
): Promise<GeneratedImageAsset> {
  const bitmap = await createImageBitmap(source);

  try {
    const dimensions = fitWithinMaxLongEdge(bitmap.width, bitmap.height, options.maxLongEdge);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("画像変換に必要な Canvas コンテキストを取得できませんでした。");
    }

    context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);

    const blob = await canvasToBlob(canvas, "image/webp", options.quality);

    return {
      blob,
      fileName: replaceFileExtension(options.fileName, "webp"),
      mimeType: "image/webp",
      sizeBytes: blob.size,
      width: dimensions.width,
      height: dimensions.height,
    };
  } finally {
    bitmap.close();
  }
}

export function getFileExtension(fileName: string, fallback = "bin"): string {
  const normalized = fileName.trim();
  const extension = normalized.includes(".") ? normalized.split(".").pop() : "";

  if (!extension) {
    return fallback;
  }

  return extension.toLowerCase();
}

function fitWithinMaxLongEdge(width: number, height: number, maxLongEdge: number): ImageMetadata {
  const longEdge = Math.max(width, height);

  if (longEdge <= maxLongEdge) {
    return { width, height };
  }

  const scale = maxLongEdge / longEdge;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function replaceFileExtension(fileName: string, nextExtension: string): string {
  const safeName = sanitizeFileName(fileName);
  const baseName = safeName.replace(/\.[^.]+$/, "");

  return `${baseName || "image"}.${nextExtension}`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: "image/webp",
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("画像変換結果の Blob を生成できませんでした。"));
          return;
        }

        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}
