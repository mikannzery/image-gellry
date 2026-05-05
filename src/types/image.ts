export type ImageRow = {
  id: string;
  user_id: string;
  folder_id: string | null;
  file_name: string;
  storage_path: string;
  thumbnail_path: string | null;
  display_path: string | null;
  original_path: string | null;
  mime_type: string;
  size_bytes: number;
  width: number;
  height: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
};

export type GalleryImageItem = ImageRow & {
  thumbnail_url: string | null;
  display_url: string | null;
  folder_name: string | null;
  requires_derivatives: boolean;
};

export type ViewerState = {
  isOpen: boolean;
  currentIndex: number;
  images: GalleryImageItem[];
};
