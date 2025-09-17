<template>
  <div
    ref="scannerContainer"
    class="optical-scanner-container full-width full-height relative-position">
    <!-- Camera Error -->
    <div
      v-if="cameraError"
      class="absolute-center text-center">
      <div class="row items-center justify-center">
        <q-icon
          color="red-12"
          name="fas fa-times"
          class="q-pa-lg"
          size="xl" />
      </div>
      <div
        class="q-mt-md text-white"
        style="max-width: 280px">
        <slot name="error-message">
          There was an error loading your camera. Please upload a photo instead
          or refresh the page.
        </slot>
      </div>
    </div>

    <!-- Loading States -->
    <div
      v-else-if="loading"
      class="absolute-center">
      <slot
        v-if="loading"
        name="camera-spinner">
        <q-spinner-ios
          color="white"
          size="50px" />
      </slot>
      <slot
        v-if="scanning"
        name="scanner-spinner">
        <q-spinner-dots
          color="white"
          size="50px" />
      </slot>
    </div>
    <!--
      MRZ CONTAINER - Integration (mrz scan)

      For MRZ scanning, this container receives the video element created by CameraScanner.
      Dynamsoft MRZ plugin may also inject its own UI elements into this container.
      The container must be sized properly to accommodate both video and UI overlays.
    -->
    <div
      v-show="isMrzMode"
      ref="mrzContainer"
      class="mrz-container full-width full-height">
      <!-- CameraScanner will insert video element here dynamically -->
      <!-- Dynamsoft may also inject native UI components here -->
    </div>

    <!--
      VIDEO CONTAINER - Integration (only for non-MRZ modes)
      
      For barcode scanning, this container receives the video element created by CameraScanner.
      Vue overlays (QR box, controls, etc.) are positioned on top using absolute positioning.
      
      IMPORTANT: Removed the static <video> element that was previously here.
      CameraScanner now creates and provides the video element dynamically.
    -->
    <div
      v-show="showVideo && !isMrzMode"
      ref="videoContainer"
      class="video-container full-width full-height">
      <!-- CameraScanner will insert video element here dynamically -->
      <!-- Previous static video element removed -->
    </div>

    <!-- QR Box Overlay (only for non-MRZ modes)-->
    <div
      v-if="showQrBox && showVideo && !isMrzMode"
      class="scan-overlay-container">
      <div class="qr-box-overlay">
        <div
          :class="overlayClasses"
          class="scan-overlay">
          <div class="scan-instruction">
            {{overlayText}}
          </div>
        </div>
      </div>

      <!-- Tip Text -->
      <div
        v-if="tipText && showVideo"
        class="absolute-bottom text-center q-pb-xl">
        <div
          class="tip-text text-white q-px-md q-py-sm rounded-borders"
          style="background: rgba(0, 0, 0, 0.6);">
          {{tipText}}
        </div>
      </div>

      <!-- Close Button -->
      <q-btn
        v-if="!loading && !scanning"
        flat
        round
        icon="fas fa-times"
        color="white"
        size="md"
        class="absolute-top-right q-ma-md"
        @click="$emit('close')" />

      <!-- Camera Controls -->
      <div
        v-if="showControls"
        class="absolute-bottom-left q-ma-md">
        <!-- Torch Button -->
        <q-btn
          v-if="capabilities.torch"
          flat
          round
          :icon="torchOn ? 'fas fa-flashlight' : 'far fa-lightbulb'"
          color="white"
          size="md"
          class="q-mb-sm"
          @click="$emit('toggle-torch')" />

        <!-- Camera Switch -->
        <q-btn
          v-if="cameraList.length > 1"
          flat
          round
          icon="fas fa-camera-rotate"
          color="white"
          size="md"
          class="q-mb-sm"
          @click="switchToNextCamera" />

        <!-- File Upload -->
        <q-btn
          flat
          round
          icon="fas fa-upload"
          color="white"
          size="md"
          class="q-mb-sm"
          @click="openFileDialog">
          <q-tooltip>Upload Image</q-tooltip>
        </q-btn>
        <!-- Hidden file input for upload functionality -->
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          multiple
          style="display: none;"
          @change="handleFileUpload">
      </div>

      <!-- Zoom Slider -->
      <div
        v-if="capabilities.zoom && showControls"
        class="absolute-bottom-right q-ma-md">
        <div class="zoom-container column items-center">
          <q-icon
            name="fas fa-search-plus"
            color="white"
            size="sm"
            class="q-mb-xs" />
          <q-slider
            :model-value="zoomLevel"
            :min="cameraConstraints.zoom.min"
            :max="cameraConstraints.zoom.max"
            :step="cameraConstraints.zoom.step"
            vertical
            reverse
            color="white"
            track-color="transparent"
            thumb-color="white"
            style="height: 100px;"
            @update:model-value="$emit('zoom-update', $event)" />
          <q-icon
            name="fas fa-search-minus"
            color="white"
            size="sm"
            class="q-mt-xs" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import {computed, ref} from 'vue';

export default {
  name: 'ScannerUI',
  props: {
    tipText: {
      type: String,
      default: ''
    },
    showQrBox: {
      type: Boolean,
      default: true
    },
    loading: {
      type: Boolean,
      default: false
    },
    scanning: {
      type: Boolean,
      default: false
    },
    cameraOn: {
      type: Boolean,
      default: false
    },
    cameraError: {
      type: Boolean,
      default: false
    },
    cameraList: {
      type: Array,
      default: () => []
    },
    capabilities: {
      type: Object,
      default: () => ({})
    },
    cameraConstraints: {
      type: Object,
      default: () => ({zoom: {min: 1, max: 8, step: 1}})
    },
    torchOn: {
      type: Boolean,
      default: false
    },
    formats: {
      type: Array,
      default: () => ['qr_code', 'pdf417', 'pdf417_enhanced', 'mrz']
    },
    scanType: {
    type: String,
    required: true,
    validator: value => ['mrz', 'barcode'].includes(value)
    }
  },
  emits: [
    'close',
    'toggle-torch',
    'update-camera',
    'zoom-update',
    'file-upload',
    'start-scan',
    'stop-scan'
  ],
  setup(props, {emit}) {
    // --- Refs for DOM Elements ---
    const fileInput = ref(null);
    const mrzContainer = ref(null); // Container for MRZ video + Dynamsoft UI
    const videoContainer = ref(null); // Container for barcode video + overlays

    // --- Component State ---
    const currentCameraIndex = ref(0);
    const zoomLevel = ref(1);

    // --- Computed Properties ---
    const isMrzMode = computed(() => props.scanType === 'mrz');

    const showVideo = computed(() =>
      !props.loading && !props.cameraError
    );

    const showControls = computed(() =>
      showVideo.value && !props.loading
    );

    const overlayClasses = computed(() => {

      // safety check - ensure formats array exists
      if(!props.formats || !Array.isArray(props.formats)) {
        return 'scan-overlay--qr'; // default fallback
      }

      const hasQR = props.formats.includes('qr_code');
      const hasPDF417 = props.formats.includes('pdf417') ||
        props.formats.includes('pdf417_enhanced');
      const hasMRZ = props.formats.includes('mrz');

      if(props.formats.length === 1) {
        if(hasQR) {
          return 'scan-overlay--qr';
        }
        if(hasPDF417) {
          return 'scan-overlay--pdf417';
        }
        if(hasMRZ) {
          return 'scan-overlay--mrz';
        }
      }

      // Multi-format or default
      return 'scan-overlay--multi';
    });

    const overlayText = computed(() => {

      // safety check - ensure formats array exists
      if(!props.formats || !Array.isArray(props.formats)) {
        return 'Hold QR code here'; // default fallback
      }
      const hasQR = props.formats.includes('qr_code');
      const hasPDF417 = props.formats.includes('pdf417') ||
        props.formats.includes('pdf417_enhanced');
      const hasMRZ = props.formats.includes('mrz');

      if(props.formats.length === 1) {
        if(hasQR) {
          return 'Hold QR code here';
        }
        if(hasPDF417) {
          return 'Hold driver license here';
        }
        if(hasMRZ) {
          return 'Hold passport/ID MRZ document here';
        }
      }

      return 'Hold document here';
    });

    // --- Camera Control Methods ---
    function switchToNextCamera() {
      if(props.cameraList.length <= 1) {
        return;
      }

      currentCameraIndex.value =
        (currentCameraIndex.value + 1) % props.cameraList.length;

      const nextCamera = props.cameraList[currentCameraIndex.value];
      emit('update-camera', nextCamera.deviceId);
    }

    // --- File Upload Methods ---

    /**
    * Handle file selection from input element.
    * Converts FileList to Array and emits to parent component.
    */
    function handleFileUpload(event) {
      const files = Array.from(event.target.files);
      if(files.length > 0) {
        emit('file-upload', files);
      }
      // Reset input value to allow same file to be selected again
      event.target.value = '';
    }

    /**
    * Programmatically trigger file input dialog.
    * Called by file upload button click.
    */
    function openFileDialog() {
      fileInput.value?.click();
    }

    // --- Scan Control Methods ---

    /**
    * Handle start scan button click (if enabled in template).
    * Currently commented out/removed in template but kept for future use.
    */
    function handleStartScan() {
      console.log('START SCAN button clicked in ScannerUI');
      emit('start-scan');
    }

    /**
    * Handle stop scan button click (if enabled in template).
    * Currently commented out/removed in template but kept for future use.
    */
    function handleStopScan() {
      console.log('STOP SCAN button clicked in ScannerUI');
      emit('stop-scan');
    }

    // --- Return Values for Template ---
    return {
      // DOM Refs
      fileInput, // For file upload functionality
      mrzContainer, // Container where CameraScanner inserts MRZ video
      videoContainer, // Container where CameraScanner inserts barcode video
      // videoRef, // No longer needed
      
      // State
      zoomLevel,

      // Computed Properties
      showVideo,
      showControls,
      isMrzMode,
      overlayClasses,
      overlayText,

      // Methods
      switchToNextCamera,
      handleFileUpload,
      openFileDialog,
      handleStartScan,
      handleStopScan
    };
  }
};
</script>

<style scoped>
.optical-scanner-container {
  background: #000;
  overflow: hidden;
}

.mrz-container {
  position: relative;
  background: #000;
  /* border: 5px solid red !important; */ /* Debug border */
  /* box-sizing: border-box; */ /* Debug border */
}

.controls-bar {
   z-index: 10;
}

.video-container {
  position: relative;
}

.scan-overlay-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.scan-overlay {
  border: 3px solid #ffc107;
  border-radius: 8px;
  pointer-events: none;
  animation: pulse 2s ease-in-out infinite;
  position: relative;
  background: rgba(255, 193, 7, 0.1);
}

@keyframes pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

/* QR Code - Square */
.scan-overlay--qr {
  width: 250px;
  height: 250px;
}

/* PDF417 - Rectangular/Wide */
.scan-overlay--pdf417 {
  width: 500px;
  height: 150px;
}

/* MRZ - Wide but taller than PDF417 */
.scan-overlay--mrz {
  width: 600px;
  height: 400px;
}

/* Multi-format - Generic rectangle */
.scan-overlay--multi {
  width: 500px;
  height: 200px;
}

.scan-instruction {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 193, 7, 0.9);
  color: #000;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  white-space: nowrap;
}

.tip-text {
  font-size: 14px;
  line-height: 1.4;
  max-width: 300px;
}

.zoom-container {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 20px;
  padding: 8px 6px;
}

/* Mobile safe area support */
@supports (padding: max(0px)) {
  .optical-scanner-container {
    padding-left: max(0px, env(safe-area-inset-left));
    padding-right: max(0px, env(safe-area-inset-right));
    padding-bottom: max(0px, env(safe-area-inset-bottom));
  }
}

/* Prevent pinch to zoom on mobile */
.optical-scanner-container {
  touch-action: pan-y;
}

/* Target any remaining global Dynamsoft elements */
:global(.mrz-scanner-scanner-view-container),
:global(.dynamsoft-mrz-loading-screen),
:global(.dynamsoft-mrz-loading),
:global(.dynamsoft-mrz-loading-content),
:global(.dynamsoft-mrz-loading-message) {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  z-index: 10 !important;
}
</style>
