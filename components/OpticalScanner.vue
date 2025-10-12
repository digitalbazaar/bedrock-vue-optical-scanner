<template>
  <ScannerUI
    ref="scannerUIRef"
    :tip-text="tipText"
    :show-qr-box="showQrBox"
    :scan-type="scanType"
    :loading="loading"
    :scanning="scanning"
    :camera-error="cameraError"
    :camera-list="cameraList"
    :capabilities="capabilities"
    :camera-constraints="cameraConstraints"
    :camera-on="cameraOn"
    @close="handleClose"
    @toggle-torch="toggleTorch"
    @update-camera="onCameraChange"
    @zoom-update="onZoomChange"
    @file-upload="onFileUpload"
    @start-scan="startCamera"
    @stop-scan="stopCamera" />
</template>

<script>
/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved. V3
 */
import {computed, onBeforeUnmount, onMounted, reactive, ref} from 'vue';
import {CameraScanner} from '@bedrock/web-optical-scanner';
import ScannerUI from './ScannerUI.vue';

export default {
  name: 'OpticalScanner',
  components: {
    ScannerUI
  },
  props: {
    // NOTE: formats prop to override scanType (power-user mode)
    formats: {
      type: Array,
      default: null, // null = use scanType default or ['pdf417_enhanced']
      validator: value => {
        const validFormats = ['pdf417_enhanced'];
        return value === null || value.every(f => validFormats.includes(f));
      }
    },
    scanType: {
      type: String,
      required: true,
      validator: value => ['mrz', 'barcode', 'auto'].includes(value)
    },
    scanMode: {
      type: String,
      default: 'first'
    },
    tipText: {
      type: String,
      default: 'Position barcode within the frame'
    },
    showQrBox: {
      type: Boolean,
      default: true
    },
    torchOn: {
      type: Boolean,
      default: false
    }
  },
  emits: ['result', 'error', 'close'],
  setup(props, {emit}) {
    console.log('🔍 Props:', props);

    // === CAMERA SCANNER INSTANCE ===
    let cameraScanner = null;
    let abortController = new AbortController();

    // === UI STATE MANAGEMENT ===
    const scannerUIRef = ref(null);
    const loading = ref(false);
    const scanning = ref(false);
    const cameraError = ref(false);
    const cameraList = ref([]);
    // const cameraTorch = ref(props.torchOn);

    const capabilities = reactive({
      zoom: false,
      torch: false
    });

    // TODO: double check and remove this logic from OpticalScanner as
    // CameraScanner should be handle this
    const cameraConstraints = reactive({
      zoom: {min: 1, max: 8, step: 1}
    });

    // === COMPUTED PROPERTIES ===
    const cameraOn = computed(() => !loading.value && !cameraError.value);

    // === LIFECYCLE HOOKS ===
    onMounted(async () => {
      await initializeCameraScanner();
      await startCamera();
    });

    onBeforeUnmount(() => {
      stopCamera();
    });

    // === INITIALIZATION ===
    async function initializeCameraScanner() {
      // console.log('Initializing CameraScanner with scanType:',
      //  props.scanType);

      try {
        // Create CameraScanner with current configuration
        cameraScanner = new CameraScanner({
          scanType: props.scanType,
          scanMode: props.scanMode,
          formats: props.formats
        });

        // === Set up event listener for auto-scan ===
        cameraScanner.on('result', result => {
          console.log('Vue: Auto-scan result received:', result);
          scanning.value = false;
          emit('result', result);
        });

        cameraScanner.on('error', error => {
          console.log('Vue: Auto-scan error received:', error);
          scanning.value = false;
          emit('error', error);
        });

        // console.log('CameraScanner initialized successfully');
      } catch(error) {
        console.error('CameraScanner initialization error:', error);
        emit('error', {
          message: 'Scanner initialization failed',
          code: 'SCANNER_INIT_ERROR'
        });
      }
    }

    // === DELEGATION TO CAMERA SCANNER ===
    async function startCamera() {
      if(!cameraScanner) {
        console.error('CameraScanner not initialized');
        return;
      }

      loading.value = true;
      cameraError.value = false;

      try {
        // === GET CONTAINER FROM UI ===
        const targetContainer = scannerUIRef.value?.cameraContainer;

        console.log('Vue: Delegating camera setup and scanning to' +
          ' CameraScanner...');

        // === PURE DELEGATION ===
        const result = await cameraScanner.start(
          targetContainer,
          {autoScan: true}
        );

        if(result.success) {
          console.log('Vue: Camera and scanning started successfully');
          console.log('Auto-scan initiated:', result.autoScanStarted);
          // === UPDATE UI STATE FROM CAMERA SCANNER ===
          await updateCameraInfo();

        } else {
          cameraError.value = true;
          emit('error', {
            message: result.error,
            code: result.code || 'CAMERA_START_ERROR'
          });
        }

      } catch(error) {
        console.error('Vue: Camera start error:', error);
        cameraError.value = true;
        emit('error', {
          message: error.message || 'Camera start failed',
          code: error.code || 'CAMERA_START_ERROR'
        });
      } finally {
        loading.value = false;
      }
    }

    // TODO: Comeback and double check if updateCameraInfo is needed here
    // CameraScanner should be able to manage.
    // Additionally, camera.js utils file functions can be reused.

    async function updateCameraInfo() {
      if(!cameraScanner) {
        return;
      }

      try {
        // === PURE DELEGATION TO CAMERA SCANNER ===
        const caps = cameraScanner.getCameraCapabilities();
        capabilities.zoom = caps.zoom;
        capabilities.torch = caps.torch;

        if(caps.zoomRange) {
          const {max = 8, min = 1, step = 1} = caps.zoomRange;
          Object.assign(cameraConstraints.zoom, {min, max, step});
        }

        const devices = await cameraScanner.getCameraList();
        cameraList.value = devices;

      } catch(error) {
        console.error('Error updating camera info:', error);
      }
    }

    function stopCamera() {
      // Cancel any ongoing operations
      abortController.abort();
      abortController = new AbortController();

      if(cameraScanner) {
        cameraScanner.stop();
      }
      scanning.value = false;
    }
    // TODO: onFileUpload - Need to test thoroughly
    // === FILE UPLOAD SCANNING ===
    async function onFileUpload(files) {
      if(!files || files.length === 0 || !cameraScanner) {
        return;
      }

      scanning.value = true;

      try {
        // === PURE DELEGATION TO CAMERA SCANNER ===
        const result = await cameraScanner.scanFile(files);

        console.log('Vue: File scan result:', result);
        // emit('result', result);

      } catch(error) {
        console.error('File scanning error:', error);
        // Only reset scanning state if events weren't emitted
        // (validation errors)
        if(scanning.value === true) {
          scanning.value = false;
        }
        // emit('error', {
        //   message: error.message || 'File scanning failed',
        //   code: error.code || 'FILE_SCAN_ERROR'
        // });
      }
      // finally {
      //         scanning.value = false;
      //       }
    }

    // TODO: Below functions need thorough testing
    // === CAMERA CONTROL EVENTS - PURE DELEGATION ===
    async function toggleTorch() {
      if(!cameraScanner) {
        return;
      }

      try {
        await cameraScanner.setTorch();
      } catch(error) {
        console.error('Torch error:', error);
      }
    }

    async function onCameraChange(deviceId) {
      if(!cameraScanner) {
        return;
      }

      try {
        await cameraScanner.switchCamera(deviceId);
        // Update capabilities after camera switch
        await updateCameraInfo();
      } catch(error) {
        console.error('Camera change error:', error);
      }
    }

    async function onZoomChange(zoomLevel) {
      if(!cameraScanner) {
        return;
      }

      try {
        await cameraScanner.setZoom(zoomLevel);
      } catch(error) {
        console.error('Zoom error:', error);
      }
    }

    function handleClose() {
      stopCamera();
      emit('close');
    }

    // === PUBLIC METHOD: SCAN ANY ===
    async function scanAny() {
      console.log('scanAny called, scanType:', props.scanType);

      // Start camera first if not already started
      if(!cameraOn.value) {
        console.log('scanAny: Camera not started, starting camera first...');
        await startCamera();
      }

      // === PURE DELEGATION WITH SIGNAL SUPPORT ===
      scanning.value = true;
      const {signal} = abortController;

      try {
        // const result = await cameraScanner.scanAny({signal});
        console.log('Vue: Using CameraScanner.startScanning() for manual scan');
        const result = await cameraScanner.startScanning({signal});
        console.log('Vue: Manual scan successful, emitting result:', result);
        emit('result', result);
        return result;
      } catch(error) {
        // Handle abort gracefully
        if(error.name === 'AbortError' || error.code === 'SCAN_CANCELLED') {
          console.log('Manual scan was cancelled');
          return;
        }

        console.error('Vue: Manual scan error:', error);
        emit('error', {
          message: error.message || 'Auto-scan failed',
          code: error.code || 'SCAN_ANY_ERROR'
        });
      } finally {
        scanning.value = false;
      }
    }

    // === RETURN VALUES FOR TEMPLATE ===
    return {
      // DOM Refs
      scannerUIRef,

      // UI State
      loading,
      scanning,
      cameraError,
      cameraList,
      capabilities,
      cameraConstraints,
      cameraOn,

      // Methods
      startCamera,
      stopCamera,
      handleClose,
      toggleTorch,
      onCameraChange,
      onZoomChange,
      onFileUpload,
      scanAny
    };
  }
};
</script>
