type SupabaseUploadResult = {
  fileUrl: string;
  storagePath: string;
};

const supabaseUrl = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const supabaseBucket = (process.env.SUPABASE_STORAGE_BUCKET || "").trim();

const isConfigured = (): boolean =>
  Boolean(supabaseUrl && supabaseServiceRoleKey && supabaseBucket);

const buildObjectPublicUrl = (storagePath: string): string => {
  const safePath = storagePath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(supabaseBucket)}/${safePath}`;
};

export const isSupabaseStorageConfigured = (): boolean => isConfigured();

export const uploadBufferToSupabaseStorage = async (
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<SupabaseUploadResult | null> => {
  if (!isConfigured()) {
    return null;
  }

  const yearMonth = new Date().toISOString().slice(0, 7).replace("-", "/");
  const storagePath = `notes/${yearMonth}/${fileName}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(supabaseBucket)}/${storagePath}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      apikey: supabaseServiceRoleKey,
      "Content-Type": mimeType || "application/octet-stream",
      "x-upsert": "true",
    },
    body: new Uint8Array(fileBuffer),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Supabase Storage upload failed (${response.status}): ${errorBody}`);
  }

  return {
    fileUrl: buildObjectPublicUrl(storagePath),
    storagePath,
  };
};
