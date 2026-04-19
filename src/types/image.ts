export type ImageRow = {
  id: string;
  user_id: string;
  folder_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  width: number;
  height: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
};

export type GalleryImageItem = ImageRow & {
  signed_url: string | null;
  folder_name: string | null;
};

export type ViewerState = {
  isOpen: boolean;
  currentIndex: number;
  images: GalleryImageItem[];
};
