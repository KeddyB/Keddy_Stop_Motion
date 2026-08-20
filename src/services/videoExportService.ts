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
  // Ensures pixel dimensions are always strictly even numbers (divisible by 2) for H.264 compatibility
  // and respects Portrait vs Landscape orientation so videos fill the full screen without black pillarbox bars
  getScaleFilter(resolution: ExportResolution, orientation: string = 'landscape'): string {
    const isLandscape = orientation === 'landscape';
    switch (resolution) {
      case '1080p':
        return isLandscape
          ? 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1'
          : 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1';
      case '720p':
        return isLandscape
          ? 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1'
          : 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1';
      case '480p':
        return isLandscape
          ? 'scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2,setsar=1'
          : 'scale=480:854:force_original_aspect_ratio=decrease,pad=480:854:(ow-iw)/2:(oh-ih)/2,setsar=1';
      case 'original':
      default:
        // Pure unpadded full-screen original photo dimensions (truncated to even numbers for H.264 compatibility)
        return 'scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1';
    }
  },

  // Helper to map quality to ffmpeg CRF / bitrate
  getQualityBitrate(quality: string): { bitrate: string; maxrate: string; bufsize: string } {
    switch (quality) {
      case 'ultra':
        return { bitrate: '35M', maxrate: '50M', bufsize: '70M' };
      case 'high':
        return { bitrate: '22M', maxrate: '35M', bufsize: '50M' };
      case 'standard':
      default:
        return { bitrate: '14M', maxrate: '22M', bufsize: '30M' };
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
      let project = projects[i];
      let tempDir = '';

      try {
        onProgress({
          projectIndex: i + 1,
          totalProjects: projects.length,
          projectTitle: project.title || 'Untitled Project',
          percent: 5,
          stageMessage: 'Preparing full-resolution frames...',
        });

        let frames: Frame[] = project.frames || [];

        // 1. If project in memory is missing frames, attempt to load full manifest from project.json
        if ((!frames || frames.length === 0) && FileSystem.documentDirectory) {
          const projectDir = storageService.getProjectDirectory(project.id);
          const manifestPath = `${projectDir}project.json`;
          try {
            const manifestInfo = await FileSystem.getInfoAsync(manifestPath);
            if (manifestInfo.exists) {
              const rawJson = await FileSystem.readAsStringAsync(manifestPath);
              const loadedProject: StopMotionProject = JSON.parse(rawJson);
              if (loadedProject.frames && loadedProject.frames.length > 0) {
                frames = loadedProject.frames;
                project = loadedProject;
              }
            }
          } catch (mErr) {
            console.warn('Manifest reload notice:', mErr);
          }
        }

        // 2. Secondary fallback: scan project frames folder on disk
        if ((!frames || frames.length === 0) && FileSystem.documentDirectory) {
          const framesDir = storageService.getProjectFramesDirectory(project.id);
          const dirInfo = await FileSystem.getInfoAsync(framesDir);
          if (dirInfo.exists) {
            const files = await FileSystem.readDirectoryAsync(framesDir);
            const imageFiles = files
              .filter((f) => (f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.jpeg')) && !f.includes('_proxy'))
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
          errors.push(`${project.title || 'Project'}: No frames captured to render.`);
          continue;
        }

        const fps = project.fps || 12;

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
          tempDir = `${FileSystem.cacheDirectory}render_${project.id}_${Date.now()}/`;
          await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

          onProgress({
            projectIndex: i + 1,
            totalProjects: projects.length,
            projectTitle: project.title,
            percent: 15,
            stageMessage: 'Staging full-resolution original frames...',
          });

          // Strictly resolve original full-resolution files first (never proxies)
          const validFrameUris: string[] = [];
          const framesDir = storageService.getProjectFramesDirectory(project.id);

          for (let f = 0; f < frames.length; f++) {
            const frame = frames[f];
            let resolvedUri: string | null = null;

            // 1. Check primary original capture URI
            if (frame.uri) {
              try {
                const info = await FileSystem.getInfoAsync(frame.uri);
                if (info.exists) resolvedUri = frame.uri;
              } catch {}
            }

            // 2. Check current project directory by original filename
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

            // 3. Fallback to proxy URI ONLY if original was physically deleted
            if (!resolvedUri && frame.proxyUri) {
              try {
                const pInfo = await FileSystem.getInfoAsync(frame.proxyUri);
                if (pInfo.exists) resolvedUri = frame.proxyUri;
              } catch {}
            }

            if (resolvedUri) {
              validFrameUris.push(resolvedUri);
            }
          }

          if (validFrameUris.length === 0) {
            errors.push(`${project.title}: No captured frame images found on storage.`);
            continue;
          }

          // Copy full-resolution frames sequentially to temp directory (img_0001.jpg, img_0002.jpg, ...)
          for (let f = 0; f < validFrameUris.length; f++) {
            const num = String(f + 1).padStart(4, '0');
            await FileSystem.copyAsync({
              from: validFrameUris[f],
              to: `${tempDir}img_${num}.jpg`,
            });
          }

          const cleanTempDir = tempDir.replace(/^file:\/\//, '');
          const cleanInputPattern = `${cleanTempDir}img_%04d.jpg`;

          const scaleFilter = this.getScaleFilter(exportConfig.resolution, project.orientation);
          const bitrateConfig = this.getQualityBitrate(exportConfig.quality);
          
          // Generate unique sanitized filename per project
          let rawBaseName = project.title || 'animation';
          if (projects.length === 1 && exportConfig.customFileName?.trim()) {
            rawBaseName = exportConfig.customFileName.trim();
          } else if (projects.length > 1 && exportConfig.customFileName?.trim()) {
            rawBaseName = `${exportConfig.customFileName.trim()}_${i + 1}`;
          }
          const sanitizedBaseName = rawBaseName.replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').trim() || `animation_${project.id.slice(-4)}`;

          let outputFile = '';
          let command = '';

          if (exportConfig.format === 'mp4_video') {
            outputFile = `${tempDir}${sanitizedBaseName}.mp4`;
            const cleanOutput = outputFile.replace(/^file:\/\//, '');
            let audioPart = '';
            if (project.audioTrack?.uri) {
               const cleanAudio = project.audioTrack.uri.replace(/^file:\/\//, '');
               audioPart = `-stream_loop -1 -i "${cleanAudio}" -shortest -c:a aac -b:a 192k `;
            }
            const vfPart = `-vf "${scaleFilter}" `;
            
            // High-Bitrate, Zero-Drop, High-Profile Frame Encoding:
            // -c:v libopenh264 -profile:v high -level 4.1: Broadcast-grade H.264 high profile compression
            // -allow_skip_frames 0: Prevents OpenH264 from dropping complex stop-motion frames
            // -g ${Math.max(1, fps)}: Guarantees frequent keyframes (I-frames) so every frame including the final frame is held and displayed accurately
            // -colorspace bt709 -color_primaries bt709 -color_trc bt709 -brand mp42: Standard color matrix & MP4 container compatibility
            // -vsync 0 -avoid_negative_ts make_zero -movflags +faststart: Preserves 100% of frames with fast web/mobile streaming
            command = `-y -framerate ${fps} -i "${cleanInputPattern}" ${audioPart}${vfPart}-c:v libopenh264 -profile:v high -level 4.1 -allow_skip_frames 0 -g ${Math.max(1, fps)} -b:v ${bitrateConfig.bitrate} -maxrate ${bitrateConfig.maxrate} -bufsize ${bitrateConfig.bufsize} -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -brand mp42 -vsync 0 -avoid_negative_ts make_zero -movflags +faststart "${cleanOutput}"`;
          } else if (exportConfig.format === 'gif_animation') {
            outputFile = `${tempDir}${sanitizedBaseName}.gif`;
            const cleanOutput = outputFile.replace(/^file:\/\//, '');
            // High-fidelity Floyd-Steinberg smooth palette generation (eliminates coarse Bayer matrix dots)
            const filterComplex = `[0:v]${scaleFilter},split[s0][s1];[s0]palettegen=stats_mode=diff:max_colors=256[p];[s1][p]paletteuse=dither=floyd_steinberg:diff_mode=rectangle[v]`;
            command = `-y -framerate ${fps} -i "${cleanInputPattern}" -filter_complex "${filterComplex}" -map "[v]" "${cleanOutput}"`;
          }

          onProgress({
            projectIndex: i + 1,
            totalProjects: projects.length,
            projectTitle: project.title,
            percent: 30,
            stageMessage: `Encoding ${exportConfig.format === 'mp4_video' ? 'MP4' : 'GIF'} (${fps} FPS, ${validFrameUris.length} frames)...`,
          });

          let session = await FFmpegKit.execute(command);
          let returnCode = await session.getReturnCode();

          // Fallback encoder for MP4 if libopenh264 is unavailable
          if (!ReturnCode.isSuccess(returnCode) && exportConfig.format === 'mp4_video') {
             const cleanOutput = outputFile.replace(/^file:\/\//, '');
             let audioPart = '';
             if (project.audioTrack?.uri) {
                const cleanAudio = project.audioTrack.uri.replace(/^file:\/\//, '');
                audioPart = `-stream_loop -1 -i "${cleanAudio}" -shortest -c:a aac -b:a 192k `;
             }
             const vfPart = `-vf "${scaleFilter}" `;
             const fallbackCmd = `-y -framerate ${fps} -i "${cleanInputPattern}" ${audioPart}${vfPart}-c:v mpeg4 -qscale:v 1 -g ${Math.max(1, fps)} -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -brand mp42 -vsync 0 -avoid_negative_ts make_zero -movflags +faststart "${cleanOutput}"`;
             session = await FFmpegKit.execute(fallbackCmd);
             returnCode = await session.getReturnCode();
          }

          if (!ReturnCode.isSuccess(returnCode)) {
             const failLogs = await session.getAllLogsAsString();
             console.warn('FFmpegKit logs for project', project.title, failLogs);
             throw new Error(`Encoding failed with return code ${returnCode?.getValue() || 'unknown'}`);
          }

          onProgress({
            projectIndex: i + 1,
            totalProjects: projects.length,
            projectTitle: project.title,
            percent: 85,
            stageMessage: 'Saving animation to photo library...',
          });

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
            throw new Error(`Failed to save exported animation to photo gallery.`);
          }
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
        errors.push(`${project.title || 'Project'}: ${err.message || 'Render failed'}`);
      } finally {
        if (tempDir) {
          try {
            await FileSystem.deleteAsync(tempDir, { idempotent: true });
          } catch {}
        }
      }
    }

    try {
      deactivateKeepAwake('export');
    } catch {}

    return { successCount, errors };
  },
};
