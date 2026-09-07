import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import TrashIcon from "../components/TrashIcon";
import {
  deleteFile,
  downloadFile,
  downloadFolder,
  getFiles,
  uploadLargeFile,
  getFileRecipients,
  type FileItem,
} from "../api/files";

import { getErrorMessage } from "../utils/errors";

import { useAuth } from "../context/AuthContext";

interface SelectedUpload {
  file: File;
  folderId?: string;
  folderName?: string;
}

function formatFileSize(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index = Math.floor(
    Math.log(bytes) / Math.log(1024),
  );

  return `${(
    bytes / Math.pow(1024, index)
  ).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export default function Files() {
  const { user } = useAuth();

  const [recipients, setRecipients] =
    useState<
      {
        id: number;
        name: string;
        role: string;
      }[]
    >([]);

  const [selectedRecipientId, setSelectedRecipientId] =
    useState<number | null>(null);

  const [selectedFiles, setSelectedFiles] =
    useState<SelectedUpload[]>([]);

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const folderInputRef =
    useRef<HTMLInputElement | null>(null);

  const cancelRequestedRef =
    useRef(false);

  const [files, setFiles] =
    useState<FileItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [uploadingName, setUploadingName] =
    useState("");

  const [progress, setProgress] =
    useState(0);

  const [error, setError] =
    useState("");

  const [activeFileTab, setActiveFileTab] =
    useState<"sent-to-me" | "sent-by-me">("sent-to-me");

  async function loadFiles() {
    setLoading(true);
    setError("");

    try {
      const data = await getFiles();

      setFiles(data);
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          "Unable to load files.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const [
          fileData,
          recipientData,
        ] = await Promise.all([
          getFiles(),
          getFileRecipients(),
        ]);

        setFiles(fileData);
        setRecipients(recipientData);
      } catch (err: unknown) {
        setError(
          getErrorMessage(
            err,
            "Unable to load files.",
          ),
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  async function handleFileSelected(
    event: ChangeEvent<HTMLInputElement>,
    isFolder = false,
  ) {
    const newFiles = Array.from(
      event.target.files ?? [],
    );

    event.target.value = "";

    if (newFiles.length === 0 || uploading) {
      return;
    }

    const emptyFile = newFiles.find(
      (file) => file.size === 0,
    );

    if (emptyFile) {
      setError(
        `Cannot upload an empty file: ${
          emptyFile.webkitRelativePath || emptyFile.name
        }`,
      );
      return;
    }

    setSelectedFiles((current) => {
      const existing = new Set(
        current.map(
          ({ file }) => file.webkitRelativePath || file.name,
        ),
      );
      const folderId = isFolder ? crypto.randomUUID() : undefined;
      const folderName = isFolder
        ? newFiles[0].webkitRelativePath.split("/")[0]
        : undefined;

      return [
        ...current,
        ...newFiles.filter(
          (file) => !existing.has(
            file.webkitRelativePath || file.name,
          ),
        ).map((file) => ({ file, folderId, folderName })),
      ];
    });
    setError("");
  }

  function handleCancelUpload() {
    cancelRequestedRef.current = true;
  }

  async function handleDownload(
    file: FileItem,
  ) {
    setError("");

    try {
      await downloadFile(
        file.id,
        file.original_filename,
      );
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          "Unable to download file.",
        ),
      );
    }
  }

  async function handleDeleteFile(file: FileItem) {
    if (!window.confirm(`Delete "${file.original_filename}" permanently?`)) {
      return;
    }

    setError("");

    try {
      await deleteFile(file.id);
      setFiles((current) => current.filter((item) => item.id !== file.id));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to delete file."));
    }
  }

  async function handleDeleteFolder(folder: {
    folderName: string;
    files: FileItem[];
  }) {
    if (!window.confirm(`Delete folder "${folder.folderName}" permanently?`)) {
      return;
    }

    setError("");

    try {
      await Promise.all(folder.files.map((file) => deleteFile(file.id)));
      const deletedIds = new Set(folder.files.map((file) => file.id));
      setFiles((current) => current.filter((file) => !deletedIds.has(file.id)));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to delete folder."));
    }
  }

  async function handleUpload() {
    if (
      selectedFiles.length === 0 ||
      !selectedRecipientId ||
      uploading
    ) {
      return;
    }

    cancelRequestedRef.current =
      false;

    setUploading(true);
    setUploadingName("");
    setProgress(0);
    setError("");

    try {
      const totalSize = selectedFiles.reduce(
        (total, upload) => total + upload.file.size,
        0,
      );
      let completedSize = 0;

      for (const upload of selectedFiles) {
        const { file } = upload;
        const filename =
          file.webkitRelativePath || file.name;

        setUploadingName(filename);

        await uploadLargeFile(
          file,
          selectedRecipientId,
          (fileProgress) => {
            setProgress(
              Math.round(
                ((completedSize +
                  file.size * fileProgress / 100) /
                  totalSize) *
                  100,
              ),
            );
          },
          () => cancelRequestedRef.current,
          filename,
          upload.folderId,
          upload.folderName,
        );

        completedSize += file.size;
      }

      setSelectedFiles([]);

      await loadFiles();
    } catch (err: unknown) {
      if (
        cancelRequestedRef.current
      ) {
        setError("Upload cancelled.");
      } else {
        setError(
          getErrorMessage(
            err,
            "Upload failed.",
          ),
        );
      }
    } finally {
      setUploading(false);
      setUploadingName("");
      setProgress(0);
      cancelRequestedRef.current =
        false;
    }
  }

  const filesSentToMe = files.filter(
    (file) => file.recipient_id === user?.id,
  );

  const filesSentByMe = files.filter(
    (file) => file.uploaded_by === user?.id,
  );

  const visibleFiles =
    activeFileTab === "sent-to-me"
      ? filesSentToMe
      : filesSentByMe;

  const visibleItems = Object.values(
    visibleFiles.reduce<Record<string, {
      kind: "file" | "folder";
      file?: FileItem;
      folderId?: string;
      folderName?: string;
      files?: FileItem[];
    }>>((groups, file) => {
      if (!file.folder_id) {
        groups[`file-${file.id}`] = { kind: "file", file };
        return groups;
      }

      const key = `folder-${file.folder_id}`;
      const group = groups[key] ?? {
        kind: "folder" as const,
        folderId: file.folder_id,
        folderName: file.folder_name || "Folder",
        files: [],
      };
      group.files?.push(file);
      groups[key] = group;
      return groups;
    }, {}));

  const fileTabs = [
    { value: "sent-to-me" as const, label: "Receive" },
    { value: "sent-by-me" as const, label: "Sent" },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            DoozyBrands
          </p>

          <h2>Files</h2>

          <p>
            Upload, share and download
            office files.
          </p>
        </div>

        <div className="file-upload-options">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={handleFileSelected}
            disabled={uploading}
          />

          <input
            ref={folderInputRef}
            type="file"
            hidden
            multiple
            {...({ webkitdirectory: "" } as Record<string, string>)}
            onChange={(event) => handleFileSelected(event, true)}
            disabled={uploading}
          />

          {selectedFiles.length > 0 && (
            <div className="file-selected-info">
              <span
                className="cell-truncate"
                title={selectedFiles
                  .map(({ file }) => file.webkitRelativePath || file.name)
                  .join(", ")}
              >
                Selected {selectedFiles.length} file
                {selectedFiles.length === 1 ? "" : "s"}:{" "}
                <strong>
                  {selectedFiles[0].file.webkitRelativePath || selectedFiles[0].file.name}
                  {selectedFiles.length > 1 && ` (+${selectedFiles.length - 1} more)`}
                </strong>
              </span>

              <select
                value={selectedRecipientId ?? ""}
                onChange={(event) =>
                  setSelectedRecipientId(
                    event.target.value
                      ? Number(event.target.value)
                      : null,
                  )
                }
                disabled={uploading}
              >
                <option value="">
                  Choose recipient...
                </option>

                {recipients.map((recipient) => (
                  <option
                    key={recipient.id}
                    value={recipient.id}
                  >
                    {recipient.name} (
                    {recipient.role})
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="secondary-button"
                disabled={uploading}
                onClick={() =>
                  fileInputRef.current?.click()
                }
              >
                Add Files
              </button>

              <button
                type="button"
                className="secondary-button"
                disabled={uploading}
                onClick={() =>
                  folderInputRef.current?.click()
                }
              >
                Add Folder
              </button>

              <button
                type="button"
                className="primary-button"
                disabled={
                  uploading ||
                  !selectedRecipientId
                }
                onClick={handleUpload}
              >
                {uploading
                  ? `Uploading ${progress}%`
                  : "Upload File"}
              </button>
            </div>
          )}

        {selectedFiles.length === 0 && (
          <div className="button-container">
            <button
              type="button"
              className="primary-button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              Choose Files
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={uploading}
              onClick={() => folderInputRef.current?.click()}
            >
              Choose Folder
            </button>
          </div>
        )}
        </div>
      </header>

      {uploading && (
        <div className="upload-progress-card">
          <div className="upload-progress-header">
            <span
              className="cell-truncate"
              title={uploadingName}
            >
              Uploading {uploadingName}…
            </span>

            <strong>
              {progress}%
            </strong>
          </div>

          <div className="upload-progress">
            <div
              className="upload-progress-bar"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>

          <button
            type="button"
            className="secondary-button upload-cancel-button"
            onClick={handleCancelUpload}
          >
            Cancel Upload
          </button>
        </div>
      )}

      {error && (
        <div className="page-error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="files-card">
          <div className="page-loading">
            Loading files...
          </div>
        </div>
      ) : (
        <section className="dashboard-section">

          <div className="section-heading">
            <div>
              <h3>
                {user?.role === "admin"
                  ? "File Transfers"
                  : "My Files"}
              </h3>

              <p>
                {user?.role === "admin"
                  ? "View files sent to you, sent by you, or transferred between employees."
                  : "View files you have sent and files shared with you."}
              </p>
            </div>
          </div>

          <div className="file-tabs">
            {fileTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={
                  activeFileTab === tab.value
                    ? "file-tab active"
                    : "file-tab"
                }
                onClick={() => setActiveFileTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ============================
              FILE TABLE
          ============================ */}

          {visibleItems.length === 0 ? (
            <div className="empty-card">
              <h3>
                No files here
              </h3>

              <p>
                There are no files in this
                category yet.
              </p>
            </div>
          ) : (
            <div className="table-card">
              <table>
                <thead>
                  <tr>
                    <th>
                      File Name
                    </th>

                    <th>
                      From
                    </th>

                    <th>
                      To
                    </th>

                    <th>
                      Date & Time
                    </th>

                    <th>
                      Size
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visibleItems.map(
                    (item) => {
                      const file = item.file ?? item.files?.[0];

                      if (!file) {
                        return null;
                      }

                      const isFolder = item.kind === "folder";
                      const displayName = isFolder
                        ? item.folderName || "Folder"
                        : file.original_filename;
                      const itemSize = isFolder
                        ? item.files?.reduce((total, entry) => total + entry.file_size, 0) || 0
                        : file.file_size;

                      return (
                      <tr
                        key={isFolder ? item.folderId : file.id}
                      >
                        <td
                          className="cell-truncate"
                          title={
                            displayName
                          }
                        >
                          <strong>
                            {isFolder ? "Folder: " : ""}{displayName}
                          </strong>
                        </td>

                        <td>
                          {
                            file.uploader_name
                          }
                        </td>

                        <td>
                          {
                            file.recipient_name
                          }
                        </td>

                        <td>
                          {formatDateTime(
                            file.created_at,
                          )}
                        </td>

                        <td>
                          {formatFileSize(
                            itemSize,
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              file.is_complete
                                ? "status-badge status-completed"
                                : "status-badge"
                            }
                          >
                            {file.is_complete
                              ? "Complete"
                              : "Incomplete"}
                          </span>
                        </td>

                        <td>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={
                                isFolder
                                  ? !item.files?.every((entry) => entry.is_complete)
                                  : !file.is_complete
                              }
                              onClick={() => isFolder
                                ? downloadFolder(item.folderId!, displayName).catch((err: unknown) =>
                                  setError(getErrorMessage(err, "Unable to download folder.")))
                                : handleDownload(file)}
                            >
                              {isFolder ? "Download Folder" : "Download"}
                            </button>

                            <button
                              type="button"
                              className="secondary-button"
                              style={{ minWidth: 42, padding: "8px 10px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                              onClick={() => isFolder
                                ? handleDeleteFolder({ folderName: displayName, files: item.files || [] })
                                : handleDeleteFile(file)}
                              aria-label="Delete file"
                              title="Delete file"
                            >
                              <TrashIcon size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}

        </section>
      )}
    </div>
  );
}