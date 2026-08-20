import * as Linking from 'expo-linking';

export const shareIntentService = {
  /**
   * Parse shared image URIs from deep links or intent URLs
   */
  parseIncomingUrls(url: string | null): string[] {
    if (!url) return [];
    try {
      const parsed = Linking.parse(url);
      // Check query params or path for shared image URIs
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
