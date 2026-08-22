import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { CustomAlertModal, CustomAlertConfig } from '../components/ui/CustomAlertModal';

export interface CustomAlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
}

export interface ShowAlertOptions {
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBgColor?: string;
  buttons?: CustomAlertButton[];
  destructive?: boolean;
}

export interface ShowConfirmOptions {
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface CustomAlertContextType {
  showAlert: (options: ShowAlertOptions) => void;
  showConfirm: (options: ShowConfirmOptions) => void;
  hideAlert: () => void;
}

const CustomAlertContext = createContext<CustomAlertContextType | undefined>(undefined);

// Standalone global trigger so any service/file can trigger custom alerts
let globalShowAlert: ((options: ShowAlertOptions) => void) | null = null;
let globalShowConfirm: ((options: ShowConfirmOptions) => void) | null = null;
let globalHideAlert: (() => void) | null = null;

export const customAlert = {
  alert(title: string, message?: string, buttons?: CustomAlertButton[]) {
    if (globalShowAlert) {
      globalShowAlert({
        title,
        message,
        buttons: buttons || [{ text: 'OK', style: 'default' }],
      });
    }
  },
  confirm(options: ShowConfirmOptions) {
    if (globalShowConfirm) {
      globalShowConfirm(options);
    }
  },
  hide() {
    if (globalHideAlert) {
      globalHideAlert();
    }
  },
};

export const CustomAlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [alertConfig, setAlertConfig] = useState<CustomAlertConfig | null>(null);

  const hideAlert = useCallback(() => {
    setAlertConfig(null);
  }, []);

  const showAlert = useCallback(
    (options: ShowAlertOptions) => {
      // Deduce default icon based on title or destructive flag
      let icon = options.icon;
      let iconColor = options.iconColor;
      let iconBgColor = options.iconBgColor;

      const titleLower = options.title.toLowerCase();
      if (!icon) {
        if (options.destructive || titleLower.includes('delete') || titleLower.includes('remove')) {
          icon = 'trash-outline';
          iconColor = '#EF4444';
          iconBgColor = 'rgba(239, 68, 68, 0.15)';
        } else if (titleLower.includes('error') || titleLower.includes('failed')) {
          icon = 'alert-circle-outline';
          iconColor = '#EF4444';
          iconBgColor = 'rgba(239, 68, 68, 0.15)';
        } else if (titleLower.includes('warning') || titleLower.includes('notice')) {
          icon = 'warning-outline';
          iconColor = '#F59E0B';
          iconBgColor = 'rgba(245, 158, 11, 0.15)';
        } else if (titleLower.includes('success') || titleLower.includes('saved') || titleLower.includes('synced') || titleLower.includes('complete')) {
          icon = 'checkmark-circle-outline';
          iconColor = '#10B981';
          iconBgColor = 'rgba(16, 185, 129, 0.15)';
        } else {
          icon = 'information-circle-outline';
          iconColor = '#6366F1';
          iconBgColor = 'rgba(99, 102, 241, 0.15)';
        }
      }

      setAlertConfig({
        visible: true,
        title: options.title,
        message: options.message,
        icon,
        iconColor,
        iconBgColor,
        buttons: options.buttons || [{ text: 'OK', style: 'default', onPress: hideAlert }],
      });
    },
    [hideAlert]
  );

  const showConfirm = useCallback(
    ({
      title,
      message,
      icon,
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      isDestructive = false,
      onConfirm,
      onCancel,
    }: ShowConfirmOptions) => {
      showAlert({
        title,
        message,
        icon: icon || (isDestructive ? 'trash-outline' : 'help-circle-outline'),
        destructive: isDestructive,
        buttons: [
          {
            text: cancelText,
            style: 'cancel',
            onPress: () => {
              hideAlert();
              onCancel?.();
            },
          },
          {
            text: confirmText,
            style: isDestructive ? 'destructive' : 'default',
            onPress: async () => {
              hideAlert();
              await onConfirm();
            },
          },
        ],
      });
    },
    [showAlert, hideAlert]
  );

  // Bind global references
  globalShowAlert = showAlert;
  globalShowConfirm = showConfirm;
  globalHideAlert = hideAlert;

  return (
    <CustomAlertContext.Provider value={{ showAlert, showConfirm, hideAlert }}>
      {children}
      {alertConfig && (
        <CustomAlertModal
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          icon={alertConfig.icon}
          iconColor={alertConfig.iconColor}
          iconBgColor={alertConfig.iconBgColor}
          buttons={alertConfig.buttons}
          onClose={hideAlert}
        />
      )}
    </CustomAlertContext.Provider>
  );
};

export const useCustomAlert = (): CustomAlertContextType => {
  const context = useContext(CustomAlertContext);
  if (!context) {
    throw new Error('useCustomAlert must be used within a CustomAlertProvider');
  }
  return context;
};
