import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';
import App from './App';
import { playbackService } from './src/services/playbackService';

// Register the headless background playback service
TrackPlayer.registerPlaybackService(() => playbackService);

// Register the main application component
registerRootComponent(App);