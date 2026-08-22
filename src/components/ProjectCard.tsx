import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StopMotionProject } from '../types/project';
import { useTheme } from '../theme/ThemeContext';
import { GlassSurface, GlassButton } from './ui';

interface ProjectCardProps {
  project: StopMotionProject;
  onPress: (project: StopMotionProject) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (project: StopMotionProject) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onLongPress?: (project: StopMotionProject) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onPress,
  onDelete,
  onDuplicate,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onLongPress,
}) => {
  const { theme } = useTheme();
  const isPortrait = project.orientation === 'portrait';

  const handleCardPress = () => {
    if (isSelectionMode && onToggleSelect) {
      onToggleSelect(project.id);
    } else {
      onPress(project);
    }
  };

  return (
    <Pressable
      unstable_pressDelay={0}
      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
      onPress={handleCardPress}
      onLongPress={() => {
        if (onLongPress) onLongPress(project);
        else if (onToggleSelect) onToggleSelect(project.id);
      }}
      style={({ pressed }) => [
        { flex: 1, marginBottom: 16 },
        { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <GlassSurface
        variant="default"
        borderRadius={18}
        style={[
          styles.card,
          isSelected && { borderColor: theme.primary, borderWidth: 2 },
        ]}
      >
        {/* Thumbnail / Visual Viewport */}
        <View
          style={[
            styles.thumbnailContainer,
            { backgroundColor: theme.surfaceElevated },
          ]}
        >
          {project.thumbnailUri ? (
            <Image
              source={{ uri: project.thumbnailUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              fadeDuration={0}
            />
          ) : (
            <View style={styles.filmOverlay}>
              <Ionicons
                name={isPortrait ? 'phone-portrait-outline' : 'videocam-outline'}
                size={36}
                color={theme.primaryLight}
              />
            </View>
          )}

          {/* Multi-Select Checkbox Badge */}
          {isSelectionMode && (
            <Pressable
              unstable_pressDelay={0}
              pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => [
                styles.checkboxBadge,
                {
                  backgroundColor: isSelected
                    ? theme.primary
                    : 'rgba(0, 0, 0, 0.65)',
                  borderColor: isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)',
                  opacity: pressed ? 0.75 : 1,
                  transform: [{ scale: pressed ? 0.9 : 1 }],
                },
              ]}
              onPress={() => onToggleSelect && onToggleSelect(project.id)}
            >
              {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
            </Pressable>
          )}

          {/* Top Badges */}
          <View style={[styles.topBadgeRow, isSelectionMode && { left: 44 }]}>
            {/* Orientation & Ratio Badge */}
            <View style={[styles.badge, { backgroundColor: 'rgba(0, 0, 0, 0.65)' }]}>
              <Ionicons
                name={isPortrait ? 'phone-portrait' : 'phone-landscape'}
                size={11}
                color="#FFFFFF"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.badgeText}>
                {isPortrait ? 'Vertical' : 'Horizontal'} • {project.aspectRatio}
              </Text>
            </View>

            {/* FPS Badge */}
            <View style={[styles.badge, { backgroundColor: 'rgba(99, 102, 241, 0.85)' }]}>
              <Text style={styles.badgeText}>{project.fps} FPS</Text>
            </View>
          </View>

          {/* Bottom Time Stamp on Thumbnail */}
          <View style={styles.durationBadge}>
            <Ionicons name="images-outline" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.durationText}>
              {project.frameCount} frames • {project.durationSeconds.toFixed(1)}s
            </Text>
          </View>
        </View>

        {/* Info Content */}
        <View style={styles.detailsContainer}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {project.title}
            </Text>
            {!isSelectionMode && (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {onDuplicate && (
                  <GlassButton
                    size="icon"
                    icon="copy-outline"
                    iconSize={14}
                    style={{ width: 32, height: 32, borderRadius: 10 }}
                    onPress={() => onDuplicate(project)}
                  />
                )}
                <GlassButton
                  size="icon"
                  color="danger"
                  icon="trash-outline"
                  iconSize={15}
                  style={{ width: 32, height: 32, borderRadius: 10 }}
                  onPress={() => onDelete(project.id)}
                />
              </View>
            )}
          </View>

          <View style={styles.footerRow}>
            <Text style={[styles.dateText, { color: theme.textMuted }]}>
              Modified {project.lastModified}
            </Text>
            <View style={[styles.ratioBadge, { backgroundColor: theme.surfaceSubtle }]}>
              <Text style={[styles.ratioText, { color: theme.textSubtle }]}>
                {project.orientation.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      </GlassSurface>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  selectedCardBorder: {
    borderWidth: 2.5,
  },
  thumbnailContainer: {
    height: 160,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filmOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.8,
  },
  checkboxBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  topBadgeRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  detailsContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    flex: 1,
    marginRight: 8,
  },
  deleteButton: {
    padding: 4,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  dateText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  ratioBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratioText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
