import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { photoTimestampHelper } from '../utils/photoTimestampHelper';

export interface SharedMediaItem {
  uri: string;
  timestamp: number;
  fileName?: string;
}

const { ShareIntentModule } = NativeModules;
const shareIntentEmitter =
  ShareIntentModule && Platform.OS === 'android'
    ? new NativeEventEmitter(ShareIntentModule)
    : null;

export const shareIntentService = {
  /**
   * Sort array of shared media items chronologically by creation timestamp
   */
  sortByCreationTimestamp(items: SharedMediaItem[]): SharedMediaItem[] {
    return [...items].sort((a, b) => a.timestamp - b.timestamp);
  },

  /**
   * Get initially shared images on cold start from Native Android module or deep link
   */
  async getInitialSharedMedia(): Promise<SharedMediaItem[]> {
    const results: SharedMediaItem[] = [];

    // 1. Check Native Android ShareIntentModule
    if (ShareIntentModule?.getInitialSharedMedia) {
      try {
        const nativeItems: Array<{ uri: string; timestamp?: number; fileName?: string }> =
          await ShareIntentModule.getInitialSharedMedia();
        if (Array.isArray(nativeItems) && nativeItems.length > 0) {
          for (const item of nativeItems) {
            if (item.uri) {
              const snapTime =
                item.timestamp && item.timestamp > 0
                  ? item.timestamp
                  : await photoTimestampHelper.getExactCaptureTime({ uri: item.uri, fileName: item.fileName });
              results.push({
                uri: item.uri,
                timestamp: snapTime,
                fileName: item.fileName,
              });
            }
          }
        }
      } catch (e) {
        console.warn('Error reading native initial shared media:', e);
      }
    }

    // 2. Check Linking initial URL fallback (iOS / deep links)
    if (results.length === 0) {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const urls = this.parseIncomingUrls(initialUrl);
          for (const uri of urls) {
            const snapTime = await photoTimestampHelper.getExactCaptureTime({ uri });
            results.push({ uri, timestamp: snapTime });
          }
        }
      } catch (e) {
        console.warn('Error reading Linking initial URL:', e);
      }
    }

    return this.sortByCreationTimestamp(results);
  },

  /**
   * Listen for incoming shared images while app is running (warm start)
   */
  addSharedMediaListener(callback: (items: SharedMediaItem[]) => void): () => void {
    const subscriptions: Array<{ remove: () => void }> = [];

    // 1. Android Native ShareIntentModule Event Listener
    if (shareIntentEmitter) {
      const sub = shareIntentEmitter.addListener(
        'onSharedMediaReceived',
        async (nativeItems: Array<{ uri: string; timestamp?: number; fileName?: string }>) => {
          if (Array.isArray(nativeItems) && nativeItems.length > 0) {
            const results: SharedMediaItem[] = [];
            for (const item of nativeItems) {
              if (item.uri) {
                const snapTime =
                  item.timestamp && item.timestamp > 0
                    ? item.timestamp
                    : await photoTimestampHelper.getExactCaptureTime({ uri: item.uri, fileName: item.fileName });
                results.push({
                  uri: item.uri,
                  timestamp: snapTime,
                  fileName: item.fileName,
                });
              }
            }
            if (results.length > 0) {
              callback(this.sortByCreationTimestamp(results));
            }
          }
        }
      );
      subscriptions.push(sub);
    }

    // 2. Linking URL Listener for deep link schemes
    const linkSub = Linking.addEventListener('url', async (event: { url: string }) => {
      const urls = this.parseIncomingUrls(event.url);
      if (urls.length > 0) {
        const results: SharedMediaItem[] = [];
        for (const uri of urls) {
          const snapTime = await photoTimestampHelper.getExactCaptureTime({ uri });
          results.push({ uri, timestamp: snapTime });
        }
        callback(this.sortByCreationTimestamp(results));
      }
    });
    subscriptions.push(linkSub);

    return () => {
      subscriptions.forEach((s) => s.remove());
    };
  },

  /**
   * Clear any cached shared media
   */
  async clearSharedMedia(): Promise<void> {
    if (ShareIntentModule?.clearSharedMedia) {
      try {
        await ShareIntentModule.clearSharedMedia();
      } catch (e) {
        console.warn('Error clearing shared media:', e);
      }
    }
  },

  /**
   * Parse shared image URIs from deep links or intent URLs
   */
  parseIncomingUrls(url: string | null): string[] {
    if (!url) return [];
    try {
      const parsed = Linking.parse(url);
      if (parsed.queryParams?.images) {
        const raw = parsed.queryParams.images;
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
          try {
            return JSON.parse(raw);
          } catch {
            return [raw];
          }
        }
      }
      if (parsed.queryParams?.uri) {
        return [parsed.queryParams.uri as string];
      }
      return [];
    } catch (e) {
      console.warn('Error parsing incoming URL:', e);
      return [];
    }
  },
};

