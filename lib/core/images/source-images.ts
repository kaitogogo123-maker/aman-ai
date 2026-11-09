export interface LocalSourceImage {
  id: string;
  file: File;
  previewUrl: string;
  uploadedUrl?: string;
}

export function orderedSourceImages(images: LocalSourceImage[], primaryImageId: string | null) {
  if (images.length === 0) {
    return [];
  }

  const primary = images.find((image) => image.id === primaryImageId) ?? images[0];
  return [primary, ...images.filter((image) => image.id !== primary.id)];
}

export function nextPrimaryImageIdAfterRemoval(
  images: LocalSourceImage[],
  removedImageId: string,
  currentPrimaryImageId: string | null
) {
  const remaining = images.filter((image) => image.id !== removedImageId);
  if (remaining.length === 0) {
    return null;
  }

  if (currentPrimaryImageId !== removedImageId) {
    return currentPrimaryImageId;
  }

  return remaining[0].id;
}

export function sourceImagesSignature(images: LocalSourceImage[], primaryImageId: string | null) {
  return orderedSourceImages(images, primaryImageId)
    .map((image) => `${image.file.name}:${image.file.size}:${image.file.lastModified}`)
    .join('|');
}
