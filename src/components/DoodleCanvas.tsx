import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  PanResponder,
  GestureResponderEvent,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { DoodleStroke, Point } from '../types/doodle';

interface DoodleCanvasProps {
  frameUri?: string;
  aspectRatio?: number;
  strokes: DoodleStroke[];
  onAddStroke: (stroke: DoodleStroke) => void;
  onClearDoodles: () => void;
  onUndoLastStroke?: () => void;
  onClose: () => void;
  frameIndex: number;
  totalFrames?: number;
}

const COLOR_PALETTE = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#FBBF24', // Yellow
  '#10B981', // Green
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#FFFFFF', // White
  '#000000', // Black
];

const BRUSH_SIZES = [
  { size: 3, label: 'Fine' },
  { size: 6, label: 'Medium' },
  { size: 12, label: 'Thick' },
  { size: 20, label: 'Heavy' },
];

export const DoodleCanvas: React.FC<DoodleCanvasProps> = ({
  frameUri,
  aspectRatio = 16 / 9,
  strokes,
  onAddStroke,
  onClearDoodles,
  onUndoLastStroke,
  onClose,
  frameIndex,
  totalFrames,
}) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const [selectedColor, setSelectedColor] = useState('#EF4444');
  const [selectedSize, setSelectedSize] = useState(6);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [isFocusMode, setIsFocusMode] = useState(false); // Maximize canvas mode

  // Keep latest state in refs so PanResponder always executes with fresh closures
  const selectedColorRef = useRef(selectedColor);
  selectedColorRef.current = selectedColor;

  const selectedSizeRef = useRef(selectedSize);
  selectedSizeRef.current = selectedSize;

  const onAddStrokeRef = useRef(onAddStroke);
  onAddStrokeRef.current = onAddStroke;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath([{ x: locationX, y: locationY }]);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath((prev) => [...prev, { x: locationX, y: locationY }]);
      },
      onPanResponderRelease: () => {
        setCurrentPath((latestPath) => {
          if (latestPath.length > 0) {
            const newStroke: DoodleStroke = {
              id: `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              color: selectedColorRef.current,
              strokeWidth: selectedSizeRef.current,
              points: latestPath,
            };
            onAddStrokeRef.current(newStroke);
          }
          return [];
        });
      },
      onPanResponderTerminate: () => {
        setCurrentPath([]);
      },
    })
  ).current;

  // Convert points array to SVG path data (M x y L x y ...)
  const pointsToSvgPath = (points: Point[]): string => {
    if (points.length === 0) return '';
    const [first, ...rest] = points;
    let path = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
    for (let i = 0; i < rest.length; i++) {
      path += ` L ${rest[i].x.toFixed(1)} ${rest[i].y.toFixed(1)}`;
    }
    return path;
  };

  const hasStrokes = strokes.length > 0;

  return (
    <Modal
      visible={true}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.fullOverlay}>
        {/* Top Header Bar */}
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
              <Ionicons name="brush" size={14} color="#818CF8" style={{ marginRight: 6 }} />
              <Text style={styles.titleBadgeText}>
                Doodle • Frame #{frameIndex + 1}
                {totalFrames ? `/${totalFrames}` : ''}
              </Text>
            </View>
          )}

          <View style={styles.topActions}>
            {/* Fullscreen / Focus Canvas Toggle */}
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
                  {isFocusMode ? 'Tools' : 'Full Screen'}
                </Text>
              )}
            </Pressable>

            {onUndoLastStroke && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.undoBtn,
                  !hasStrokes && styles.disabledBtn,
                  { transform: [{ scale: pressed && hasStrokes ? 0.92 : 1 }] },
                ]}
                disabled={!hasStrokes}
                unstable_pressDelay={0}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={onUndoLastStroke}
              >
                <Ionicons name="arrow-undo" size={16} color={hasStrokes ? '#FFFFFF' : '#64748B'} />
                {!isLandscape && (
                  <Text style={[styles.actionBtnText, !hasStrokes && styles.disabledBtnText]}>
                    Undo
                  </Text>
                )}
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.clearBtn,
                !hasStrokes && styles.disabledBtn,
                { transform: [{ scale: pressed && hasStrokes ? 0.92 : 1 }] },
              ]}
              disabled={!hasStrokes}
              unstable_pressDelay={0}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onClearDoodles}
            >
              <Ionicons name="trash" size={16} color={hasStrokes ? '#FFFFFF' : '#64748B'} />
              {!isLandscape && (
                <Text style={[styles.actionBtnText, !hasStrokes && styles.disabledBtnText]}>
                  Clear
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
              onPress={onClose}
            >
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>

        {/* Full-Screen Drawing Canvas Viewport */}
        <View
          style={[
            styles.canvasContainer,
            isLandscape && styles.canvasContainerLandscape,
            isFocusMode && styles.canvasContainerFocus,
          ]}
          pointerEvents="box-none"
        >
          <View
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
            {...panResponder.panHandlers}
          >
            {/* Target Frame Image under Doodles */}
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

            {/* SVG Strokes Layer */}
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              {/* Render saved strokes */}
              {strokes.map((stroke) => (
                <Path
                  key={stroke.id}
                  d={pointsToSvgPath(stroke.points)}
                  stroke={stroke.color}
                  strokeWidth={stroke.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}

              {/* Render active in-progress stroke */}
              {currentPath.length > 0 && (
                <Path
                  d={pointsToSvgPath(currentPath)}
                  stroke={selectedColor}
                  strokeWidth={selectedSize}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              )}
            </Svg>
          </View>
        </View>

        {/* Bottom Color Palette & Brush Size Control Dock */}
        {!isFocusMode && (
          <View
            style={[
              styles.bottomBar,
              {
                bottom: Math.max(insets.bottom + 6, 12),
                left: Math.max(insets.left + 12, 12),
                right: Math.max(insets.right + 12, 12),
              },
            ]}
            pointerEvents="box-none"
          >
            <View style={[styles.dockSurface, isLandscape && styles.dockSurfaceLandscape]}>
              {/* Color Palette Row */}
              <View style={styles.paletteRow}>
                {COLOR_PALETTE.map((color) => {
                  const isSelected = selectedColor === color;
                  return (
                    <Pressable
                      key={color}
                      unstable_pressDelay={0}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      style={({ pressed }) => [
                        styles.colorCircle,
                        { backgroundColor: color },
                        isSelected && styles.selectedColorCircle,
                        { transform: [{ scale: pressed ? 0.90 : 1 }] },
                      ]}
                      onPress={() => setSelectedColor(color)}
                    >
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={13}
                          color={color === '#FFFFFF' || color === '#FBBF24' ? '#000000' : '#FFFFFF'}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Brush Size Selector */}
              <View style={styles.sizeRow}>
                {BRUSH_SIZES.map((b) => {
                  const isSelected = selectedSize === b.size;
                  return (
                    <Pressable
                      key={b.size}
                      unstable_pressDelay={0}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      style={({ pressed }) => [
                        styles.sizeBtn,
                        isSelected && styles.selectedSizeBtn,
                        { transform: [{ scale: pressed ? 0.94 : 1 }] },
                      ]}
                      onPress={() => setSelectedSize(b.size)}
                    >
                      <View
                        style={[
                          styles.sizeDot,
                          {
                            width: Math.max(5, b.size),
                            height: Math.max(5, b.size),
                            borderRadius: Math.max(5, b.size) / 2,
                            backgroundColor: isSelected ? '#FFFFFF' : '#94A3B8',
                          },
                        ]}
                      />
                      <Text style={[styles.sizeLabel, { color: isSelected ? '#FFFFFF' : '#94A3B8' }]}>
                        {b.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullOverlay: {
    flex: 1,
    backgroundColor: '#090D16',
    position: 'relative',
  },
  canvasContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 56,
    paddingBottom: 72,
  },
  canvasContainerLandscape: {
    paddingHorizontal: 12,
    paddingTop: 48,
    paddingBottom: 58,
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
  },
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
  focusToggleBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  focusToggleBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.85)',
    borderColor: '#818CF8',
  },
  undoBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.4)',
  },
  clearBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.4)',
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
  disabledBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderColor: 'transparent',
    opacity: 0.5,
  },
  disabledBtnText: {
    color: '#64748B',
  },
  bottomBar: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 1010,
  },
  dockSurface: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  dockSurfaceLandscape: {
    maxWidth: 680,
    paddingVertical: 6,
  },
  paletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  colorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedColorCircle: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.18 }],
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.2)',
    paddingLeft: 6,
    marginLeft: 5,
  },
  sizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 7,
    gap: 3,
  },
  selectedSizeBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.45)',
  },
  sizeDot: {},
  sizeLabel: {
    fontSize: 10.5,
    fontWeight: '700',
  },
});
