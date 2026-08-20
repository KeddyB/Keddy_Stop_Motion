import * as MediaLibrary from 'expo-media-library/legacy';
import * as FileSystem from 'expo-file-system/legacy';
import { FFmpegKit, ReturnCode } from '@apescoding/ffmpeg-kit-react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { storageService } from './storageService';
import { StopMotionProject, Frame } from '../types/project';
import { ExportConfig, DEFAULT_EXPORT_CONFIG, ExportResolution } from '../types/export';

export interface RenderProgressUpdate {
  projectIndex: number;
  totalProjects: number;
  projectTitle: string;
  percent: number;
  stageMessage?: string;
}

export const videoExportService = {
  // Helper to map resolution setting to ffmpeg scale filter
  getScaleFilter(resolution: ExportResolution): string {
    switch (resolution) {
      case '1080p': return 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2';
      case '720p': return 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2';
      case '480p': return 'scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2';
      default: return ''; // original
    }
  },

  // Helper to map quality to ffmpeg CRF (Constant Rate Factor) for x264
  getQualityCrf(quality: string): string {
    switch (quality) {
      case 'ultra': return '18';
      case 'high': return '23';
      case 'standard': return '28';
      default: return '23';
    }
  },

  async renderProjectsBatch(
    projects: StopMotionProject[],
    onProgress: (update: RenderProgressUpdate) => void,
    exportConfig: ExportConfig = DEFAULT_EXPORT_CONFIG
  ): Promise<{ successCount: number; errors: string[] }> {
    let successCount = 0;
    const errors: string[] = [];

    const { status } = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video', 'audio']);
    if (status !== 'granted') {
      throw new Error('Photo & video library permission is required to save animations.');
    }

    try {
      await activateKeepAwakeAsync('export');
    } catch {}

    const albumName = 'Keddy Stop Motion';

    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      const fps = project.fps || 12;
      
      try {
        onProgress({
          projectIndex: i + 1,
          totalProjects: projects.length,
          projectTitle: project.title,
          percent: 5,
          stageMessage: 'Preparing frame sequence...',
        });

        let frames: Frame[] = project.frames || [];

        // Fallback: reload frames from disk if missing
        if (frames.length === 0 && FileSystem.documentDirectory) {
          const framesDir = storageService.getProjectFramesDirectory(project.id);
          const dirInfo = await FileSystem.getInfoAsync(framesDir);
          if (dirInfo.exists) {
            const files = await FileSystem.readDirectoryAsync(framesDir);
            const imageFiles = files
              .filter((f) => f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.jpeg'))
              .sort();

            if (imageFiles.length > 0) {
              frames = imageFiles.map((filename, idx) => ({
                id: filename.replace(/\.[^/.]+$/, ''),
                uri: `${framesDir}${filename}`,
                timestamp: idx,
              }));
            }
          }
        }

        if (frames.length === 0) {
          errors.push(`${project.title}: No frames captured to render.`);
          continue;
        }

        const albumName = 'Keddy Stop Motion';
        let album = await MediaLibrary.getAlbumAsync(albumName);

        // --- IMAGE SEQUENCE EXPORT ---
        if (exportConfig.format === 'jpeg_sequence' || exportConfig.format === 'png_sequence') {
          for (let f = 0; f < frames.length; f++) {
            const frame = frames[f];
            let frameUriToSave = frame.uri;

            if (exportConfig.format === 'png_sequence' && FileSystem.documentDirectory) {
              const pngTarget = `${FileSystem.documentDirectory}cache_render_${project.id}_${f}.png`;
              try {
                await FileSystem.copyAsync({ from: frame.uri, to: pngTarget });
                frameUriToSave = pngTarget;
              } catch {
                frameUriToSave = frame.uri;
              }
            }

            const asset = await MediaLibrary.createAssetAsync(frameUriToSave);
            try {
              const album = await MediaLibrary.getAlbumAsync(albumName);
              if (!album) {
                await MediaLibrary.createAlbumAsync(albumName, asset, false);
              } else {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
              }
            } catch (albumErr) {
              console.log('Image album grouping notice:', albumErr);
            }

            onProgress({
              projectIndex: i + 1,
              totalProjects: projects.length,
              projectTitle: project.title,
              percent: Math.min(95, Math.round(10 + ((f + 1) / frames.length) * 85)),
              stageMessage: `Exporting frame ${f + 1} of ${frames.length}`,
            });
          }
        } 
        // --- VIDEO / GIF EXPORT (FFMPEG) ---
        else if (FileSystem.cacheDirectory) {
          const tempDir = `${FileSystem.cacheDirectory}render_${project.id}_${Date.now()}/`;
          await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

          onProgress({
            projectIndex: i + 1,
            totalProjects: projects.length,
            projectTitle: project.title,
            percent: 15,
            stageMessage: 'Staging files for encoder...',
          });

          // Filter and collect only existing physical frame files with multi-stage resolution
          const validFrameUris: string[] = [];
          const framesDir = storageService.getProjectFramesDirectory(project.id);

          for (let f = 0; f < frames.length; f++) {
            const frame = frames[f];
            let resolvedUri: string | null = null;

            // 1. Check primary URI
            if (frame.uri) {
              try {
                const info = await FileSystem.getInfoAsync(frame.uri);
                if (info.exists) resolvedUri = frame.uri;
              } catch {}
            }

            // 2. Check proxy URI fallback
            if (!resolvedUri && frame.proxyUri) {
              try {
                const pInfo = await FileSystem.getInfoAsync(frame.proxyUri);
                if (pInfo.exists) resolvedUri = frame.proxyUri;
              } catch {}
            }

            // 3. Check current project directory by filename
            if (!resolvedUri && FileSystem.documentDirectory) {
              const filename = frame.uri ? frame.uri.split('/').pop() : `${frame.id}.jpg`;
              if (filename) {
                const candidatePath = `${framesDir}${filename}`;
                try {
                  const cInfo = await FileSystem.getInfoAsync(candidatePath);
                  if (cInfo.exists) resolvedUri = candidatePath;
                } catch {}
              }
            }

            if (resolvedUri) {
              validFrameUris.push(resolvedUri);
            }
          }

          // Fallback: Scan project frames directory on device disk if list was empty
          if (validFrameUris.length === 0 && FileSystem.documentDirectory) {
            try {
              const dirInfo = await FileSystem.getInfoAsync(framesDir);
              if (dirInfo.exists) {
                const diskFiles = await FileSystem.readDirectoryAsync(framesDir);
                const fullResImages = diskFiles
                  .filter((fn) => (fn.endsWith('.jpg') || fn.endsWith('.png') || fn.endsWith('.jpeg')) && !fn.includes('_proxy'))
                  .sort();

                for (const img of fullResImages) {
                  validFrameUris.push(`${framesDir}${img}`);
                }
              }
            } catch (scanErr) {
              console.warn('Frames directory scan error:', scanErr);
            }
          }

          if (validFrameUris.length === 0) {
            errors.push(`${project.title}: No captured frame images found on storage. Please shoot new frames in the studio first.`);
            continue;
          }

          // Copy frames to temp directory sequentially (img_0001.jpg)
          for (let f = 0; f < validFrameUris.length; f++) {
            const num = String(f + 1).padStart(4, '0');
            await FileSystem.copyAsync({
              from: validFrameUris[f],
              to: `${tempDir}img_${num}.jpg`
            });
          }

          const cleanTempDir = tempDir.replace(/^file:\/\//, '');
          const cleanInputPattern = `${cleanTempDir}img_%04d.jpg`;

          const scaleFilter = this.getScaleFilter(exportConfig.resolution);
          const crf = this.getQualityCrf(exportConfig.quality);
          
          const rawBaseName = exportConfig.customFileName?.trim() || project.title || 'animation';
          const sanitizedBaseName = rawBaseName.replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').trim() || 'animation';

          let outputFile = '';
          let command = '';

          if (exportConfig.format === 'mp4_video') {
            outputFile = `${tempDir}${sanitizedBaseName}.mp4`;
            const cleanOutput = outputFile.replace(/^file:\/\//, '');
            let audioPart = '';
            if (project.audioTrack?.uri) {
               const cleanAudio = project.audioTrack.uri.replace(/^file:\/\//, '');
               audioPart = `-stream_loop -1 -i "${cleanAudio}" -shortest -c:a aac -b:a 128k `;
            }
            const vfPart = scaleFilter ? `-vf "${scaleFilter}" ` : '';
            command = `-y -framerate ${fps} -i "${cleanInputPattern}" ${audioPart}${vfPart}-c:v libopenh264 -pix_fmt yuv420p "${cleanOutput}"`;
          } else if (exportConfig.format === 'gif_animation') {
            outputFile = `${tempDir}${sanitizedBaseName}.gif`;
            const cleanOutput = outputFile.replace(/^file:\/\//, '');
            const gifFilter = scaleFilter
              ? `${scaleFilter},split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer`
              : 'split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer';
            command = `-y -framerate ${fps} -i "${cleanInputPattern}" -vf "${gifFilter}" "${cleanOutput}"`;
          }

          onProgress({
            projectIndex: i + 1,
            totalProjects: projects.length,
            projectTitle: project.title,
            percent: 25,
            stageMessage: `Encoding ${exportConfig.format === 'mp4_video' ? 'MP4' : 'GIF'} (${fps} FPS)...`,
          });

          let session = await FFmpegKit.execute(command);
          let returnCode = await session.getReturnCode();

          // If libopenh264 is unavailable, fall back to universal mpeg4
          if (!ReturnCode.isSuccess(returnCode) && exportConfig.format === 'mp4_video') {
             const cleanOutput = outputFile.replace(/^file:\/\//, '');
             let audioPart = '';
             if (project.audioTrack?.uri) {
                const cleanAudio = project.audioTrack.uri.replace(/^file:\/\//, '');
                audioPart = `-stream_loop -1 -i "${cleanAudio}" -shortest -c:a aac -b:a 128k `;
             }
             const vfPart = scaleFilter ? `-vf "${scaleFilter}" ` : '';
             const fallbackCmd = `-y -framerate ${fps} -i "${cleanInputPattern}" ${audioPart}${vfPart}-c:v mpeg4 -qscale:v 2 -pix_fmt yuv420p "${cleanOutput}"`;
             session = await FFmpegKit.execute(fallbackCmd);
             returnCode = await session.getReturnCode();
          }

          if (!ReturnCode.isSuccess(returnCode)) {
             const failLogs = await session.getAllLogsAsString();
             console.warn('FFmpegKit logs:', failLogs);
             throw new Error(`Encoding failed with return code ${returnCode?.getValue() || 'unknown'}`);
          }

          const assetUri = outputFile.startsWith('file://') ? outputFile : `file://${outputFile}`;
          let savedSuccessfully = false;
          let asset: MediaLibrary.Asset | null = null;

          try {
            asset = await MediaLibrary.createAssetAsync(assetUri);
            savedSuccessfully = true;
          } catch (createErr) {
            console.warn('createAssetAsync notice, trying saveToLibraryAsync:', createErr);
            try {
              await MediaLibrary.saveToLibraryAsync(assetUri);
              savedSuccessfully = true;
            } catch (saveErr) {
              console.warn('saveToLibraryAsync fallback error:', saveErr);
            }
          }

          if (asset) {
            try {
              const targetAlbumName = exportConfig.format === 'mp4_video' ? 'Keddy Stop Motion Videos' : albumName;
              const album = await MediaLibrary.getAlbumAsync(targetAlbumName);
              if (!album) {
                await MediaLibrary.createAlbumAsync(targetAlbumName, asset, false);
              } else {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
              }
            } catch (albumSyncErr) {
              console.log('Video/GIF album grouping notice:', albumSyncErr);
            }
          }

          if (!savedSuccessfully && !asset) {
            throw new Error(`Failed to save exported file to photo gallery.`);
          }

          // Cleanup temp directory
          await FileSystem.deleteAsync(tempDir, { idempotent: true });
        }

        onProgress({
          projectIndex: i + 1,
          totalProjects: projects.length,
          projectTitle: project.title,
          percent: 100,
          stageMessage: 'Completed!',
        });

        successCount++;
      } catch (err: any) {
        console.warn(`Render error for ${project.title}:`, err);
        errors.push(`${project.title}: ${err.message || 'Render failed'}`);
      }
    }

    try {
      deactivateKeepAwake('export');
    } catch {}

    return { successCount, errors };
  },
};
