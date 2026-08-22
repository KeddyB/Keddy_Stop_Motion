import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useTheme } from '../theme/ThemeContext';
import { useAppInsets } from '../utils/useAppInsets';
import { GlassSurface, GlassButton } from './ui';

export interface MediaGalleryPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (selectedAssets: MediaLibrary.Asset[]) => void;
}

export const MediaGalleryPickerModal: React.FC<MediaGalleryPickerModalProps> = ({
  visible,
  onClose,
  onImport,
}) => {
  const { theme, isDark } = useTheme();
  const insets = useAppInsets();
  const { width, height } = useWindowDimensions();

  // Media Library state
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [albums, setAlbums] = useState<MediaLibrary.Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [selectedAssetsMap, setSelectedAssetsMap] = useState<Map<string, { asset: MediaLibrary.Asset; order: number }>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasNextPage, setHasNextPage] = useState<boolean>(true);
  const [endCursor, setEndCursor] = useState<string | undefined>(undefined);
  const [sortAscending, setSortAscending] = useState<boolean>(false); // default: newest first for browsing
  const [showAlbumDropdown, setShowAlbumDropdown] = useState<boolean>(false);

  // Responsive grid column count
  const numColumns = useMemo(() => {
    if (width >= 1024) return 6;
    if (width >= 768) return 5;
    if (width >= 480) return 4;
    return 3;
  }, [width]);

  const itemSize = useMemo(() => {
    const totalSpacing = (numColumns + 1) * 2;
    return (width - totalSpacing) / numColumns;
  }, [width, numColumns]);

  // Request & verify permissions on modal show
  useEffect(() => {
    if (!visible) return;

    const checkPermissionAndLoad = async () => {
      try {
        const { status } = await MediaLibrary.getPermissionsAsync();
        if (status === 'granted') {
          setHasPermission(true);
          loadAlbums();
          loadInitialAssets(selectedAlbumId, sortAscending);
        } else {
          const req = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
          if (req.status === 'granted') {
            setHasPermission(true);
            loadAlbums();
            loadInitialAssets(selectedAlbumId, sortAscending);
          } else {
            setHasPermission(false);
          }
        }
      } catch (err) {
        console.warn('Error checking media library permissions:', err);
        setHasPermission(false);
      }
    };

    checkPermissionAndLoad();
  }, [visible]);

  // Reset selection when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedAssetsMap(new Map());
      setShowAlbumDropdown(false);
    }
  }, [visible]);

  // Load device albums
  const loadAlbums = async () => {
    try {
      const deviceAlbums = await MediaLibrary.getAlbumsAsync({
        includeSmartAlbums: true,
      });
      // Filter albums with non-zero assetCount
      const validAlbums = deviceAlbums.filter((a) => a.assetCount > 0);
      setAlbums(validAlbums);
    } catch (e) {
      console.warn('Failed to load albums:', e);
    }
  };

  // Load initial page of assets
  const loadInitialAssets = async (albumId: string | null, ascending: boolean) => {
    setIsLoading(true);
    try {
      const options: MediaLibrary.AssetsOptions = {
        first: 60,
        mediaType: [MediaLibrary.MediaType.photo],
        sortBy: [[MediaLibrary.SortBy.creationTime, ascending]],
      };

      if (albumId) {
        options.album = albumId;
      }

      const result = await MediaLibrary.getAssetsAsync(options);
      setAssets(result.assets);
      setHasNextPage(result.hasNextPage);
      setEndCursor(result.endCursor);
    } catch (e) {
      console.warn('Failed to load initial assets:', e);
      Alert.alert('Gallery Error', 'Could not load images from device gallery.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load more assets on scroll
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasNextPage || !endCursor) return;
    setIsLoadingMore(true);
    try {
      const options: MediaLibrary.AssetsOptions = {
        first: 60,
        after: endCursor,
        mediaType: [MediaLibrary.MediaType.photo],
        sortBy: [[MediaLibrary.SortBy.creationTime, sortAscending]],
      };

      if (selectedAlbumId) {
        options.album = selectedAlbumId;
      }

      const result = await MediaLibrary.getAssetsAsync(options);
      setAssets((prev) => [...prev, ...result.assets]);
      setHasNextPage(result.hasNextPage);
      setEndCursor(result.endCursor);
    } catch (e) {
      console.warn('Failed to load more assets:', e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Switch album
  const handleSelectAlbum = (albumId: string | null) => {
    setSelectedAlbumId(albumId);
    setShowAlbumDropdown(false);
    loadInitialAssets(albumId, sortAscending);
  };

  // Toggle sorting order
  const handleToggleSort = () => {
    const newSort = !sortAscending;
    setSortAscending(newSort);
    loadInitialAssets(selectedAlbumId, newSort);
  };

  // Toggle item selection
  const handleToggleSelect = (asset: MediaLibrary.Asset) => {
    setSelectedAssetsMap((prev) => {
      const next = new Map(prev);
      if (next.has(asset.id)) {
        next.delete(asset.id);
        // Re-index orders
        let idx = 1;
        const reindexed = new Map();
        for (const [key, val] of next.entries()) {
          reindexed.set(key, { asset: val.asset, order: idx++ });
        }
        return reindexed;
      } else {
        next.set(asset.id, { asset, order: next.size + 1 });
        return next;
      }
    });
  };

  // Select all currently loaded assets
  const handleSelectAll = () => {
    setSelectedAssetsMap((prev) => {
      if (prev.size === assets.length) {
        // If all are selected, deselect all
        return new Map();
      }
      const next = new Map();
      assets.forEach((asset, idx) => {
        next.set(asset.id, { asset, order: idx + 1 });
      });
      return next;
    });
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedAssetsMap(new Map());
  };

  // Handle final import
  const handleConfirmImport = () => {
    const selectedList = Array.from(selectedAssetsMap.values())
      .sort((a, b) => a.order - b.order)
      .map((item) => item.asset);

    if (selectedList.length === 0) return;
    onImport(selectedList);
    onClose();
  };

  const selectedCount = selectedAssetsMap.size;
  const currentAlbumTitle = useMemo(() => {
    if (!selectedAlbumId) return 'All Photos';
    const album = albums.find((a) => a.id === selectedAlbumId);
    return album ? album.title : 'Album';
  }, [selectedAlbumId, albums]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Top Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <View style={styles.headerLeft}>
            <GlassButton
              size="icon"
              icon="close"
              iconSize={20}
              onPress={onClose}
              style={{ width: 38, height: 38 }}
            />
            {/* Album Selector Button */}
            <Pressable
              onPress={() => setShowAlbumDropdown(!showAlbumDropdown)}
              style={({ pressed }) => [
                styles.albumPickerButton,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.borderSubtle,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={[styles.albumTitleText, { color: theme.text }]} numberOfLines={1}>
                {currentAlbumTitle}
              </Text>
              <Ionicons
                name={showAlbumDropdown ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.textSubtle}
                style={{ marginLeft: 4 }}
              />
            </Pressable>
          </View>

          {/* Header Actions: Sort Toggle & Select All */}
          <View style={styles.headerRight}>
            <GlassButton
              size="icon"
              icon={sortAscending ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
              iconSize={20}
              onPress={handleToggleSort}
              style={{ width: 38, height: 38 }}
            />

            {assets.length > 0 && (
              <GlassButton
                size="sm"
                label={selectedCount === assets.length ? 'Deselect All' : 'Select All'}
                onPress={handleSelectAll}
              />
            )}
          </View>
        </View>

        {/* Album Dropdown Overlay */}
        {showAlbumDropdown && (
          <View
            style={[
              styles.albumDropdownContainer,
              {
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                top: Math.max(insets.top, 12) + 54,
              },
            ]}
          >
            <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={true}>
              <Pressable
                onPress={() => handleSelectAlbum(null)}
                style={[
                  styles.albumOptionItem,
                  !selectedAlbumId && { backgroundColor: theme.surfaceSubtle },
                ]}
              >
                <Text
                  style={[
                    styles.albumOptionText,
                    { color: !selectedAlbumId ? theme.primary : theme.text },
                    !selectedAlbumId && { fontWeight: '700' },
                  ]}
                >
                  All Photos
                </Text>
              </Pressable>

              {albums.map((album) => {
                const isSelected = selectedAlbumId === album.id;
                return (
                  <Pressable
                    key={album.id}
                    onPress={() => handleSelectAlbum(album.id)}
                    style={[
                      styles.albumOptionItem,
                      isSelected && { backgroundColor: theme.surfaceSubtle },
                    ]}
                  >
                    <Text
                      style={[
                        styles.albumOptionText,
                        { color: isSelected ? theme.primary : theme.text },
                        isSelected && { fontWeight: '700' },
                      ]}
                      numberOfLines={1}
                    >
                      {album.title} ({album.assetCount})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Permission Denied View */}
        {hasPermission === false && (
          <View style={styles.permissionContainer}>
            <Ionicons name="images-outline" size={54} color={theme.textSubtle} />
            <Text style={[styles.permissionTitle, { color: theme.text }]}>
              Gallery Access Required
            </Text>
            <Text style={[styles.permissionSubtitle, { color: theme.textMuted }]}>
              Keddy Stop Motion needs permission to view and import photos from your device gallery.
            </Text>
            <GlassButton
              size="md"
              color="primary"
              label="Grant Gallery Access"
              onPress={async () => {
                const req = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
                if (req.status === 'granted') {
                  setHasPermission(true);
                  loadAlbums();
                  loadInitialAssets(selectedAlbumId, sortAscending);
                }
              }}
              style={{ marginTop: 20 }}
            />
          </View>
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textMuted }]}>
              Loading gallery photos...
            </Text>
          </View>
        )}

        {/* Asset Photo Grid */}
        {!isLoading && hasPermission && (
          <FlatList
            key={numColumns}
            data={assets}
            numColumns={numColumns}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.gridContent,
              { paddingBottom: insets.bottom + 90 },
            ]}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              <View style={styles.emptyGridContainer}>
                <Ionicons name="image-outline" size={48} color={theme.textSubtle} />
                <Text style={[styles.emptyGridText, { color: theme.textMuted }]}>
                  No photos found in this album.
                </Text>
              </View>
            }
            ListFooterComponent={
              isLoadingMore ? (
                <View style={styles.footerLoading}>
                  <ActivityIndicator size="small" color={theme.primary} />
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const selectedInfo = selectedAssetsMap.get(item.id);
              const isSelected = !!selectedInfo;

              return (
                <Pressable
                  unstable_pressDelay={0}
                  onPress={() => handleToggleSelect(item)}
                  style={[
                    styles.thumbnailItem,
                    {
                      width: itemSize,
                      height: itemSize,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: item.uri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />

                  {/* Selection Overlay & Badge */}
                  {isSelected && (
                    <View style={styles.selectedOverlay}>
                      <View style={[styles.orderBadge, { backgroundColor: theme.primary }]}>
                        <Text style={styles.orderBadgeText}>{selectedInfo.order}</Text>
                      </View>
                    </View>
                  )}

                  {!isSelected && (
                    <View style={styles.unselectedBadgeOutline}>
                      <View style={styles.unselectedInnerCircle} />
                    </View>
                  )}
                </Pressable>
              );
            }}
          />
        )}

        {/* Floating Bottom Action Bar */}
        {selectedCount > 0 && (
          <View
            style={[
              styles.floatingBottomBar,
              { bottom: insets.bottom + 16 },
            ]}
          >
            <GlassSurface
              variant="elevated"
              borderRadius={22}
              contentStyle={styles.bottomBarContent}
            >
              <View style={styles.bottomBarLeft}>
                <Text style={[styles.selectedCountTitle, { color: theme.text }]}>
                  {selectedCount} {selectedCount === 1 ? 'photo' : 'photos'} selected
                </Text>
                <Text style={[styles.unlimitedNotice, { color: theme.textMuted }]}>
                  No limits • Sorted by snap time
                </Text>
              </View>

              <View style={styles.bottomBarRight}>
                <GlassButton
                  size="sm"
                  label="Clear"
                  onPress={handleClearSelection}
                />
                <GlassButton
                  size="md"
                  color="primary"
                  icon="arrow-forward"
                  label={`Import (${selectedCount})`}
                  onPress={handleConfirmImport}
                />
              </View>
            </GlassSurface>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 50,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  albumPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: 200,
  },
  albumTitleText: {
    fontSize: 15,
    fontWeight: '700',
    maxWidth: 140,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  albumDropdownContainer: {
    position: 'absolute',
    left: 16,
    width: 240,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 100,
    overflow: 'hidden',
  },
  albumOptionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  albumOptionText: {
    fontSize: 14,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  permissionTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  gridContent: {
    padding: 1,
  },
  thumbnailItem: {
    margin: 1,
    position: 'relative',
    backgroundColor: '#1E293B',
    overflow: 'hidden',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 2.5,
    borderColor: '#6366F1',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    padding: 6,
  },
  orderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  orderBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  unselectedBadgeOutline: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unselectedInnerCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  emptyGridContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyGridText: {
    fontSize: 14,
    marginTop: 12,
  },
  footerLoading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  floatingBottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    maxWidth: 640,
    alignSelf: 'center',
    zIndex: 80,
  },
  bottomBarContent: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomBarLeft: {
    flex: 1,
  },
  selectedCountTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  unlimitedNotice: {
    fontSize: 11.5,
    marginTop: 2,
  },
  bottomBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
