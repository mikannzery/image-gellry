export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
export const SUPPORTED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

export type ImageMetadata = {
  width: number;
  height: number;
};

export function isSupportedImageType(mimeType: string): mimeType is SupportedImageMimeType {
  return SUPPORTED_IMAGE_MIME_TYPES.includes(mimeType as SupportedImageMimeType);
}

export function sanitizeFileName(fileName: string): string {
  const sanitized = fileName
    .normalize("NFKC")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || "image";
}

export function buildStoragePath(userId: string, fileName: string, date = new Date()): string {
  const year = `${date.getFullYear()}`;
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const randomId = crypto.randomUUID();
  const safeName = sanitizeFileName(fileName);

  return `${userId}/${year}/${month}/${randomId}-${safeName}`;
}

export async function getImageMetadata(file: File): Promise<ImageMetadata> {
  const url = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();

      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("画像メタ情報を取得できませんでした。"));
      element.src = url;
    });

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

