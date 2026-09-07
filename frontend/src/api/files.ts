import api from "./client";

export interface FileItem {
  id: number;
  original_filename: string;
  stored_filename: string;
  file_size: number;
  checksum: string;
  folder_id: string | null;
  folder_name: string | null;

  uploaded_by: number;
  uploader_name: string;

  recipient_id: number;
  recipient_name: string;
  recipient_role: string;

  is_complete: boolean;
  created_at: string;
}

export interface FileUploadStartResponse {
  upload_id: string;
  filename: string;
  total_size: number;
  uploaded_size: number;
  is_complete: boolean;
}

export interface FileChunkResponse {
  upload_id: string;
  uploaded_size: number;
  total_size: number;
  is_complete: boolean;
}

export interface FileUploadCompleteResponse {
  upload_id: string;
  filename: string;
  file_size: number;
  checksum: string;
  is_complete: boolean;
}

export async function getFiles(): Promise<FileItem[]> {
  const response = await api.get<FileItem[]>("/files");

  return response.data;
}

export async function startFileUpload(
  filename: string,
  totalSize: number,
  recipientId: number,
  folderId?: string,
  folderName?: string,
): Promise<FileUploadStartResponse> {
  const response =
    await api.post<FileUploadStartResponse>(
      "/files/upload/start",
      {
        filename,
        total_size: totalSize,
        recipient_id: recipientId,
        folder_id: folderId,
        folder_name: folderName,
      },
    );

  return response.data;
}

export async function uploadFileChunk(
  uploadId: string,
  chunk: Blob,
  offset: number,
): Promise<FileChunkResponse> {
  const formData = new FormData();

  formData.append(
    "chunk",
    chunk,
    "chunk",
  );

  const response =
    await api.patch<FileChunkResponse>(
      `/files/upload/${uploadId}/chunk`,
      formData,
      {
        params: {
          offset,
        },
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );

  return response.data;
}

export async function completeFileUpload(
  uploadId: string,
): Promise<FileUploadCompleteResponse> {
  const response =
    await api.post<FileUploadCompleteResponse>(
      `/files/upload/${uploadId}/complete`,
    );

  return response.data;
}

export async function deleteFile(
  fileId: number,
): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>(`/files/${fileId}`);
  return response.data;
}

export async function uploadLargeFile(
  file: File,
  recipientId: number,
  onProgress?: (percentage: number) => void,
  shouldCancel?: () => boolean,
  filename = file.webkitRelativePath || file.name,
  folderId?: string,
  folderName?: string,
): Promise<FileUploadCompleteResponse> {
  const CHUNK_SIZE = 1024 * 1024;

  const start = await startFileUpload(
    filename,
    file.size,
    recipientId,
    folderId,
    folderName,
  );

  let offset = start.uploaded_size;

  while (offset < file.size) {
    if (shouldCancel?.()) {
      throw new Error("Upload cancelled by user.");
    }

    const chunk = file.slice(
      offset,
      Math.min(
        offset + CHUNK_SIZE,
        file.size,
      ),
    );

    const result = await uploadFileChunk(
      start.upload_id,
      chunk,
      offset,
    );

    offset = result.uploaded_size;

    if (onProgress) {
      onProgress(
        Math.round(
          (offset / file.size) * 100,
        ),
      );
    }
  }

  if (shouldCancel?.()) {
    throw new Error("Upload cancelled by user.");
  }

  return completeFileUpload(
    start.upload_id,
  );
}

export async function downloadFile(
  fileId: number,
  filename: string,
): Promise<void> {
  const response = await api.get(
    `/files/${fileId}/download`,
    {
      responseType: "blob",
    },
  );

  const url =
    window.URL.createObjectURL(
      response.data,
    );

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();

  link.remove();

  window.URL.revokeObjectURL(url);
}

export async function downloadFolder(
  folderId: string,
  folderName: string,
): Promise<void> {
  const response = await api.get(
    `/files/folders/${folderId}/download`,
    { responseType: "blob" },
  );

  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${folderName}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export interface FileRecipient {
  id: number;
  name: string;
  role: string;
}

export async function getFileRecipients(): Promise<FileRecipient[]> {
  const response =
    await api.get<FileRecipient[]>(
      "/file-recipients",
    );

  return response.data;
}