import AsyncStorage from '@react-native-async-storage/async-storage';

export type NetworkMode =
  | 'cloud'
  | 'laptop-relay'
  | 'laptop-proxy'
  | 'laptop-direct';

const STORAGE_KEY = 'tunes_network_mode';

const RENDER_BASE_URL = 'https://pwa-music-app-backend.onrender.com';
const LAPTOP_BASE_URL = 'https://vineetbisht.tail02b0f1.ts.net';

export interface NetworkModeInfo {
  label: string;
  badge: string;
  description: string;
  isLaptopDirect: boolean;
}

export const NETWORK_MODES: Record<NetworkMode, NetworkModeInfo> = {
  cloud: {
    label: 'Cloud (Render Auto)',
    badge: 'Render + Proxies',
    description: 'Uses Webshare proxy pool on Render with auto-failover to laptop',
    isLaptopDirect: false,
  },
  'laptop-relay': {
    label: 'Cloud Relay (Tailscale)',
    badge: 'Render Relay',
    description: 'Render skips proxies and bridges the download stream from laptop',
    isLaptopDirect: false,
  },
  'laptop-direct': {
    label: 'Laptop Direct (0-Proxy)',
    badge: 'Tailscale Direct',
    description: 'Direct to laptop via Tailscale using home Wi-Fi (0 proxy cost)',
    isLaptopDirect: true,
  },
  'laptop-proxy': {
    label: 'Laptop Proxy Pool',
    badge: 'Tailscale + Proxy',
    description: 'Direct to laptop via Tailscale running with Webshare proxy pool',
    isLaptopDirect: true,
  },
};

let currentCachedMode: NetworkMode = 'cloud';

export const initNetworkMode = async (): Promise<NetworkMode> => {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved && saved in NETWORK_MODES) {
      currentCachedMode = saved as NetworkMode;
    }
  } catch {
    currentCachedMode = 'cloud';
  }
  return currentCachedMode;
};

export const getSavedNetworkMode = (): NetworkMode => currentCachedMode;

export const setSavedNetworkMode = async (mode: NetworkMode): Promise<void> => {
  currentCachedMode = mode;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, mode);
  } catch (err) {
    console.warn('[Network] Failed to persist network mode:', err);
  }
};

export const getApiConfig = (): { baseUrl: string; networkMode: NetworkMode } => {
  const isDirect = NETWORK_MODES[currentCachedMode].isLaptopDirect;
  return {
    baseUrl: isDirect ? LAPTOP_BASE_URL : RENDER_BASE_URL,
    networkMode: currentCachedMode,
  };
};

export const getLaptopUrl = (): string => LAPTOP_BASE_URL;
export const getRenderUrl = (): string => RENDER_BASE_URL;