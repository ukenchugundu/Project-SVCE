export type PortalRole = "student" | "faculty" | "admin";

export interface StoredAuthSession {
  userId: number;
  email: string;
  fullName: string;
  role: PortalRole;
  rollNumber?: string;
  studentId?: string;
}

const AUTH_STORAGE_KEY = "eduhub_auth";
const STUDENT_ID_STORAGE_KEY = "eduhub_student_id";
const PROFILE_IMAGE_STORAGE_PREFIX = "eduhub_profile_image";

const FALLBACK_IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".jfif",
  ".webp",
  ".gif",
  ".bmp",
  ".svg",
  ".svgz",
  ".avif",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
  ".ico",
  ".cur",
];

export const PROFILE_IMAGE_ACCEPT = [
  "image/*",
  ".png",
  ".jpg",
  ".jpeg",
  ".jfif",
  ".webp",
  ".gif",
  ".bmp",
  ".svg",
  ".svgz",
  ".avif",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
  ".ico",
  ".cur",
].join(",");

const isPortalRole = (value: unknown): value is PortalRole =>
  value === "student" || value === "faculty" || value === "admin";

export const readStoredAuth = (): StoredAuthSession | null => {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!isPortalRole(parsed.role)) {
      return null;
    }

    const userId = Number(parsed.userId);
    const email = String(parsed.email ?? "").trim();
    const fullName = String(parsed.fullName ?? "").trim();
    const rollNumber = String(parsed.rollNumber ?? "").trim();
    const studentId = String(parsed.studentId ?? "").trim();
    if (!Number.isFinite(userId) || userId <= 0 || !email) {
      return null;
    }

    return {
      userId,
      email,
      fullName,
      role: parsed.role,
      rollNumber: rollNumber || undefined,
      studentId: studentId || undefined,
    };
  } catch {
    return null;
  }
};

export const getStudentIdentity = (): string => {
  const auth = readStoredAuth();
  if (auth?.role === "student" && auth.studentId) {
    return auth.studentId;
  }

  const storedId = localStorage.getItem(STUDENT_ID_STORAGE_KEY)?.trim();
  if (storedId) {
    return storedId;
  }

  return auth?.email ?? "-";
};

const buildProfileImageStorageKey = (session: StoredAuthSession): string =>
  `${PROFILE_IMAGE_STORAGE_PREFIX}:${session.role}:${session.userId}`;

export const readStoredProfileImage = (
  session: StoredAuthSession | null
): string => {
  if (!session) {
    return "";
  }
  return localStorage.getItem(buildProfileImageStorageKey(session)) ?? "";
};

export const writeStoredProfileImage = (
  session: StoredAuthSession | null,
  imageDataUrl: string
): boolean => {
  if (!session) {
    return false;
  }
  try {
    localStorage.setItem(buildProfileImageStorageKey(session), imageDataUrl);
    return true;
  } catch {
    return false;
  }
};

export const removeStoredProfileImage = (session: StoredAuthSession | null): void => {
  if (!session) {
    return;
  }
  localStorage.removeItem(buildProfileImageStorageKey(session));
};

const hasAcceptedImageExtension = (fileName: string): boolean => {
  const lowerFileName = fileName.trim().toLowerCase();
  if (!lowerFileName) {
    return false;
  }
  return FALLBACK_IMAGE_EXTENSIONS.some((extension) =>
    lowerFileName.endsWith(extension)
  );
};

export const isAcceptedProfileImageFile = (file: File): boolean => {
  const mimeType = file.type.trim().toLowerCase();
  if (mimeType.startsWith("image/")) {
    return true;
  }
  return hasAcceptedImageExtension(file.name);
};

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to read image file."));
    };
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });

const loadImageElement = (source: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Browser cannot decode this image format."));
    image.src = source;
  });

export const buildProfileImageDataUrl = async (file: File): Promise<string> => {
  const fallbackDataUrl = await readFileAsDataUrl(file);
  const mimeType = file.type.trim().toLowerCase();

  if (mimeType.includes("svg")) {
    return fallbackDataUrl;
  }

  let objectUrl = "";
  try {
    objectUrl = URL.createObjectURL(file);
    const image = await loadImageElement(objectUrl);
    const maxSize = 512;
    const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      return fallbackDataUrl;
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return fallbackDataUrl;
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
};

const formatNumericId = (value: number, prefix: "FAC" | "ADM"): string =>
  `${prefix}-${String(Math.max(0, Math.floor(value))).padStart(4, "0")}`;

export const getProfileIdentifierLabel = (session: StoredAuthSession | null): string => {
  if (session?.role === "student") {
    return "Roll No";
  }
  if (session?.role === "faculty") {
    return "Faculty ID";
  }
  return "Admin ID";
};

export const getProfileIdentifierValue = (session: StoredAuthSession | null): string => {
  if (!session) {
    return "-";
  }

  if (session.role === "student") {
    return session.rollNumber || session.studentId || getStudentIdentity();
  }
  if (session.role === "faculty") {
    return session.rollNumber || formatNumericId(session.userId, "FAC");
  }
  return formatNumericId(session.userId, "ADM");
};
