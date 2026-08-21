import * as Font from 'expo-font';
import { APP_FONTS, CORE_FONT_IDS, AppFont } from '../constants/fonts';

const loadedFontsSet = new Set<string>();

export const fontLoader = {
  isFontLoaded(fontId: string): boolean {
    return loadedFontsSet.has(fontId) || Font.isLoaded(fontId);
  },

  async loadFont(fontId: string): Promise<boolean> {
    if (this.isFontLoaded(fontId)) return true;

    const fontItem = APP_FONTS.find((f) => f.id === fontId);
    if (!fontItem) return false;

    try {
      await Font.loadAsync({
        [fontItem.family]: fontItem.asset,
      });
      loadedFontsSet.add(fontId);
      return true;
    } catch (e) {
      console.warn(`[fontLoader] Failed to load font ${fontId}:`, e);
      return false;
    }
  },

  async loadCoreFonts(): Promise<void> {
    const fontsToLoad: { [name: string]: any } = {};
    for (const id of CORE_FONT_IDS) {
      if (!this.isFontLoaded(id)) {
        const item = APP_FONTS.find((f) => f.id === id);
        if (item) {
          fontsToLoad[item.family] = item.asset;
        }
      }
    }

    if (Object.keys(fontsToLoad).length > 0) {
      try {
        await Font.loadAsync(fontsToLoad);
        for (const id of Object.keys(fontsToLoad)) {
          loadedFontsSet.add(id);
        }
      } catch (e) {
        console.warn('[fontLoader] Error loading core fonts:', e);
      }
    }
  },

  async loadCategoryFonts(category: string): Promise<void> {
    const categoryFonts = APP_FONTS.filter(
      (f) => (category === 'all' || f.category === category) && !this.isFontLoaded(f.id)
    );

    const fontsToLoad: { [name: string]: any } = {};
    for (const item of categoryFonts) {
      fontsToLoad[item.family] = item.asset;
    }

    if (Object.keys(fontsToLoad).length > 0) {
      try {
        await Font.loadAsync(fontsToLoad);
        for (const id of Object.keys(fontsToLoad)) {
          loadedFontsSet.add(id);
        }
      } catch (e) {
        console.warn(`[fontLoader] Error loading fonts for category ${category}:`, e);
      }
    }
  },
};
