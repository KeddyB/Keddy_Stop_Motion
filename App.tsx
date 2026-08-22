import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { SettingsProvider, useAppSettings } from './src/context/SettingsContext';
import { ProjectsProvider, useProjects } from './src/context/ProjectsContext';
import { CustomAlertProvider, useCustomAlert } from './src/context/CustomAlertContext';
import { SplashScreen } from './src/components/SplashScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { CameraStudioScreen } from './src/screens/CameraStudioScreen';
import { TutorialOverlay } from './src/components/TutorialOverlay';
import { LiquidGlassTabBar, TabKey } from './src/components/LiquidGlassTabBar';
import { NewProjectModal } from './src/components/NewProjectModal';
import { ImportLoadingModal } from './src/components/ImportLoadingModal';
import { PermissionPromptModal } from './src/components/PermissionPromptModal';
import { GlassSurface } from './src/components/ui';
import { permissionService } from './src/services/permissionService';
import { storageService } from './src/services/storageService';
import { shareIntentService } from './src/services/shareIntentService';
import { photoTimestampHelper } from './src/utils/photoTimestampHelper';
import { StopMotionProject, Frame } from './src/types/project';
import { AspectRatioOption, OrientationMode } from './src/types/settings';

const MainApp: React.FC = () => {
  const { isDark, theme } = useTheme();
  const { projects, createProject, refreshProjects, updateProject } = useProjects();
  const { settings } = useAppSettings();
  const { showAlert } = useCustomAlert();
  const [showSplash, setShowSplash] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [pendingStudioProject, setPendingStudioProject] = useState<StopMotionProject | null>(null);
  const [activeStudioProject, setActiveStudioProject] = useState<StopMotionProject | null>(null);
  const [pendingSharedImages, setPendingSharedImages] = useState<string[]>([]);
  const [incomingStudioDropUris, setIncomingStudioDropUris] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [newProjectModalVisible, setNewProjectModalVisible] = useState(false);
  const [isHomeSelectionMode, setIsHomeSelectionMode] = useState(false);

  // Import Loading State for shared photos
  const [importLoadingState, setImportLoadingState] = useState<{
    visible: boolean;
    current: number;
    total: number;
    stageMessage?: string;
  }>({
    visible: false,
    current: 0,
    total: 0,
  });

  // 1. Check first launch on startup
  useEffect(() => {
    const checkFirstLaunch = async () => {
      const isFirst = await storageService.isFirstLaunch();
      if (isFirst) {
        const { camera } = await permissionService.checkPermissions();
        if (!camera) {
          setShowPermissionModal(true);
        } else {
          setShowTutorial(true);
        }
      }
    };
    checkFirstLaunch();
  }, []);

  // 2. Listen for incoming shared images from Native Photos app or external apps
  useEffect(() => {
    let isMounted = true;

    // Check initial shared media on cold launch
    shareIntentService.getInitialSharedMedia().then((items) => {
      if (isMounted && items.length > 0) {
        const uris = items.map((i) => i.uri);
        if (activeStudioProject) {
          setIncomingStudioDropUris(uris);
        } else {
          setPendingSharedImages(uris);
          setNewProjectModalVisible(true);
          setActiveTab('home');
          setActiveStudioProject(null);
        }
      }
    });

    // Listen for shared media while app is running
    const unsubscribe = shareIntentService.addSharedMediaListener((items) => {
      if (isMounted && items.length > 0) {
        const uris = items.map((i) => i.uri);
        if (activeStudioProject) {
          // If project is currently open in studio, append directly to active project
          setIncomingStudioDropUris(uris);
        } else {
          // If on home/settings, open new project modal
          setPendingSharedImages(uris);
          setNewProjectModalVisible(true);
          setActiveTab('home');
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [activeStudioProject]);

  // 3. Desktop / Web / Tablet Drag and Drop Event Listeners
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
        setIsDragOver(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        setIsDragOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      setIsDragOver(false);

      if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (
          file.type.startsWith('image/') ||
          /\.(jpe?g|png|webp|bmp|gif|heic|heif)$/i.test(file.name)
        ) {
          imageFiles.push(file);
        }
      }

      if (imageFiles.length === 0) return;

      const uris = imageFiles.map((file) => URL.createObjectURL(file));

      if (activeStudioProject) {
        // Appends photos directly to the active studio project
        setIncomingStudioDropUris(uris);
      } else {
        // Opens new project modal with dropped photos preloaded
        setPendingSharedImages(uris);
        setNewProjectModalVisible(true);
        setActiveTab('home');
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [activeStudioProject]);

  // Request & Proceed Handler
  const handleGrantPermissions = async () => {
    await permissionService.requestAllPermissions();
    setShowPermissionModal(false);
    setShowTutorial(true);
  };

  const handleSkipPermissions = async () => {
    setShowPermissionModal(false);
    setShowTutorial(true);
  };

  const handleTutorialComplete = async () => {
    setShowTutorial(false);
    await storageService.setFirstLaunchComplete();
    if (pendingStudioProject) {
      setActiveStudioProject(pendingStudioProject);
      setPendingStudioProject(null);
    }
  };

  // Safe Studio Entry: Directly opens studio without blocking prompts
  const handleOpenStudio = (project: StopMotionProject) => {
    setActiveStudioProject(project);
  };

  // Create Project Flow
  const handleCreateNewProject = async (data: {
    title: string;
    orientation: OrientationMode;
    aspectRatio: AspectRatioOption;
    fps: number;
    sharedImageUris?: string[];
  }) => {
    try {
      const created = await createProject(data);

      if (data.sharedImageUris && data.sharedImageUris.length > 0) {
        const totalShared = data.sharedImageUris.length;
        setImportLoadingState({
          visible: true,
          current: 0,
          total: totalShared,
          stageMessage: 'Analyzing photo snap timestamps...',
        });

        // 1. Resolve exact camera snap times for each shared photo concurrently in batches
        const CONCURRENCY_LIMIT = 4;
        const assetsWithTime: Array<{ uri: string; snapTime: number }> = [];

        for (let i = 0; i < totalShared; i += CONCURRENCY_LIMIT) {
          const chunk = data.sharedImageUris.slice(i, i + CONCURRENCY_LIMIT);
          const chunkResults = await Promise.all(
            chunk.map(async (uri) => ({
              uri,
              snapTime: await photoTimestampHelper.getExactCaptureTime({ uri }),
            }))
          );
          assetsWithTime.push(...chunkResults);
        }

        // 2. Sort strictly chronologically by creation/snap time
        assetsWithTime.sort((a, b) => a.snapTime - b.snapTime);

        const framesDir = storageService.getProjectFramesDirectory(created.id);
        if (FileSystem.documentDirectory) {
          try {
            await FileSystem.makeDirectoryAsync(framesDir, { intermediates: true });
          } catch {}
        }

        const importedFrames: Frame[] = new Array(assetsWithTime.length);
        let completedCount = 0;

        // 3. Process frame copy and proxy generation sequentially for maximum stability & zero coroutine cancellation
        for (let index = 0; index < assetsWithTime.length; index++) {
          const { uri, snapTime } = assetsWithTime[index];
          const frameId = `shared_${snapTime}_${index}`;
          const targetPath = `${framesDir}${frameId}.jpg`;
          const proxyPath = `${framesDir}${frameId}_proxy.jpg`;

          let savedUri = targetPath;
          let finalProxyUri = targetPath;

          try {
            if (FileSystem.documentDirectory) {
              await FileSystem.copyAsync({
                from: uri,
                to: targetPath,
              });
              savedUri = targetPath;
            } else {
              savedUri = uri;
            }

            finalProxyUri = savedUri;

            // Generate Proxy if needed
            if (settings.proxyQuality !== 'original' && FileSystem.documentDirectory) {
              try {
                const isLandscape = data.orientation === 'landscape';
                const maxDimension = settings.proxyQuality === 'high' ? 1440 : settings.proxyQuality === 'medium' ? 1080 : 720;
                const manipContext = ImageManipulator.manipulate(savedUri);
                if (isLandscape) {
                  manipContext.resize({ width: maxDimension });
                } else {
                  manipContext.resize({ height: maxDimension });
                }
                const imageRef = await manipContext.renderAsync();
                const proxyResult = await imageRef.saveAsync({ compress: 0.88, format: SaveFormat.JPEG });

                await FileSystem.copyAsync({
                  from: proxyResult.uri,
                  to: proxyPath,
                });
                finalProxyUri = proxyPath;
              } catch (pErr) {
                console.warn('Proxy generation notice for shared photo:', pErr);
                finalProxyUri = savedUri;
              }
            }
          } catch (copyErr) {
            console.error('Fatal copy error for shared frame:', copyErr);
            savedUri = uri;
            finalProxyUri = uri;
          }

          importedFrames[index] = {
            id: frameId,
            uri: savedUri,
            proxyUri: finalProxyUri,
            timestamp: snapTime,
          };

          completedCount++;
          setImportLoadingState((prev) => ({
            ...prev,
            current: completedCount,
            stageMessage: `Preparing frame ${completedCount} of ${totalShared}...`,
          }));
        }

        const durationSeconds = Number((importedFrames.length / data.fps).toFixed(1));
        const updatedProject: StopMotionProject = {
          ...created,
          frameCount: importedFrames.length,
          durationSeconds,
          thumbnailUri: importedFrames[0]?.uri,
          frames: importedFrames,
        };

        await storageService.saveProject(updatedProject);
        setImportLoadingState({ visible: false, current: 0, total: 0 });
        setPendingSharedImages([]);
        handleOpenStudio(updatedProject);
      } else {
        handleOpenStudio(created);
      }
    } catch (e) {
      setImportLoadingState({ visible: false, current: 0, total: 0 });
      showAlert({
        title: 'Storage Error',
        message: 'Failed to save new project to device storage.',
        destructive: true,
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar
        style={activeStudioProject ? 'light' : isDark ? 'light' : 'dark'}
        hidden={activeStudioProject !== null}
      />

      {/* Main Studio Camera vs App Tabs */}
      {activeStudioProject ? (
        <CameraStudioScreen
          project={activeStudioProject}
          incomingDroppedUris={incomingStudioDropUris}
          onClearIncomingDroppedUris={() => setIncomingStudioDropUris([])}
          onClose={() => {
            refreshProjects();
            setActiveStudioProject(null);
            setIncomingStudioDropUris([]);
          }}
          onUpdateProject={(updated) => {
            setActiveStudioProject(updated);
            updateProject(updated);
          }}
        />
      ) : (
        <>
          {/* Pre-mounted Hot Screen Views (Instant 0ms switching) */}
          <View style={styles.screenContainer}>
            <View
              style={[
                styles.tabScreen,
                activeTab !== 'home' && styles.hiddenScreen,
              ]}
            >
              <HomeScreen
                onReplaySplash={() => setShowSplash(true)}
                onOpenSettings={() => setActiveTab('settings')}
                onOpenStudio={handleOpenStudio}
                onOpenNewProject={() => setNewProjectModalVisible(true)}
                pendingSharedImages={pendingSharedImages}
                onClearPendingSharedImages={() => setPendingSharedImages([])}
                onSelectionModeChange={setIsHomeSelectionMode}
              />
            </View>

            <View
              style={[
                styles.tabScreen,
                activeTab !== 'settings' && styles.hiddenScreen,
              ]}
            >
              <SettingsScreen onReplaySplash={() => setShowSplash(true)} />
            </View>
          </View>

          {/* Floating Liquid Glass Tab Bar with Circular Plus Button */}
          {!showSplash && !isHomeSelectionMode && !showTutorial && (
            <LiquidGlassTabBar
              activeTab={activeTab}
              onSelectTab={(tab) => setActiveTab(tab)}
              onPressNewAnimation={() => setNewProjectModalVisible(true)}
            />
          )}
        </>
      )}

      {/* Cursive Splash Screen */}
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      )}

      {/* Permissions Modal when starting a project */}
      {!showSplash && (
        <PermissionPromptModal
          visible={showPermissionModal}
          onGrant={handleGrantPermissions}
          onSkip={handleSkipPermissions}
        />
      )}

      {/* First Time Tutorial */}
      {!showSplash && !showPermissionModal && showTutorial && (
        <TutorialOverlay onComplete={handleTutorialComplete} />
      )}

      {/* New Project Modal triggered by Floating Plus or Screen Button */}
      <NewProjectModal
        visible={newProjectModalVisible}
        onClose={() => {
          setNewProjectModalVisible(false);
          setPendingSharedImages([]);
        }}
        onCreate={handleCreateNewProject}
        nextIndex={projects.length + 1}
        sharedImageUris={pendingSharedImages}
      />

      {/* Shared Photos Import Progress Modal */}
      <ImportLoadingModal
        visible={importLoadingState.visible}
        current={importLoadingState.current}
        total={importLoadingState.total}
        stageMessage={importLoadingState.stageMessage}
      />

      {/* Full-Screen Drag and Drop Visual Feedback Overlay */}
      {isDragOver && (
        <View style={styles.dragOverOverlay} pointerEvents="none">
          <GlassSurface
            variant="elevated"
            borderRadius={28}
            contentStyle={styles.dragOverContent}
          >
            <View style={[styles.dragOverIconBg, { backgroundColor: theme.primary }]}>
              <Ionicons name="images" size={44} color="#FFFFFF" />
            </View>
            <Text style={[styles.dragOverTitle, { color: theme.text }]}>
              {activeStudioProject
                ? 'Drop Photos to Add Frames'
                : 'Drop Photos to Start Animation'}
            </Text>
            <Text style={[styles.dragOverSubtitle, { color: theme.textMuted }]}>
              {activeStudioProject
                ? `Adding directly to "${activeStudioProject.title}"`
                : 'Instantly start a new stop motion project'}
            </Text>
          </GlassSurface>
        </View>
      )}
    </View>
  );
};

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <SettingsProvider>
          <ProjectsProvider>
            <CustomAlertProvider>
              <MainApp />
            </CustomAlertProvider>
          </ProjectsProvider>
        </SettingsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
    position: 'relative',
  },
  tabScreen: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  hiddenScreen: {
    display: 'none',
  },
  dragOverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 9999,
  },
  dragOverContent: {
    paddingVertical: 36,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 320,
    maxWidth: 460,
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.6)',
    borderStyle: 'dashed',
    borderRadius: 28,
  },
  dragOverIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  dragOverTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  dragOverSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
  },
});
