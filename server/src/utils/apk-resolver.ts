import fs from 'fs';
import path from 'path';
import { ApkFileInfo } from 'shared';

const CANDIDATE_PATHS = [
  path.resolve(process.cwd(), 'apps/android/app/build/outputs/apk/debug/app-debug.apk'),
  path.resolve(__dirname, '../../../../apps/android/app/build/outputs/apk/debug/app-debug.apk'),
  path.resolve(__dirname, '../../../apps/android/app/build/outputs/apk/debug/app-debug.apk'),
  path.resolve(process.cwd(), '../apps/android/app/build/outputs/apk/debug/app-debug.apk'),
  path.resolve(process.cwd(), 'apps/android/app/build/outputs/apk/release/app-release-unsigned.apk'),
  path.resolve(process.cwd(), 'apps/android/app/build/outputs/apk/release/app-release.apk'),
  path.resolve(process.cwd(), 'PhoneFinder.apk'),
];

/**
 * Localiza o arquivo APK gerado nos caminhos esperados da compilação Android.
 */
export function getApkPath(): string | null {
  for (const candidate of CANDIDATE_PATHS) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Retorna as informações do APK para exibição e download via QR Code.
 */
export function getApkInfo(webPort: number = 3000, host: string = 'localhost'): ApkFileInfo {
  const apkPath = getApkPath();
  const downloadUrl = `http://${host}:${webPort}/api/apk/download`;

  if (!apkPath) {
    return {
      available: false,
      fileName: 'PhoneFinder.apk',
      fileSizeBytes: 0,
      fileSizeMb: '0 MB',
      downloadUrl,
    };
  }

  const stats = fs.statSync(apkPath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  return {
    available: true,
    fileName: 'PhoneFinder.apk',
    fileSizeBytes: stats.size,
    fileSizeMb: `${sizeMb} MB`,
    downloadUrl,
    lastModified: stats.mtime.toISOString(),
  };
}
