import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAppInsets } from '../utils/useAppInsets';
import { useProjects } from '../context/ProjectsContext';
import { storageService } from '../services/storageService';
import { Header } from '../components/Header';
import { ProjectCard } from '../components/ProjectCard';
import { BatchExportModal } from '../components/BatchExportModal';
import { GlassSurface, GlassButton } from '../components/ui';
import { videoExportService, RenderProgressUpdate } from '../services/videoExportService';
import { StopMotionProject } from '../types/project';
import { ExportConfig } from '../types/export';

interface HomeScreenProps {
  onReplaySplash: () => void;
  onOpenSettings: () => void;
  onOpenStudio: (project: StopMotionProject) => void;
  onOpenNewProject: () => void;
  pendingSharedImages?: string[];
  onClearPendingSharedImages?: () => void;
  onSelectionModeChange?: (isActive: boolean) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onReplaySplash,
  onOpenSettings,
  onOpenStudio,
  onOpenNewProject,
  pendingSharedImages,
  onClearPendingSharedImages,
  onSelectionModeChange,
}) => {
  const { theme } = useTheme();
  const insets = useAppInsets();
  const { projects, deleteProject, duplicateProject } = useProjects();

  // Multi-Select State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Notify parent when selection mode changes
  useEffect(() => {
    onSelectionModeChange?.(isSelectionMode);
  }, [isSelectionMode]);

  // Batch Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<RenderProgressUpdate | null>(null);
  const [isExportComplete, setIsExportComplete] = useState(false);
  const [exportSuccessCount, setExportSuccessCount] = useState(0);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === projects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(projects.map((p) => p.id));
    }
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds([]);
  };

  const handleDeleteProject = (id: string) => {
    Alert.alert(
      'Delete Project',
      'Are you sure you want to permanently delete this project and all its recorded frames from your device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProject(id);
            } catch (e) {
              Alert.alert('Error', 'Failed to remove project from device.');
            }
          },
        },
      ]
    );
  };

  // Batch Delete Selected Projects
  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    Alert.alert(
      'Delete Selected Projects',
      `Are you sure you want to delete ${selectedIds.length} project(s)? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const id of selectedIds) {
                await deleteProject(id);
              }
              exitSelectionMode();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete selected projects.');
            }
          },
        },
      ]
    );
  };

  const handleOpenExportModal = () => {
    setShowExportModal(true);
    setIsExportComplete(false);
    setExportProgress(null);
  };

  const handleExecuteBatchExport = async (config: ExportConfig) => {
    const selectedProjects = projects.filter((p) => selectedIds.includes(p.id));
    if (selectedProjects.length === 0) return;

    setIsExporting(true);
    setIsExportComplete(false);
    setExportProgress(null);

    try {
      const { successCount, errors } = await videoExportService.renderProjectsBatch(
        selectedProjects,
        (progress) => setExportProgress(progress),
        config
      );

      setExportSuccessCount(successCount);
      setIsExportComplete(true);
      setIsExporting(false);

      if (errors.length > 0 && successCount === 0) {
        Alert.alert('Export Notice', errors.join('\n'));
      }
    } catch (err: any) {
      setIsExporting(false);
      setShowExportModal(false);
      Alert.alert('Export Failed', err.message || 'Could not export animations.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <Header
        onOpenSettings={onOpenSettings}
        onReplaySplash={onReplaySplash}
      />

      <View style={styles.content}>
        {/* Projects List with Integrated Header */}
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: insets.bottom + (isSelectionMode ? 140 : 110) },
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.listHeaderWrapper}>
              {/* New Project CTA Button (Only in Normal Mode) */}
              {!isSelectionMode && (
                <Pressable
                  unstable_pressDelay={0}
                  pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  onPress={onOpenNewProject}
                  style={({ pressed }) => [
                    styles.newProjectPressable,
                    { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                  ]}
                >
                  <GlassSurface
                    variant="elevated"
                    borderRadius={18}
                    contentStyle={styles.newProjectCard}
                  >
                    <View style={[styles.newProjectIconBg, { backgroundColor: theme.primary }]}>
                      <Ionicons name="videocam" size={24} color="#FFFFFF" />
                    </View>
                    <View style={styles.newProjectTextContainer}>
                      <Text style={[styles.newProjectTitle, { color: theme.text }]}>
                        New Animation
                      </Text>
                      <Text style={[styles.newProjectSubtitle, { color: theme.textMuted }]}>
                        Choose portrait or landscape & start shooting
                      </Text>
                    </View>
                    <View style={[styles.plusBadge, { backgroundColor: theme.surfaceSubtle }]}>
                      <Ionicons name="add" size={20} color={theme.primaryLight} />
                    </View>
                  </GlassSurface>
                </Pressable>
              )}

              {/* Section Header & Batch Select Controls */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionLeft}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    {isSelectionMode
                      ? `${selectedIds.length} Selected`
                      : 'My Projects'}
                  </Text>
                  {!isSelectionMode && (
                    <View style={[styles.countBadge, { backgroundColor: theme.surfaceSubtle }]}>
                      <Text style={[styles.countBadgeText, { color: theme.textSubtle }]}>
                        {projects.length}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Select Mode Toggle */}
                {projects.length > 0 && (
                  <View style={styles.selectActionsRow}>
                    {isSelectionMode ? (
                      <>
                        <GlassButton
                          size="sm"
                          label={selectedIds.length === projects.length ? 'Deselect All' : 'Select All'}
                          onPress={handleSelectAll}
                        />

                        <GlassButton
                          size="sm"
                          label="Cancel"
                          onPress={exitSelectionMode}
                        />
                      </>
                    ) : (
                      <GlassButton
                        size="sm"
                        icon="checkmark-circle-outline"
                        label="Select"
                        onPress={() => setIsSelectionMode(true)}
                      />
                    )}
                  </View>
                )}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <ProjectCard
              project={item}
              onPress={() => onOpenStudio(item)}
              onDelete={handleDeleteProject}
              onDuplicate={duplicateProject}
              isSelectionMode={isSelectionMode}
              isSelected={selectedIds.includes(item.id)}
              onToggleSelect={handleToggleSelect}
              onLongPress={() => {
                if (!isSelectionMode) {
                  setIsSelectionMode(true);
                  setSelectedIds([item.id]);
                }
              }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconBg, { backgroundColor: theme.surfaceSubtle }]}>
                <Ionicons name="film-outline" size={44} color={theme.textSubtle} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Projects Yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                Tap "New Animation" above to begin your first stop motion film.
              </Text>
            </View>
          }
        />
      </View>

      {/* Floating Bottom Batch Action Bar */}
      {isSelectionMode && selectedIds.length > 0 && (
        <View
          style={[
            styles.batchFloatingContainer,
            { bottom: insets.bottom + 16 },
          ]}
        >
          <GlassSurface
            variant="elevated"
            borderRadius={20}
            contentStyle={styles.batchFloatingContent}
          >
            <View style={styles.batchInfo}>
              <Text style={[styles.batchCountText, { color: theme.text }]}>
                {selectedIds.length} {selectedIds.length === 1 ? 'Project' : 'Projects'}
              </Text>
            </View>

            <View style={styles.batchButtonsRow}>
              {/* Delete Selected Button */}
              <GlassButton
                size="icon"
                color="danger"
                icon="trash-outline"
                iconSize={18}
                onPress={handleBatchDelete}
              />

              {/* Render & Save Selected Videos CTA */}
              <GlassButton
                size="md"
                color="primary"
                icon="videocam"
                label={`Render & Save (${selectedIds.length})`}
                onPress={handleOpenExportModal}
              />
            </View>
          </GlassSurface>
        </View>
      )}

      {/* Batch Export Progress & Configuration Modal */}
      <BatchExportModal
        visible={showExportModal}
        progress={exportProgress}
        isExporting={isExporting}
        isComplete={isExportComplete}
        totalSelected={selectedIds.length}
        successCount={exportSuccessCount}
        defaultTitle={selectedIds.length === 1 ? projects.find((p) => p.id === selectedIds[0])?.title : undefined}
        onStartExport={handleExecuteBatchExport}
        onClose={() => {
          setShowExportModal(false);
          if (isExportComplete) {
            exitSelectionMode();
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  listHeaderWrapper: {
    paddingBottom: 4,
  },
  newProjectPressable: {
    marginBottom: 20,
    marginTop: 4,
  },
  newProjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  newProjectIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  newProjectTextContainer: {
    flex: 1,
  },
  newProjectTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  newProjectSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 17,
  },
  plusBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  countBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  selectActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listContainer: {
    paddingTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIconBg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  batchFloatingContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 100,
  },
  batchFloatingContent: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  batchInfo: {
    paddingLeft: 4,
  },
  batchCountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  batchButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
