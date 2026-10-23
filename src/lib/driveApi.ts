/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  content?: string;
  error?: string;
}

export interface BonusScraperFolderResult {
  folderFound: boolean;
  folderId?: string;
  folderName?: string;
  files: DriveFileItem[];
  allFoldersFound: { id: string; name: string }[];
  error?: string;
}

export async function scanDriveForBonusScraper(
  accessToken: string
): Promise<BonusScraperFolderResult> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  try {
    // 1. Search for any folder matching "bonus-scraper" or "bonus_scraper"
    const folderQuery = encodeURIComponent(
      "(name contains 'bonus-scraper' or name contains 'bonus_scraper' or name contains 'bonus scraper') and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    );
    const folderRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${folderQuery}&fields=files(id, name, mimeType, modifiedTime)`,
      { headers }
    );

    if (!folderRes.ok) {
      const err = await folderRes.json();
      throw new Error(err.error?.message || 'Failed to search folders in Google Drive');
    }

    const folderData = await folderRes.json();
    const folders = folderData.files || [];

    // Fallback search: if no folder matches exact phrase, search for any file or folder containing "bonus-scraper"
    if (folders.length === 0) {
      const generalQuery = encodeURIComponent(
        "name contains 'bonus-scraper' or name contains 'bonus_scraper' and trashed = false"
      );
      const generalRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${generalQuery}&fields=files(id, name, mimeType, size, modifiedTime)`,
        { headers }
      );
      if (generalRes.ok) {
        const genData = await generalRes.json();
        const genFiles: DriveFileItem[] = [];

        for (const f of (genData.files || []).slice(0, 15)) {
          let content = '';
          try {
            content = await fetchFileText(f.id, f.mimeType, accessToken);
          } catch (e: any) {
            content = `(Unable to preview content: ${e.message})`;
          }
          genFiles.push({ ...f, content });
        }

        return {
          folderFound: genFiles.length > 0,
          folderName: 'Discovered Files matching "bonus-scraper"',
          files: genFiles,
          allFoldersFound: [],
        };
      }

      return {
        folderFound: false,
        files: [],
        allFoldersFound: [],
      };
    }

    // Pick target folder (e.g. first folder found)
    const targetFolder = folders[0];
    const fileQuery = encodeURIComponent(`'${targetFolder.id}' in parents and trashed = false`);
    const filesRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${fileQuery}&fields=files(id, name, mimeType, size, modifiedTime)`,
      { headers }
    );

    if (!filesRes.ok) {
      throw new Error('Failed to list files inside bonus-scraper folder');
    }

    const filesData = await filesRes.json();
    const rawFiles: DriveFileItem[] = filesData.files || [];

    // 2. Fetch contents for each file in the folder (up to 20 files)
    const processedFiles: DriveFileItem[] = [];
    for (const f of rawFiles.slice(0, 20)) {
      let content = '';
      try {
        content = await fetchFileText(f.id, f.mimeType, accessToken);
      } catch (e: any) {
        content = `(Error reading file: ${e.message})`;
      }
      processedFiles.push({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        modifiedTime: f.modifiedTime,
        content,
      });
    }

    return {
      folderFound: true,
      folderId: targetFolder.id,
      folderName: targetFolder.name,
      files: processedFiles,
      allFoldersFound: folders.map((f: any) => ({ id: f.id, name: f.name })),
    };
  } catch (error: any) {
    console.error('Drive scan error:', error);
    return {
      folderFound: false,
      files: [],
      allFoldersFound: [],
      error: error.message || 'Error communicating with Google Drive API',
    };
  }
}

export async function fetchFileText(
  fileId: string,
  mimeType: string,
  accessToken: string
): Promise<string> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  if (mimeType === 'application/vnd.google-apps.document') {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
      { headers }
    );
    if (!res.ok) throw new Error('Failed to export Google Doc text');
    return res.text();
  }

  // Normal text, python, js, json, markdown, etc.
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  return res.text();
}
