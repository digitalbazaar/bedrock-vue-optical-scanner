<template>
  <ScannerUI
    ref="scannerUIRef"
    :tip-text="tipText"
    :show-qr-box="showQrBox"
    :formats="scanConfig.formats"
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
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved. V0
 */
import {CameraScanner, cameraUtils} from '@bedrock/web-optical-scanner';
import {computed, onBeforeUnmount, onMounted, reactive, ref} from 'vue';
import ScannerUI from './ScannerUI.vue';

export default {
  name: 'OpticalScanner',
  components: {
    ScannerUI
  },
  props: {
    // formats: {
    //   type: Array,
    //   default: () => ['qr_code', 'pdf417', 'pdf417_enhanced', 'mrz']
    // },
    scanType: {
      type: String,
      required: true,
      validator: value => ['mrz', 'barcode'].includes(value)
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
    },
    licenseKey: {
      type: String,
      default: ''
    }
  },
  emits: ['result', 'error', 'close'],
  setup(props, {emit}) {
    // State management
    let cameraScanner = null;
    let abortController = new AbortController();

    const scannerUIRef = ref(null);
    const loading = ref(false);
    const scanning = ref(false);
    const cameraError = ref(false);
    const cameraList = ref([]);
    const cameraTorch = ref(props.torchOn);

    const capabilities = reactive({
      zoom: false,
      torch: false
    });

    const cameraConstraints = reactive({
      zoom: {min: 1, max: 8, step: 1}
    });

    const FORMAT_TO_HTML5QRCODE_MAP = {
      qr_code: 'QR_CODE',
      pdf417: 'PDF_417',
      mrz: 'MRZ'
    };

    const cameraOn = computed(() => !loading.value && !cameraError.value);

    // Derive formats and configuration from scanType
    const scanConfig = computed(() => {
      if(props.scanType === 'mrz') {
        return {
          formats: ['mrz'],
          mrzMode: 'camera',
          useContinuousScanning: false
        };
      } else {
        return {
          formats: ['qr_code', 'pdf417_enhanced', 'pdf417'],
          mrzMode: 'element', // Won't be used since no MRZ in formats
          useContinuousScanning: true
        };
      }
    });

    // Lifecycle hooks
    onMounted(async () => {
      await initializeScanner();
      await startCamera();
    });

    onBeforeUnmount(() => {
      stopCamera();
    });

    // --- Initialization ---
    async function initializeScanner() {
      console.log('Initializing CameraScanner with scanType:', props.scanType);

      try {
        // Create CameraScanner with current configuration
        cameraScanner = new CameraScanner({
          scanType: props.scanType,
          scanMode: props.scanMode,
          licenseKey: props.licenseKey,
          targetContainer: null // Could be made configurable if needed
        });

        console.log('CameraScanner initialized successfully');
      } catch (error) {
        console.error('Scanner initialization error:', error);
        emit('error', {
          message: 'Scanner initialization failed',
          code: 'SCANNER_INIT_ERROR'
        });
      }
    }

  // --- Simplified Camera Management ---
  /**
    * Start camera using enhanced CameraScanner.start(container).
    *
    * IMPLEMENTATION:
    * - CameraScanner handles ALL scanning complexity internally
    * - Vue component only provides container and handles UI state
    * - No business logic, mode detection, or plugin management in Vue
    * - Perfect alignment with feedback requirements
    *
    */
    async function startCamera() {
      if(!cameraScanner) {
        console.error('CameraScanner not initialized');
        return;
      }

      console.log('Vue: Starting camera...');
      // console.log('Vue: Scan type:', props.scanType);

      loading.value = true;
      cameraError.value = false;

      try {
        // === DETERMINE CONTAINER ===
        // Vue's only business logic: determine which UI container to provide
        // This is pure UI concern - which div should display the camera
        let targetContainer = null;

        if(props.scanType === 'mrz') {
          targetContainer = scannerUIRef.value?.mrzContainer;
          if (!targetContainer) {
            throw new Error('MRZ container not found in ScannerUI component');
          }
          console.log('Vue: Using MRZ container for camera display');
        } else {
          targetContainer = scannerUIRef.value?.videoContainer;
          if(!targetContainer) {
            throw new Error('Video container not found in ScannerUI component');
          }
          console.log('Vue: Using video container for camera display');
        }

        // === DELEGATE TO CAMERA SCANNER ===
        // CameraScanner handles ALL scanning complexity internally:
        // - Video element creation and stream setup
        // - Mode detection (MRZ camera vs element mode)
        // - Container management (video insertion vs Dynamsoft native UI)
        // - Plugin configuration and container references
        // - Error handling and validation
        console.log('Vue: Delegating camera setup to CameraScanner...');

        const result = await cameraScanner.start(targetContainer);

        // console.log('Vue: CameraScanner.start() result:', result);

        if(!result.success) {
          throw new Error(result.error || 'Camera scanner failed to start');
        }

        // === UPDATE UI STATE ===
        // Vue handles only UI state management based on scanner results
        // console.log('Vue: Updating camera capabilities and device list...');
        getCapabilities();
        await getCameraList();

        // === START SCANNING IF APPROPRIATE ===
        // Use scanner configuration to determine scanning strategy
        const scanConfig = cameraScanner.getScanConfig();
        // console.log('Vue: Scanner configuration:', scanConfig);

        if(scanConfig.useContinuousScanning) {
          console.log('Vue: Starting continuous scanning for barcode formats');
          startContinuousScanning();
        } else {
          console.log('Vue: Skipping continuous scanning for MRZ (user-initiated scanning)');
          performScan();
        }
        console.log('Vue: Camera initialization completed successfully');

      } catch(error) {
        // === ERROR HANDLING ===
        console.error('Vue: Camera initialization failed:', error);

        cameraError.value = true;

        // Provide user-friendly error messages
        let userMessage = 'Could not access camera';
        let errorCode = 'CAMERA_ACCESS_ERROR';

        if(error.message.includes('permission denied') || error.message.includes('NotAllowedError')) {
          userMessage = 'Camera permission denied. Please allow camera access and try again.';
          errorCode = 'CAMERA_PERMISSION_DENIED';
        } else if(error.message.includes('not found') || error.message.includes('NotFoundError')) {
          userMessage = 'No camera found. Please connect a camera and try again.';
          errorCode = 'NO_CAMERA_FOUND';
        } else if(error.message.includes('container not found')) {
          userMessage = 'Scanner UI not ready. Please try again.';
          errorCode = 'UI_CONTAINER_ERROR';
        } else if(error.message.includes('not initialized')) {
          userMessage = 'Scanner initialization failed. Please refresh the page.';
          errorCode = 'SCANNER_INIT_ERROR';
        }

        emit('error', {
          message: userMessage,
          code: errorCode,
          details: error.message
        });

      } finally {
        // Always clear loading state
        loading.value = false;
        console.log('Vue: Camera initialization process completed');
      }
    }

    async function getCameraList() {
      try {
        const devices = await cameraUtils.getCameraList();
        cameraList.value = devices;
      } catch(error) {
        console.error('Unable to get camera list', error);
        cameraList.value = [];
      }
    }

    function stopCamera() {
      abortController.abort();
      abortController = new AbortController();

      if(cameraScanner) {
        cameraScanner.stop();
      }

      scanning.value = false;
    }

    function getCapabilities() {
      if(!cameraScanner) {
        return;
      }

      try {
        const caps = cameraScanner.getCameraCapabilities();
        capabilities.zoom = caps.zoom;
        capabilities.torch = caps.torch;

        if(caps.zoomRange) {
          const {max = 8, min = 1, step = 1} = caps.zoomRange;
          Object.assign(cameraConstraints.zoom, {min, max, step});
        }
      } catch(error) {
        console.error('Error getting capabilities:', error);
      }
    }

    // --- Core Scanning ---
    async function performScan(options = {}) {
      if(!cameraScanner) {
        throw new Error('Scanner not initialized');
      }

      scanning.value = true;

      try {
        // console.log('=== CAMERA SCANNER SCAN ===');
        // console.log('Scan type:', props.scanType);
        // console.log('Scan mode:', props.scanMode);
        // console.log('Options:', options);

        let result;

        // Use appropriate scanning method based on configuration
        if(scanConfig.value.useContinuousScanning && !options.singleScan) {
          // Continuous scanning for barcodes
          result = await cameraScanner.scanContinuous({});
            //{signal: abortController.signal}
        } else {
          // Single scan for MRZ or on-demand scanning
          result = await cameraScanner.scanOnce();
        }

        if(result.success) {
          const convertedResult = formatResult(result);
          console.log('Scan successful - formatted Result:', convertedResult);

          // Stop camera when result found
          stopCamera();
          emit('result', convertedResult);
          return convertedResult;
        } else {
          throw new Error(result.error || 'No results found');
        }

      } catch (error) {
        console.error('Scan error:', error);

        if(error.name === 'AbortError') {
          // Scan was cancelled
          console.log('Scan Was Cancelled.');
          return;
        }

        if(error.message.includes('timeout') || error.code === 'SCAN_TIMEOUT') {
          emit('error', {
            message: 'Scan timed out, try again',
            code: 'SCAN_TIMEOUT'
          });
        } else if(error.message.includes('No results') || error.code === 'NO_RESULTS') {
          emit('error', {
            message: 'No results found',
            code: 'NO_RESULTS'
          });
        } else {
          emit('error', {
            message: 'Scanning failed',
            code: 'SCAN_ERROR'
          });
        }
      } finally {
        scanning.value = false;
      }
    }


    async function startContinuousScanning() {
      if(!cameraScanner) {
        console.log('Scanner not available for continuous scanning');
        return;
      }
      console.log('Starting continuous scanning with CameraScanner');
      while(scanConfig.value.useContinuousScanning && !abortController.signal.aborted) {
        try {
          await performScan(); // This will throw if results found
          break; // Exit loop if scan successful
        } catch(error) {
          if(error.name === 'AbortError') {
            console.log('Continuous scanning aborted');
            break;
          }
          
          if(error.message.includes('No results')) {
            // This is normal - continue scanning
            console.log('No results found, continuing scan...');
            await new Promise(resolve => setTimeout(resolve, 2500)); // Wait 2.5s
            continue;
          }
          
          // Real error - stop scanning
          console.error('Continuous scanning error:', error.message);
          break;
        }
      }
    }

    // --- Result Formatting Helpers ---
    function formatResult(result) {
      // console.log('=== RAW RESULT STRUCTURE ===');
      // console.log('Format:', result.format);
      // console.log('Formatting CameraScanner result:', result);
      // console.log('result.data:', result.data);
      // console.log('=== END RAW RESULT ===');

      switch(result.format) {
        case 'mrz':
          return formatMrzResult(result);

        case 'pdf417_enhanced':
          return formatDriverLicenseResult(result);

        case 'pdf417':
          return {
            type: 'PDF_417',
            text: formatPdf417Result(result)
          };

        case 'qr_code':
          return {
            type: 'QR_CODE',
            text: formatQrCodeResult(result)
          };

        default:
          return {
            type: FORMAT_TO_HTML5QRCODE_MAP[result.format] || result.format,
            text: result.text
          };
      }
    }

    function formatPdf417Result(result) {
      console.log('Formatting PDF417 result:', result);

      // Handle different possible data structures
      let pdf417Text = result.text;

      if(!pdf417Text && result.data && Array.isArray(result.data)) {
        const firstData = result.data[0];
        if(typeof firstData === 'string') {
          pdf417Text = firstData;
        } else if(firstData && firstData.text) {
          pdf417Text = firstData.text;
        } else if(firstData && firstData.rawValue) {
          pdf417Text = firstData.rawValue;
        }
      }

      return {
        type: 'PDF_417',
        text: pdf417Text || 'No PDF417 text found'
      };
    }

    function formatQrCodeResult(result) {
      console.log('Formatting QR result:', result);

      // Handle different possible data structures
      let qrText = result.text;

      if(!qrText && result.data && Array.isArray(result.data)) {
        // If data is an array, get the first element
        const firstData = result.data[0];
        if(typeof firstData === 'string') {
          qrText = firstData;
        } else if(firstData && firstData.text) {
          qrText = firstData.text;
        } else if(firstData && firstData.rawValue) {
          qrText = firstData.rawValue;
        }
      }

      return {
        type: 'QR_CODE',
        text: qrText || 'No QR code text found'
      };
    }

    function formatMrzResult(result) {
      console.log('=== FORMATMRZRESULT DEBUG ===');
      console.log('Full result:', result);
      // console.log('result.rawData[0]:', result.rawData?.[0]); // Changed from result.data[0]
      // console.log('result.rawData[0].data:', result.rawData?.[0]?.data);
      // console.log('result.rawData[0].metadata:', result.rawData?.[0]?.metadata);
      // console.log('result.rawData[0].validation:', result.rawData?.[0]?.validation);
      // console.log('============================');

      const mrzData = result.rawData?.[0]?.data || {};
      const validation = result.rawData?.[0]?.data?.validation ||
        result.rawData?.[0]?.validation || {};
      const invalidFields = result.rawData?.[0]?.data?.invalidFields ||
        result.rawData?.[0]?.invalidFields || [];

      console.log('Extracted validation:', validation);
      console.log('Extracted invalidFields:', invalidFields);

      // Simple fix for now - check overallStatus
      const isValid = validation.overallStatus === 'complete' ||
        (validation.overallStatus === 'partial' && invalidFields.length === 0);

      return {
        type: 'MRZ',
        fields: mrzData,
        valid: isValid
      };
    }

    function formatDriverLicenseResult(result) {
      console.log('Formatting Enhanced PDF417 result:', result);

      // Check for nested driver license data in result.data[0]
      if(result.data && result.data[0] && result.data[0].driverLicense) {
        const dl = result.data[0].driverLicense;
        return {
          type: 'DL',
          fields: dl,
          parsed: true,
          text: result.data[0].text || dl.raw ||
            'Enhanced PDF417 with parsed data'
        };
      }

      // Check if it has driver license data directly
      if(result.driverLicense) {
        return {
          type: 'DL',
          fields: result.driverLicense,
          parsed: true,
          text: result.text || 'Enhanced PDF417 with parsed data'
        };
      }
      // Fallback for other structures
      return {
        type: 'DL',
        fields: result.fields || {},
        text: result.text || 'Enhanced PDF417 data'
      };
    }

    // --- File Upload Scanning --- NOT TESTED
    async function onFileUpload(files) {
      if(!files || files.length === 0 || !cameraScanner) {
        return;
      }

      scanning.value = true;

      try {
        // Use CameraScanner's file scanning method
        const result = await cameraScanner.scanFile(files);

        if(result.success) {
          const convertedResult = {
            type: FORMAT_TO_HTML5QRCODE_MAP[result.format] || result.format,
            text: result.text
          };
          emit('result', convertedResult);
        } else {
          throw new Error(result.error || 'File scanning failed');
        }

      } catch(error) {
        console.error('File scanning error:', error);
        emit('error', {
          message: 'File scanning failed',
          code: 'FILE_SCAN_ERROR'
        });
      } finally {
        scanning.value = false;
      }
    }

    // --- UI Events ---
    async function toggleTorch() {
      if(!cameraScanner) {
        return;
      }

      cameraTorch.value = !cameraTorch.value;

      try {
        await cameraScanner.setTorch(cameraTorch.value);
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
        getCapabilities();
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

    // --- Public Method: ScanAny ---
    async function scanAny(timeoutMs = 12000) {
      // console.log('scanAny called, scanType:', props.scanType);

      // Start camera first if not already started
      if(!cameraOn.value) {
        console.log('scanAny: Camera not started, starting camera first...');
        await startCamera();
      }

      // Perform single scan
      return performScan({ singleScan: true });
    }

    return {
      loading,
      scanning,
      cameraError,
      cameraList,
      capabilities,
      cameraConstraints,
      cameraOn,
      scanConfig,
      startCamera,
      handleClose,
      toggleTorch,
      onCameraChange,
      onZoomChange,
      onFileUpload,
      scanAny,
      stopCamera,
      scannerUIRef
    };
  }
};
</script>
