import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DoodleStroke, Point } from '../types/doodle';

interface DoodleCanvasProps {
  strokes: DoodleStroke[];
  onAddStroke: (stroke: DoodleStroke) => void;
  onClearDoodles: () => void;
  onUndoLastStroke?: () => void;
  onClose: () => void;
  frameIndex: number;
}

const COLOR_PALETTE = [
  '#EF4444', // Red
  '#F59E0B', // Orange
  '#FBBF24', // Yellow
  '#10B981', // Green
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#FFFFFF', // White
  '#000000', // Black
];

const BRUSH_SIZES = [
  { size: 3, label: 'Thin' },
  { size: 6, label: 'Medium' },
  { size: 12, label: 'Thick' },
];

export const DoodleCanvas: React.FC<DoodleCanvasProps> = ({
  strokes,
  onAddStroke,
  onClearDoodles,
  onUndoLastStroke,
  onClose,
  frameIndex,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedColor, setSelectedColor] = useState('#EF4444');
  const [selectedSize, setSelectedSize] = useState(4);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath([{ x: locationX, y: locationY }]);
      },
      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath((prev) => [...prev, { x: locationX, y: locationY }]);
      },
      onPanResponderRelease: () => {
        setCurrentPath((latestPath) => {
          if (latestPath.length > 0) {
            const newStroke: DoodleStroke = {
              id: `stroke_${Date.now()}_${Math.random()}`,
              color: selectedColor,
              strokeWidth: selectedSize,
              points: latestPath,
            };
            onAddStroke(newStroke);
          }
          return [];
        });
      },
    })
  ).current;

  // Convert an array of points into SVG path string (M x y L x y ...)
  const pointsToSvgPath = (points: Point[]): string => {
    if (points.length === 0) return '';
    const [first, ...rest] = points;
    let path = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
    rest.forEach((pt) => {
      path += ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    });
    return path;
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Interactive Drawing Layer */}
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
        <Svg style={StyleSheet.absoluteFill}>
          {/* Render already saved strokes */}
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

          {/* Render currently in-progress active stroke */}
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

      {/* Top Header Bar */}
      <View style={[styles.topBar, { top: insets.top + 10 }]}>
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
          <Ionicons name="brush" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.titleBadgeText}>Doodle Mode • Frame #{frameIndex + 1}</Text>
        </View>

        <View style={styles.topActions}>
          {strokes.length > 0 && onUndoLastStroke && (
            <Pressable
              style={({ pressed }) => [
                styles.undoBtn,
                { transform: [{ scale: pressed ? 0.92 : 1 }] },
              ]}
              unstable_pressDelay={0}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onUndoLastStroke}
            >
              <Ionicons name="arrow-undo" size={16} color="#FFFFFF" />
              <Text style={styles.undoBtnText}>Undo</Text>
            </Pressable>
          )}

          {strokes.length > 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.clearBtn,
                { transform: [{ scale: pressed ? 0.92 : 1 }] },
              ]}
              unstable_pressDelay={0}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onClearDoodles}
            >
              <Ionicons name="trash" size={16} color="#FFFFFF" />
              <Text style={styles.clearBtnText}>Clear</Text>
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [
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

      {/* Bottom Color Palette & Brush Size Floating Control Dock */}
      <View style={[styles.bottomBar, { bottom: Math.max(insets.bottom, 16) }]}>
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
                    size={14}
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
                      width: b.size * 1.5,
                      height: b.size * 1.5,
                      borderRadius: (b.size * 1.5) / 2,
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
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  drawingArea: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 110,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  titleBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  undoBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  clearBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#6366F1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 110,
  },
  paletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
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
  selectedColorCircle: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.2)',
    paddingLeft: 10,
  },
  sizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  selectedSizeBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.5)',
  },
  sizeDot: {},
  sizeLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
});
