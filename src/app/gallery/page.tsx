import { GalleryShell } from "@/components/gallery/gallery-shell";
import { requireUser } from "@/lib/auth/guard";
import {
  listFolders,
  listImages,
  parseGalleryPage,
  parseGalleryScope,
  parseGallerySort,
  parseGalleryView,
} from "@/lib/gallery/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type GalleryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const user = await requireUser();
  const supabase = await createServerSupabaseClient();
  const scope = parseGalleryScope(resolvedSearchParams);
  const sort = parseGallerySort(resolvedSearchParams);
  const view = parseGalleryView(resolvedSearchParams);
  const page = parseGalleryPage(resolvedSearchParams);
  const folders = await listFolders(supabase, user.id);
  const { images, pagination } = await listImages(supabase, user.id, scope, sort, folders, page);

  return (
    <GalleryShell
      userId={user.id}
      userEmail={user.email ?? ""}
      folders={folders}
      images={images}
      pagination={pagination}
      initialFilters={{ scope, sort, view, page: pagination.page }}
    />
  );
}
