import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Dimensions,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { TextOverlay, FontCategory } from '../types/textOverlay';
import { APP_FONTS, FONT_CATEGORIES, AppFont } from '../constants/fonts';
import { fontLoader } from '../utils/fontLoader';

interface TextOverlayEditorProps {
  frameUri?: string;
  aspectRatio?: number;
  textOverlays: TextOverlay[];
  onSaveTextOverlays: (updated: TextOverlay[]) => void;
  onClose: () => void;
  frameIndex: number;
  totalFrames?: number;
}

const TEXT_COLORS = [
  '#FFFFFF', // White
  '#FBBF24', // Yellow
  '#EF4444', // Red
  '#10B981', // Green
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F97316', // Orange
  '#000000', // Black
];

const BG_PILL_COLORS = [
  'transparent',
  'rgba(0, 0, 0, 0.75)',
  'rgba(255, 255, 255, 0.85)',
  'rgba(99, 102, 241, 0.85)',
  'rgba(239, 68, 68, 0.85)',
  'rgba(16, 185, 129, 0.85)',
  'rgba(245, 158, 11, 0.85)',
  'rgba(236, 72, 153, 0.85)',
];

const PRESET_SIZES = [18, 24, 32, 42, 56];

export const TextOverlayEditor: React.FC<TextOverlayEditorProps> = ({
  frameUri,
  aspectRatio = 16 / 9,
  textOverlays: initialOverlays,
  onSaveTextOverlays,
  onClose,
  frameIndex,
  totalFrames,
}) => {
  const insets = useSafeAreaInsets();
  const [overlays, setOverlays] = useState<TextOverlay[]>(initialOverlays || []);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialOverlays && initialOverlays.length > 0 ? initialOverlays[0].id : null
  );
  const [selectedCategory, setSelectedCategory] = useState<FontCategory>('all');
  const [activeTab, setActiveTab] = useState<'font' | 'color' | 'size'>('font');
  const [stageDimensions, setStageDimensions] = useState({ width: 300, height: 200 });

  const selectedOverlay = overlays.find((o) => o.id === selectedId) || null;

  // Preload initial core fonts & current overlay fonts
  useEffect(() => {
    fontLoader.loadCoreFonts();
    for (const ov of overlays) {
      fontLoader.loadFont(ov.fontFamily);
    }
  }, []);

  // Preload fonts for active category
  useEffect(() => {
    fontLoader.loadCategoryFonts(selectedCategory);
  }, [selectedCategory]);

  const handleStageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setStageDimensions({ width, height });
    }
  };

  const handleAddText = () => {
    const newOverlay: TextOverlay = {
      id: `txt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: 'Double Tap to Edit',
      fontFamily: 'PressStart2P',
      fontSize: 28,
      color: '#FFFFFF',
      backgroundColor: 'transparent',
      x: 0.5,
      y: 0.5,
      align: 'center',
      shadow: true,
    };
    fontLoader.loadFont(newOverlay.fontFamily);
    const updated = [...overlays, newOverlay];
    setOverlays(updated);
    setSelectedId(newOverlay.id);
  };

  const handleUpdateSelected = (patch: Partial<TextOverlay>) => {
    if (!selectedId) return;
    setOverlays((prev) =>
      prev.map((o) => (o.id === selectedId ? { ...o, ...patch } : o))
    );
  };

  const handleDeleteSelected = () => {
    if (!selectedId) return;
    const updated = overlays.filter((o) => o.id !== selectedId);
    setOverlays(updated);
    setSelectedId(updated.length > 0 ? updated[updated.length - 1].id : null);
  };

  const handleSelectFont = async (font: AppFont) => {
    await fontLoader.loadFont(font.id);
    handleUpdateSelected({ fontFamily: font.family });
  };

  const handleSaveAndClose = () => {
    onSaveTextOverlays(overlays);
    onClose();
  };

  // Dragging PanResponder for selected text overlay
  const dragStartPos = useRef({ x: 0.5, y: 0.5 });
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        if (selectedOverlay) {
          dragStartPos.current = { x: selectedOverlay.x, y: selectedOverlay.y };
        }
      },
      onPanResponderMove: (
        evt: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        if (!selectedId || stageDimensions.width <= 0 || stageDimensions.height <= 0) return;
        const deltaX = gestureState.dx / stageDimensions.width;
        const deltaY = gestureState.dy / stageDimensions.height;
        const newX = Math.max(0.05, Math.min(0.95, dragStartPos.current.x + deltaX));
        const newY = Math.max(0.05, Math.min(0.95, dragStartPos.current.y + deltaY));
        handleUpdateSelected({ x: newX, y: newY });
      },
    })
  ).current;

  // Filter fonts by selected category
  const filteredFonts = APP_FONTS.filter(
    (f) => selectedCategory === 'all' || f.category === selectedCategory
  );

  return (
    <View style={styles.fullOverlay} pointerEvents="box-none">
      {/* Top Bar */}
      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable
          style={({ pressed }) => [
            styles.backBtn,
            { transform: [{ scale: pressed ? 0.92 : 1 }] },
          ]}
          unstable_pressDelay={0}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={onClose}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </Pressable>

        <View style={styles.titleBadge}>
          <Ionicons name="text" size={15} color="#818CF8" style={{ marginRight: 6 }} />
          <Text style={styles.titleBadgeText}>
            Text Studio • Frame #{frameIndex + 1}
            {totalFrames ? ` of ${totalFrames}` : ''}
          </Text>
        </View>

        <View style={styles.topActions}>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.addBtn,
              { transform: [{ scale: pressed ? 0.92 : 1 }] },
            ]}
            unstable_pressDelay={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={handleAddText}
          >
            <Ionicons name="add" size={17} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Add Text</Text>
          </Pressable>

          {selectedOverlay && (
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.deleteBtn,
                { transform: [{ scale: pressed ? 0.92 : 1 }] },
              ]}
              unstable_pressDelay={0}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={handleDeleteSelected}
            >
              <Ionicons name="trash-outline" size={15} color="#FFFFFF" />
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.doneBtn,
              { transform: [{ scale: pressed ? 0.92 : 1 }] },
            ]}
            unstable_pressDelay={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={handleSaveAndClose}
          >
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      </View>

      {/* Main Canvas Viewport Area */}
      <View style={styles.canvasContainer} pointerEvents="box-none">
        <Pressable
          style={[
            styles.stageBox,
            {
              aspectRatio: aspectRatio,
              width: aspectRatio >= 1 ? '100%' : 'auto',
              height: aspectRatio >= 1 ? 'auto' : '100%',
              maxWidth: '100%',
              maxHeight: '100%',
            },
          ]}
          onLayout={handleStageLayout}
          onPress={() => setSelectedId(null)}
        >
          {/* Target Frame Image */}
          {frameUri ? (
            <ExpoImage
              source={{ uri: frameUri }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              transition={0}
              cachePolicy="memory-disk"
              priority="high"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1E293B' }]} />
          )}

          {/* Render Text Overlays */}
          {overlays.map((ov) => {
            const isSelected = ov.id === selectedId;
            return (
              <View
                key={ov.id}
                style={[
                  styles.textOverlayAnchor,
                  {
                    left: `${(ov.x * 100).toFixed(2)}%` as any,
                    top: `${(ov.y * 100).toFixed(2)}%` as any,
                  },
                ]}
                pointerEvents="box-none"
              >
                <View
                  style={[
                    styles.textOverlayWrapper,
                    isSelected && styles.selectedOverlayWrapper,
                  ]}
                  {...(isSelected ? panResponder.panHandlers : {})}
                >
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      setSelectedId(ov.id);
                    }}
                    style={[
                      styles.textContainerPill,
                      ov.backgroundColor && ov.backgroundColor !== 'transparent'
                        ? { backgroundColor: ov.backgroundColor, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }
                        : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.renderedText,
                        {
                          fontFamily: fontLoader.isFontLoaded(ov.fontFamily)
                            ? ov.fontFamily
                            : undefined,
                          fontSize: ov.fontSize,
                          color: ov.color,
                          textAlign: ov.align || 'center',
                        },
                        ov.shadow && styles.textShadowEffect,
                      ]}
                    >
                      {ov.text || 'Text'}
                    </Text>
                  </Pressable>

                  {/* Visual Drag Handles when Selected */}
                  {isSelected && (
                    <View style={styles.selectionBorder} pointerEvents="none">
                      <View style={[styles.cornerDot, styles.cornerTL]} />
                      <View style={[styles.cornerDot, styles.cornerTR]} />
                      <View style={[styles.cornerDot, styles.cornerBL]} />
                      <View style={[styles.cornerDot, styles.cornerBR]} />
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </Pressable>
      </View>

      {/* Bottom Floating Control Dock */}
      {selectedOverlay ? (
        <View
          style={[styles.bottomBar, { bottom: Math.max(insets.bottom + 4, 14) }]}
          pointerEvents="box-none"
        >
          <View style={styles.dockSurface}>
            {/* 1. Live Text Input Field */}
            <View style={styles.inputRow}>
              <Ionicons name="pencil" size={15} color="#818CF8" style={{ marginLeft: 4 }} />
              <TextInput
                value={selectedOverlay.text}
                onChangeText={(text) => handleUpdateSelected({ text })}
                placeholder="Type your text..."
                placeholderTextColor="#64748B"
                style={styles.textInput}
                selectTextOnFocus
              />
              {/* Shadow toggle button */}
              <Pressable
                style={[
                  styles.toggleBadge,
                  selectedOverlay.shadow && styles.toggleBadgeActive,
                ]}
                onPress={() => handleUpdateSelected({ shadow: !selectedOverlay.shadow })}
              >
                <Ionicons
                  name="contrast"
                  size={14}
                  color={selectedOverlay.shadow ? '#FFFFFF' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.toggleBadgeText,
                    selectedOverlay.shadow && styles.toggleBadgeTextActive,
                  ]}
                >
                  Shadow
                </Text>
              </Pressable>

              {/* Align toggle button */}
              <Pressable
                style={styles.toggleBadge}
                onPress={() => {
                  const aligns: ('left' | 'center' | 'right')[] = ['center', 'right', 'left'];
                  const nextAlign =
                    aligns[(aligns.indexOf(selectedOverlay.align || 'center') + 1) % aligns.length];
                  handleUpdateSelected({ align: nextAlign });
                }}
              >
                <Ionicons
                  name={
                    selectedOverlay.align === 'left'
                      ? 'text'
                      : selectedOverlay.align === 'right'
                      ? 'reorder-four'
                      : 'reorder-three'
                  }
                  size={15}
                  color="#FFFFFF"
                />
              </Pressable>
            </View>

            {/* 2. Mode Tabs (Font, Color, Size) */}
            <View style={styles.modeTabsRow}>
              <Pressable
                style={[styles.modeTabBtn, activeTab === 'font' && styles.modeTabBtnActive]}
                onPress={() => setActiveTab('font')}
              >
                <Ionicons
                  name="text"
                  size={13}
                  color={activeTab === 'font' ? '#FFFFFF' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.modeTabBtnText,
                    activeTab === 'font' && styles.modeTabBtnTextActive,
                  ]}
                >
                  Font (100)
                </Text>
              </Pressable>

              <Pressable
                style={[styles.modeTabBtn, activeTab === 'color' && styles.modeTabBtnActive]}
                onPress={() => setActiveTab('color')}
              >
                <Ionicons
                  name="color-palette"
                  size={13}
                  color={activeTab === 'color' ? '#FFFFFF' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.modeTabBtnText,
                    activeTab === 'color' && styles.modeTabBtnTextActive,
                  ]}
                >
                  Color & BG
                </Text>
              </Pressable>

              <Pressable
                style={[styles.modeTabBtn, activeTab === 'size' && styles.modeTabBtnActive]}
                onPress={() => setActiveTab('size')}
              >
                <Ionicons
                  name="resize"
                  size={13}
                  color={activeTab === 'size' ? '#FFFFFF' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.modeTabBtnText,
                    activeTab === 'size' && styles.modeTabBtnTextActive,
                  ]}
                >
                  Size ({selectedOverlay.fontSize}px)
                </Text>
              </Pressable>
            </View>

            {/* 3A. Font Picker Panel */}
            {activeTab === 'font' && (
              <View style={styles.fontPanel}>
                {/* Category Pills */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScroll}
                >
                  {FONT_CATEGORIES.map((cat) => {
                    const isCatSelected = selectedCategory === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        style={[
                          styles.catPill,
                          isCatSelected && styles.catPillActive,
                        ]}
                        onPress={() => setSelectedCategory(cat.id)}
                      >
                        <Text
                          style={[
                            styles.catPillText,
                            isCatSelected && styles.catPillTextActive,
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Font Items Carousel */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.fontsScroll}
                >
                  {filteredFonts.map((f) => {
                    const isFontSelected = selectedOverlay.fontFamily === f.family;
                    return (
                      <Pressable
                        key={f.id}
                        style={[
                          styles.fontCard,
                          isFontSelected && styles.fontCardSelected,
                        ]}
                        onPress={() => handleSelectFont(f)}
                      >
                        <Text
                          style={[
                            styles.fontCardPreview,
                            {
                              fontFamily: fontLoader.isFontLoaded(f.id)
                                ? f.family
                                : undefined,
                            },
                            isFontSelected && styles.fontCardPreviewSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {f.name}
                        </Text>
                        <Text style={styles.fontCardCategory}>{f.category}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* 3B. Color & Background Palette Panel */}
            {activeTab === 'color' && (
              <View style={styles.colorPanel}>
                {/* Text Color Row */}
                <Text style={styles.panelSectionTitle}>Text Color</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.paletteScroll}
                >
                  {TEXT_COLORS.map((c) => {
                    const isColorSelected = selectedOverlay.color === c;
                    return (
                      <Pressable
                        key={c}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: c },
                          isColorSelected && styles.colorCircleSelected,
                        ]}
                        onPress={() => handleUpdateSelected({ color: c })}
                      >
                        {isColorSelected && (
                          <Ionicons
                            name="checkmark"
                            size={14}
                            color={c === '#FFFFFF' || c === '#FBBF24' ? '#000000' : '#FFFFFF'}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Background Banner Highlight Row */}
                <Text style={[styles.panelSectionTitle, { marginTop: 8 }]}>Banner Highlight</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.paletteScroll}
                >
                  {BG_PILL_COLORS.map((bg, idx) => {
                    const isBgSelected =
                      (selectedOverlay.backgroundColor || 'transparent') === bg;
                    return (
                      <Pressable
                        key={idx}
                        style={[
                          styles.bgPillCircle,
                          { backgroundColor: bg === 'transparent' ? '#1E293B' : bg },
                          isBgSelected && styles.colorCircleSelected,
                        ]}
                        onPress={() => handleUpdateSelected({ backgroundColor: bg })}
                      >
                        {bg === 'transparent' ? (
                          <Ionicons name="close" size={13} color="#94A3B8" />
                        ) : isBgSelected ? (
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* 3C. Size Panel */}
            {activeTab === 'size' && (
              <View style={styles.sizePanel}>
                <View style={styles.sizeStepperRow}>
                  <Pressable
                    style={styles.sizeStepBtn}
                    onPress={() =>
                      handleUpdateSelected({
                        fontSize: Math.max(12, selectedOverlay.fontSize - 4),
                      })
                    }
                  >
                    <Ionicons name="remove" size={18} color="#FFFFFF" />
                  </Pressable>

                  <Text style={styles.sizeValueDisplay}>{selectedOverlay.fontSize} px</Text>

                  <Pressable
                    style={styles.sizeStepBtn}
                    onPress={() =>
                      handleUpdateSelected({
                        fontSize: Math.min(80, selectedOverlay.fontSize + 4),
                      })
                    }
                  >
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>

                {/* Preset Chips */}
                <View style={styles.presetChipsRow}>
                  {PRESET_SIZES.map((sz) => (
                    <Pressable
                      key={sz}
                      style={[
                        styles.sizeChip,
                        selectedOverlay.fontSize === sz && styles.sizeChipSelected,
                      ]}
                      onPress={() => handleUpdateSelected({ fontSize: sz })}
                    >
                      <Text
                        style={[
                          styles.sizeChipText,
                          selectedOverlay.fontSize === sz && styles.sizeChipTextSelected,
                        ]}
                      >
                        {sz}px
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>
      ) : (
        /* Empty selection floating helper */
        <View
          style={[styles.bottomBar, { bottom: Math.max(insets.bottom + 8, 18) }]}
          pointerEvents="box-none"
        >
          <Pressable
            style={styles.emptyPromptBtn}
            onPress={handleAddText}
          >
            <Ionicons name="add-circle" size={18} color="#818CF8" style={{ marginRight: 6 }} />
            <Text style={styles.emptyPromptText}>Tap to add a new Text Overlay</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fullOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#080C14',
    zIndex: 999,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1010,
    gap: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  titleBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  addBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.4)',
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.4)',
    paddingHorizontal: 9,
  },
  doneBtn: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  canvasContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 65,
    paddingBottom: 230,
  },
  stageBox: {
    backgroundColor: '#000000',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
  },
  textOverlayAnchor: {
    position: 'absolute',
    transform: [{ translateX: -50 }, { translateY: -50 }],
  },
  textOverlayWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  selectedOverlayWrapper: {},
  textContainerPill: {},
  renderedText: {
    fontWeight: '600',
  },
  textShadowEffect: {
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1.5, height: 1.5 },
    textShadowRadius: 3,
  },
  selectionBorder: {
    position: 'absolute',
    top: -6,
    left: -8,
    right: -8,
    bottom: -6,
    borderWidth: 1.5,
    borderColor: '#6366F1',
    borderStyle: 'dashed',
    borderRadius: 6,
  },
  cornerDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#818CF8',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  cornerTL: { top: -4, left: -4 },
  cornerTR: { top: -4, right: -4 },
  cornerBL: { bottom: -4, left: -4 },
  cornerBR: { bottom: -4, right: -4 },
  bottomBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    alignItems: 'center',
    zIndex: 1010,
  },
  dockSurface: {
    width: '100%',
    maxWidth: 680,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 2,
  },
  toggleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  toggleBadgeActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.8)',
    borderColor: '#818CF8',
  },
  toggleBadgeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  toggleBadgeTextActive: {
    color: '#FFFFFF',
  },
  modeTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 6,
  },
  modeTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
  },
  modeTabBtnActive: {
    backgroundColor: '#6366F1',
  },
  modeTabBtnText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  modeTabBtnTextActive: {
    color: '#FFFFFF',
  },
  fontPanel: {
    marginTop: 4,
  },
  categoryScroll: {
    gap: 6,
    paddingVertical: 4,
  },
  catPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  catPillActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.5)',
    borderColor: '#818CF8',
  },
  catPillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  catPillTextActive: {
    color: '#FFFFFF',
  },
  fontsScroll: {
    gap: 8,
    paddingVertical: 8,
  },
  fontCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 90,
  },
  fontCardSelected: {
    borderColor: '#818CF8',
    backgroundColor: 'rgba(99, 102, 241, 0.35)',
  },
  fontCardPreview: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  fontCardPreviewSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  fontCardCategory: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  colorPanel: {
    marginTop: 4,
    paddingVertical: 4,
  },
  panelSectionTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  paletteScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgPillCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleSelected: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  sizePanel: {
    marginTop: 6,
    paddingVertical: 4,
    alignItems: 'center',
  },
  sizeStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 10,
  },
  sizeStepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeValueDisplay: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    minWidth: 70,
    textAlign: 'center',
  },
  presetChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sizeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sizeChipSelected: {
    backgroundColor: '#6366F1',
    borderColor: '#818CF8',
  },
  sizeChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  sizeChipTextSelected: {
    color: '#FFFFFF',
  },
  emptyPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyPromptText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
