import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  LayoutChangeEvent,
  useWindowDimensions,
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

const PRESET_SIZES = [16, 22, 28, 36, 48, 60];

interface DraggableTextItemProps {
  overlay: TextOverlay;
  isSelected: boolean;
  stageDimensions: { width: number; height: number };
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
}

const DraggableTextItem: React.FC<DraggableTextItemProps> = ({
  overlay,
  isSelected,
  stageDimensions,
  onSelect,
  onUpdatePosition,
}) => {
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  const stageDimensionsRef = useRef(stageDimensions);
  stageDimensionsRef.current = stageDimensions;

  const dragStartPos = useRef({ x: overlay.x, y: overlay.y });
  const [isDragging, setIsDragging] = useState(false);
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 1 || Math.abs(gestureState.dy) > 1,
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          Math.abs(gestureState.dx) > 1 || Math.abs(gestureState.dy) > 1,
        onPanResponderGrant: () => {
          setIsDragging(true);
          onSelect(overlayRef.current.id);
          dragStartPos.current = {
            x: overlayRef.current.x,
            y: overlayRef.current.y,
          };
        },
        onPanResponderMove: (_, gestureState) => {
          const width = stageDimensionsRef.current.width;
          const height = stageDimensionsRef.current.height;
          if (width <= 0 || height <= 0) return;

          const deltaX = gestureState.dx / width;
          const deltaY = gestureState.dy / height;
          const newX = Math.max(0.05, Math.min(0.95, dragStartPos.current.x + deltaX));
          const newY = Math.max(0.05, Math.min(0.95, dragStartPos.current.y + deltaY));
          onUpdatePosition(overlayRef.current.id, newX, newY);
        },
        onPanResponderRelease: () => {
          setIsDragging(false);
        },
        onPanResponderTerminate: () => {
          setIsDragging(false);
        },
      }),
    [onSelect, onUpdatePosition]
  );

  return (
    <View
      style={[
        styles.textOverlayAnchor,
        {
          left: `${(overlay.x * 100).toFixed(2)}%` as any,
          top: `${(overlay.y * 100).toFixed(2)}%` as any,
          transform: [
            { translateX: layout.width > 0 ? -layout.width / 2 : -50 },
            { translateY: layout.height > 0 ? -layout.height / 2 : -20 },
          ],
        },
      ]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
          setLayout({ width, height });
        }
      }}
      {...panResponder.panHandlers}
    >
      <View
        style={[
          styles.textOverlayWrapper,
          isSelected && styles.selectedOverlayWrapper,
          isDragging && styles.draggingOverlayWrapper,
        ]}
      >
        <View
          style={[
            styles.textContainerPill,
            overlay.backgroundColor && overlay.backgroundColor !== 'transparent'
              ? {
                  backgroundColor: overlay.backgroundColor,
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 8,
                }
              : null,
          ]}
        >
          <Text
            style={[
              styles.renderedText,
              {
                fontFamily: fontLoader.isFontLoaded(overlay.fontFamily)
                  ? overlay.fontFamily
                  : undefined,
                fontSize: overlay.fontSize,
                color: overlay.color,
                textAlign: overlay.align || 'center',
              },
              overlay.shadow && styles.textShadowEffect,
            ]}
          >
            {overlay.text || 'Text'}
          </Text>
        </View>

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
};

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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const [overlays, setOverlays] = useState<TextOverlay[]>(initialOverlays || []);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialOverlays && initialOverlays.length > 0 ? initialOverlays[0].id : null
  );
  const [selectedCategory, setSelectedCategory] = useState<FontCategory>('all');
  const [activeTab, setActiveTab] = useState<'font' | 'color' | 'size'>('font');
  const [isFocusMode, setIsFocusMode] = useState(false); // Maximize canvas mode
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
      text: 'Text Layer',
      fontFamily: 'PressStart2P',
      fontSize: 26,
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

  const handleUpdatePosition = useCallback((id: string, x: number, y: number) => {
    setOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, x, y } : o))
    );
  }, []);

  const handleSelectOverlay = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

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

  // Filter fonts by selected category
  const filteredFonts = APP_FONTS.filter(
    (f) => selectedCategory === 'all' || f.category === selectedCategory
  );

  // Inspector panel content (reusable in landscape sidebar and portrait bottom sheet)
  const renderInspectorControls = () => {
    if (!selectedOverlay) {
      return (
        <View style={styles.emptyInspectorContainer}>
          <Pressable style={styles.emptyPromptBtn} onPress={handleAddText}>
            <Ionicons name="add-circle" size={18} color="#818CF8" style={{ marginRight: 6 }} />
            <Text style={styles.emptyPromptText}>Tap to Add Text Layer</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.inspectorContentWrapper}>
        {/* 1. Live Text Input Field with Shadow & Align */}
        <View style={styles.inputRow}>
          <Ionicons name="pencil" size={14} color="#818CF8" style={{ marginLeft: 4 }} />
          <TextInput
            value={selectedOverlay.text}
            onChangeText={(text) => handleUpdateSelected({ text })}
            placeholder="Type text..."
            placeholderTextColor="#64748B"
            style={styles.textInput}
            selectTextOnFocus
          />
          {/* Shadow toggle button */}
          <Pressable
            style={[styles.toggleBadge, selectedOverlay.shadow && styles.toggleBadgeActive]}
            onPress={() => handleUpdateSelected({ shadow: !selectedOverlay.shadow })}
          >
            <Ionicons
              name="contrast"
              size={13}
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
              size={14}
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
              size={12}
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
              size={12}
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
              size={12}
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
                    style={[styles.catPill, isCatSelected && styles.catPillActive]}
                    onPress={() => setSelectedCategory(cat.id)}
                  >
                    <Text
                      style={[styles.catPillText, isCatSelected && styles.catPillTextActive]}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

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
                    style={[styles.fontCard, isFontSelected && styles.fontCardSelected]}
                    onPress={() => handleSelectFont(f)}
                  >
                    <Text
                      style={[
                        styles.fontCardPreview,
                        {
                          fontFamily: fontLoader.isFontLoaded(f.id) ? f.family : undefined,
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
                        size={13}
                        color={c === '#FFFFFF' || c === '#FBBF24' ? '#000000' : '#FFFFFF'}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={[styles.panelSectionTitle, { marginTop: 6 }]}>Banner Background</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.paletteScroll}
            >
              {BG_PILL_COLORS.map((bg, idx) => {
                const isBgSelected = (selectedOverlay.backgroundColor || 'transparent') === bg;
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
                      <Ionicons name="close" size={12} color="#94A3B8" />
                    ) : isBgSelected ? (
                      <Ionicons name="checkmark" size={13} color="#FFFFFF" />
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
                    fontSize: Math.max(12, selectedOverlay.fontSize - 3),
                  })
                }
              >
                <Ionicons name="remove" size={16} color="#FFFFFF" />
              </Pressable>

              <Text style={styles.sizeValueDisplay}>{selectedOverlay.fontSize} px</Text>

              <Pressable
                style={styles.sizeStepBtn}
                onPress={() =>
                  handleUpdateSelected({
                    fontSize: Math.min(80, selectedOverlay.fontSize + 3),
                  })
                }
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
              </Pressable>
            </View>

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
    );
  };

  // Canvas Viewport component
  const renderCanvasStage = () => (
    <View
      style={[
        styles.canvasContainer,
        isLandscape && !isFocusMode && styles.canvasContainerLandscapeSplit,
        isFocusMode && styles.canvasContainerFocus,
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        style={[
          styles.stageBox,
          {
            aspectRatio: aspectRatio,
            width: isLandscape
              ? (aspectRatio >= 1 ? 'auto' : 'auto')
              : (aspectRatio >= 1 ? '100%' : 'auto'),
            height: isLandscape
              ? '96%'
              : (aspectRatio >= 1 ? 'auto' : '96%'),
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
        {overlays.map((ov) => (
          <DraggableTextItem
            key={ov.id}
            overlay={ov}
            isSelected={ov.id === selectedId}
            stageDimensions={stageDimensions}
            onSelect={handleSelectOverlay}
            onUpdatePosition={handleUpdatePosition}
          />
        ))}
      </Pressable>
    </View>
  );

  return (
    <Modal
      visible={true}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.fullOverlay}>
        {/* Landscape Mode: Side-by-Side View */}
        {isLandscape && !isFocusMode ? (
          <View style={styles.landscapeRootRow}>
            {/* Left: Maximized Full-Height Canvas */}
            <View style={styles.landscapeCanvasPane}>
              {/* Mini Top Action Strip for Canvas */}
              <View
                style={[
                  styles.miniTopStrip,
                  { top: Math.max(insets.top + 6, 10), left: Math.max(insets.left + 10, 10) },
                ]}
                pointerEvents="box-none"
              >
                <Pressable
                  style={styles.backBtn}
                  onPress={onClose}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
                </Pressable>
                <View style={styles.titleBadge}>
                  <Ionicons name="text" size={13} color="#818CF8" style={{ marginRight: 5 }} />
                  <Text style={styles.titleBadgeText}>Frame #{frameIndex + 1}</Text>
                </View>
              </View>

              {renderCanvasStage()}
            </View>

            {/* Right: Dedicated Inspector Sidebar */}
            <View
              style={[
                styles.landscapeSidebar,
                {
                  paddingTop: Math.max(insets.top + 6, 10),
                  paddingBottom: Math.max(insets.bottom + 6, 10),
                  paddingRight: Math.max(insets.right + 10, 10),
                },
              ]}
            >
              {/* Header Actions */}
              <View style={styles.sidebarHeaderRow}>
                <Pressable
                  style={[styles.actionBtn, styles.addBtn]}
                  onPress={handleAddText}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>Add</Text>
                </Pressable>

                {selectedOverlay && (
                  <Pressable
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={handleDeleteSelected}
                  >
                    <Ionicons name="trash-outline" size={15} color="#FFFFFF" />
                  </Pressable>
                )}

                <Pressable
                  style={[styles.actionBtn, styles.focusToggleBtn]}
                  onPress={() => setIsFocusMode(true)}
                >
                  <Ionicons name="scan-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>Full</Text>
                </Pressable>

                <Pressable
                  style={[styles.actionBtn, styles.doneBtn]}
                  onPress={handleSaveAndClose}
                >
                  <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                  <Text style={styles.doneBtnText}>Done</Text>
                </Pressable>
              </View>

              {/* Scrollable Inspector Controls */}
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingVertical: 6 }}
                showsVerticalScrollIndicator={false}
              >
                {renderInspectorControls()}
              </ScrollView>
            </View>
          </View>
        ) : (
          /* Portrait Mode or Focus Mode: Full Screen with Floating Glass Dock */
          <>
            {/* Top Bar */}
            <View
              style={[
                styles.topBar,
                {
                  top: Math.max(insets.top + 6, 12),
                  left: Math.max(insets.left + 12, 12),
                  right: Math.max(insets.right + 12, 12),
                },
              ]}
              pointerEvents="box-none"
            >
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

              {!isFocusMode && (
                <View style={styles.titleBadge}>
                  <Ionicons name="text" size={14} color="#818CF8" style={{ marginRight: 6 }} />
                  <Text style={styles.titleBadgeText}>
                    Text • Frame #{frameIndex + 1}
                    {totalFrames ? `/${totalFrames}` : ''}
                  </Text>
                </View>
              )}

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
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  {!isLandscape && <Text style={styles.actionBtnText}>Add</Text>}
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

                {/* Focus / Fullscreen Mode Toggle */}
                <Pressable
                  style={({ pressed }) => [
                    styles.actionBtn,
                    styles.focusToggleBtn,
                    isFocusMode && styles.focusToggleBtnActive,
                    { transform: [{ scale: pressed ? 0.92 : 1 }] },
                  ]}
                  unstable_pressDelay={0}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => setIsFocusMode(!isFocusMode)}
                >
                  <Ionicons
                    name={isFocusMode ? 'contract' : 'scan-outline'}
                    size={16}
                    color="#FFFFFF"
                  />
                  {!isLandscape && (
                    <Text style={styles.actionBtnText}>
                      {isFocusMode ? 'Tools' : 'Full'}
                    </Text>
                  )}
                </Pressable>

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

            {/* Canvas Viewport */}
            {renderCanvasStage()}

            {/* Bottom Floating Control Dock */}
            {!isFocusMode && (
              <View
                style={[
                  styles.bottomBar,
                  {
                    bottom: Math.max(insets.bottom + 4, 10),
                    left: Math.max(insets.left + 10, 10),
                    right: Math.max(insets.right + 10, 10),
                  },
                ]}
                pointerEvents="box-none"
              >
                <View style={styles.dockSurface}>
                  {renderInspectorControls()}
                </View>
              </View>
            )}
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullOverlay: {
    flex: 1,
    backgroundColor: '#080C14',
    position: 'relative',
  },
  landscapeRootRow: {
    flex: 1,
    flexDirection: 'row',
  },
  landscapeCanvasPane: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniTopStrip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 1010,
  },
  landscapeSidebar: {
    width: 320,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
  },
  sidebarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginBottom: 8,
  },
  canvasContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 56,
    paddingBottom: 190,
  },
  canvasContainerLandscapeSplit: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  canvasContainerFocus: {
    paddingTop: 44,
    paddingBottom: 8,
  },
  stageBox: {
    backgroundColor: '#000000',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    position: 'relative',
  },
  textOverlayAnchor: {
    position: 'absolute',
  },
  textOverlayWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  selectedOverlayWrapper: {},
  draggingOverlayWrapper: {
    opacity: 0.92,
    transform: [{ scale: 1.04 }],
  },
  textContainerPill: {},
  renderedText: {
    fontWeight: '600',
  },
  textShadowEffect: {
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
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
  topBar: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1010,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  titleBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
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
  },
  focusToggleBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  focusToggleBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.85)',
    borderColor: '#818CF8',
  },
  doneBtn: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 1010,
  },
  dockSurface: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  inspectorContentWrapper: {
    width: '100%',
  },
  emptyInspectorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  emptyPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  emptyPromptText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  toggleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  toggleBadgeActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.65)',
    borderColor: '#818CF8',
  },
  toggleBadgeText: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '600',
  },
  toggleBadgeTextActive: {
    color: '#FFFFFF',
  },
  modeTabsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  modeTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modeTabBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.65)',
    borderColor: '#818CF8',
  },
  modeTabBtnText: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '700',
  },
  modeTabBtnTextActive: {
    color: '#FFFFFF',
  },
  fontPanel: {
    gap: 6,
  },
  categoryScroll: {
    gap: 5,
    paddingBottom: 2,
  },
  catPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  catPillActive: {
    backgroundColor: '#6366F1',
    borderColor: '#818CF8',
  },
  catPillText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  catPillTextActive: {
    color: '#FFFFFF',
  },
  fontsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  fontCard: {
    width: 90,
    height: 48,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  fontCardSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.55)',
    borderColor: '#818CF8',
  },
  fontCardPreview: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
  },
  fontCardPreviewSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  fontCardCategory: {
    color: '#94A3B8',
    fontSize: 8,
    marginTop: 1,
  },
  colorPanel: {
    paddingVertical: 2,
  },
  panelSectionTitle: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  paletteScroll: {
    gap: 7,
    paddingVertical: 2,
  },
  colorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleSelected: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.18 }],
  },
  bgPillCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizePanel: {
    gap: 6,
  },
  sizeStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  sizeStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sizeValueDisplay: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'center',
  },
  presetChipsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  sizeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
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
    fontSize: 10,
    fontWeight: '700',
  },
  sizeChipTextSelected: {
    color: '#FFFFFF',
  },
});
