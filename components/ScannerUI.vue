<template>
  <!--
    ARCHITECTURE: Separated Areas for Clean DOM Management
    - camera-area: CameraScanner manages video/Dynamsoft UI (z-index: 1)
    - UI states: Vue manages error/loading states (z-index: 10)
    - overlay-area: Vue manages scan guides & controls (z-index: 2-6)
    This prevents DOM conflicts between Vue and CameraScanner
  -->
  <div
    ref="scannerContainer"
    class="optical-scanner-container full-width full-height relative-position">
    <!-- CameraScanner's Dedicated Area -->
    <div
      ref="cameraContainer"
      class="camera-area full-width full-height">
      <!-- CameraScanner will manage this area exclusively -->
      <!-- For MRZ camera mode: Dynamsoft native UI goes here -->
      <!-- For barcode mode: Video element goes here -->
    </div>
    <!-- Vue's Domain: UI States (always on top) -->
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

    <!-- Vue's Domain: Overlays & Controls
      (only show for barcode mode, hidden for MRZ camera mode) -->
    <div
      v-if="showOverlays"
      class="overlay-area">
      <div class="scan-overlay-container">
        <!-- QR Box Overlay -->
        <div
          v-if="effectiveShowQrBox"
          class="qr-box-overlay">
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
          v-if="tipText"
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
          class="absolute-top-right q-ma-md close-button"
          @click="$emit('close')" />

        <!-- Camera Controls -->
        <div
          v-if="showControls"
          class="absolute-bottom-left q-ma-md camera-controls">
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
          class="absolute-bottom-right q-ma-md zoom-controls">
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
  </div>
</template>

<script>
/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved. V3
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
    // formats: {
    //   type: Array,
    //   default: () => ['qr_code', 'pdf417', 'pdf417_enhanced', 'mrz']
    // },
    scanType: {
      type: String,
      required: true,
      validator: value => ['mrz', 'barcode', 'auto'].includes(value)
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
    // console.log('ScannerUI SETUP CALLED');

    // === CONTAINER REF ===
    const cameraContainer = ref(null);

    // === UI STATE ===
    const fileInput = ref(null);
    const currentCameraIndex = ref(0);
    const zoomLevel = ref(1);

    // === COMPUTED PROPERTIES ===
    // Show overlays only for barcode mode (MRZ camera mode uses native UI)
    const showOverlays = computed(() => {
      // Show overlays for any mode that uses video element
      // (not Dynamsoft native UI)
      const usesVideoElement = props.scanType === 'barcode' ||
        props.scanType === 'auto';
      const result = usesVideoElement && !props.loading && !props.cameraError;

      // console.log('showOverlays:', {
      //   scanType: props.scanType,
      //   usesVideoElement,
      //   loading: props.loading,
      //   cameraError: props.cameraError,
      //   result
      // });

      return result;
    });

    const showControls = computed(() =>
      showOverlays.value && !props.loading
    );

    // Make showQrBox mode-aware
    const effectiveShowQrBox = computed(() => {
      // Only show QR box for barcode-based modes
      // MRZ uses Dynamsoft native UI (no Vue overlays)
      const isBarcodeMode = ['barcode', 'auto'].includes(props.scanType);
      const result = isBarcodeMode && props.showQrBox;
      // console.log('effectiveShowQrBox:', {
      //   scanType: props.scanType,
      //   isBarcodeMode,
      //   showQrBox: props.showQrBox,
      //   result
      // });
      return result;
    });

    // Infer expected formats from scanType for overlay purposes
    const expectedFormats = computed(() => {
      // Infer formats from scanType for UI overlay purposes
      if(props.scanType === 'mrz') {
        return ['mrz'];
      } else if(props.scanType === 'barcode') {
        return ['qr_code', 'pdf417_enhanced', 'pdf417'];
      } else if(props.scanType === 'auto') {
        return ['qr_code', 'pdf417_enhanced', 'pdf417', 'mrz'];
      }
      return [];
    });

    // Dynamic overlay styling based on scan type
    const overlayClasses = computed(() => {
      if(!showOverlays.value) {
        return '';
      }

      // Auto mode gets its own overlay size
      if(props.scanType === 'auto') {
        return 'scan-overlay--auto';
      }

      // Safety check - ensure formats array exists
      const formats = expectedFormats.value;
      if(!formats || !Array.isArray(formats)) {
        return 'scan-overlay--qr'; // default fallback
      }

      const hasQR = formats.includes('qr_code');
      const hasPDF417 = formats.includes('pdf417') ||
        formats.includes('pdf417_enhanced');
      const hasMRZ = formats.includes('mrz');

      if(formats.length === 1) {
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
      if(!showOverlays.value) {
        return '';
      }

      // Safety check - ensure formats array exists
      const formats = expectedFormats.value;
      if(!formats || !Array.isArray(formats)) {
        return 'Hold QR code here'; // default fallback
      }

      const hasQR = formats.includes('qr_code');
      const hasPDF417 = formats.includes('pdf417') ||
        formats.includes('pdf417_enhanced');
      const hasMRZ = formats.includes('mrz');

      if(formats.length === 1) {
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

    // === CAMERA CONTROL METHODS ===
    function switchToNextCamera() {
      if(props.cameraList.length <= 1) {
        return;
      }

      currentCameraIndex.value =
        (currentCameraIndex.value + 1) % props.cameraList.length;

      const nextCamera = props.cameraList[currentCameraIndex.value];
      emit('update-camera', nextCamera.deviceId);
    }

    // TODO: File Upload related methods - need thorough testing.
    // === FILE UPLOAD METHODS ===

    /**
    * Handle file selection from input element.
    * Converts FileList to Array and emits to parent component.
    *
    * @param {Event} event - The change event triggered by the file input
    *  element.
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

    // === RETURN VALUES FOR TEMPLATE ===
    return {
      // DOM Refs - SINGLE CONTAINER APPROACH
      fileInput, // For file upload functionality
      cameraContainer, // CameraScanner will use this

      // State
      zoomLevel,

      // Computed Properties
      showOverlays,
      showControls,
      expectedFormats,
      overlayClasses,
      overlayText,
      effectiveShowQrBox,

      // Methods
      switchToNextCamera,
      handleFileUpload,
      openFileDialog
    };
  }
};
</script>

<style scoped>
.optical-scanner-container {
  background: #000;
  overflow: hidden;
}

.camera-area {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  background: #000;
}

.overlay-area {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}

/* UI States - Always on top */
.optical-scanner-container .absolute-center {
  z-index: 10 !important;
}

.optical-scanner-container .loading-state,
.optical-scanner-container .error-state {
  z-index: 10;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
}

/* Interactive Controls - Must be clickable and on top */
.camera-controls,
.close-button,
.zoom-controls {
  z-index: 6 !important;
  pointer-events: auto !important;
}

.camera-controls .q-btn,
.close-button,
.zoom-controls .q-slider {
  pointer-events: auto !important;
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
  z-index: 5;
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

/* Auto mode - Large overlay to accommodate all document types */
.scan-overlay--auto {
  width: 600px;
  height: 400px;
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
