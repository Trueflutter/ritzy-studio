export function slugFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function readImageSize(
  file: File
): Promise<{ width: number | null; height: number | null }> {
  if (!file.type.startsWith("image/")) {
    return { width: null, height: null };
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({ width: null, height: null });
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
