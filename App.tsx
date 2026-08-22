import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { SettingsProvider, useAppSettings } from './src/context/SettingsContext';
import { ProjectsProvider, useProjects } from './src/context/ProjectsContext';
import { SplashScreen } from './src/components/SplashScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { CameraStudioScreen } from './src/screens/CameraStudioScreen';
import { TutorialOverlay } from './src/components/TutorialOverlay';
import { LiquidGlassTabBar, TabKey } from './src/components/LiquidGlassTabBar';
import { NewProjectModal } from './src/components/NewProjectModal';
import { ImportLoadingModal } from './src/components/ImportLoadingModal';
import { PermissionPromptModal } from './src/components/PermissionPromptModal';
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
  const [showSplash, setShowSplash] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [pendingStudioProject, setPendingStudioProject] = useState<StopMotionProject | null>(null);
  const [activeStudioProject, setActiveStudioProject] = useState<StopMotionProject | null>(null);
  const [pendingSharedImages, setPendingSharedImages] = useState<string[]>([]);
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
        setPendingSharedImages(uris);
        setNewProjectModalVisible(true);
        setActiveTab('home');
        setActiveStudioProject(null);
      }
    });

    // Listen for shared media while app is running
    const unsubscribe = shareIntentService.addSharedMediaListener((items) => {
      if (isMounted && items.length > 0) {
        const uris = items.map((i) => i.uri);
        setPendingSharedImages(uris);
        setNewProjectModalVisible(true);
        setActiveTab('home');
        setActiveStudioProject(null);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

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
        const importedFrames: Frame[] = new Array(assetsWithTime.length);
        let completedCount = 0;

        // 3. Process frame copy, proxy generation with high-priority parallel worker pool
        const processSharedItem = async (index: number) => {
          const { uri, snapTime } = assetsWithTime[index];
          const frameId = `shared_${snapTime}_${index}`;
          const targetPath = `${framesDir}${frameId}.jpg`;
          const proxyPath = `${framesDir}${frameId}_proxy.jpg`;

          if (FileSystem.documentDirectory) {
            await FileSystem.copyAsync({
              from: uri,
              to: targetPath,
            });
          }

          let finalProxyUri = FileSystem.documentDirectory ? targetPath : uri;

          if (settings.proxyQuality !== 'original') {
            const proxyWidth = settings.proxyQuality === 'high' ? 1080 : settings.proxyQuality === 'medium' ? 720 : 480;
            const manipContext = ImageManipulator.manipulate(uri);
            manipContext.resize({ width: proxyWidth });
            const imageRef = await manipContext.renderAsync();
            const proxyResult = await imageRef.saveAsync({ compress: 0.5, format: SaveFormat.JPEG });
            if (FileSystem.documentDirectory) {
              await FileSystem.copyAsync({
                from: proxyResult.uri,
                to: proxyPath,
              });
              finalProxyUri = proxyPath;
            } else {
              finalProxyUri = proxyResult.uri;
            }
          }

          importedFrames[index] = {
            id: frameId,
            uri: FileSystem.documentDirectory ? targetPath : uri,
            proxyUri: finalProxyUri,
            timestamp: snapTime,
          };

          completedCount++;
          setImportLoadingState((prev) => ({
            ...prev,
            current: completedCount,
            stageMessage: `Preparing frame ${completedCount} of ${totalShared}...`,
          }));
        };

        // Run parallel worker pool
        for (let i = 0; i < assetsWithTime.length; i += CONCURRENCY_LIMIT) {
          const batch = [];
          for (let j = i; j < Math.min(i + CONCURRENCY_LIMIT, assetsWithTime.length); j++) {
            batch.push(processSharedItem(j));
          }
          await Promise.all(batch);
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
      Alert.alert('Storage Error', 'Failed to save new project to device storage.');
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
          onClose={() => {
            refreshProjects();
            setActiveStudioProject(null);
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
    </View>
  );
};

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <SettingsProvider>
          <ProjectsProvider>
            <MainApp />
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
});
