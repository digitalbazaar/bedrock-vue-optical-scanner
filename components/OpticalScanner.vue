<template>
  <ScannerUI
    ref="scannerUIRef"
    :tip-text="tipText"
    :show-qr-box="showQrBox"
    :formats="scanConfig.formats"
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
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import {
  cameraUtils,
  OpticalScanner as CoreScanner,
  enhancedPdf417Plugin,
  mrzPlugin,
  pdf417Plugin,
  qrCodePlugin
} from '@bedrock/web-optical-scanner';
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
    // Store plugin options for reuse
    let scannerPluginOptions = null;
    // State management
    let stream = null;
    let abortController = new AbortController();

    const scannerUIRef = ref(null);
    const video = ref(null);
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

    // Scanner instance
    let opticalScanner = null;

    const cameraOn = computed(() => !!stream);

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
      // wait a tick so Quasar dialog finishes DOM
      // Usually not needed, but it helps if Quasar lazy-renders slots.
      // await Promise.resolve();
      // await startCamera();
    });

    onBeforeUnmount(() => {
      stopCamera();
    });

    // --- Initialization ---
    async function initializeScanner() {
      // const plugins = getPluginsForFormats(props.formats);
      const plugins = getPluginsForFormats(scanConfig.value.formats);
      console.log('Initializing scanner with plugins:', plugins);
      console.log('Scan type:', props.scanType);
      console.log('Derived formats:', scanConfig.value.formats);
      // console.log('Formats requested:', props.formats);

      // === Dynamsoft Native Camera UI Configuration Options ===
      const scannerViewConfig = {
        enableAutoCapture: true, // Manual capture (like working example)
        autoCaptureSensitivity: 0.8, // Detection sensitivity
        documentDetection: true, // Focus on document detection
        stableDetectionCount: 3, // Require consistent detections
        showScanGuide: true, // Show scanning guide
        showUploadImage: true, // Allow image upload
        showFormatSelector: false, // Hide format selector
        showSoundToggle: true, // Show sound toggle
        showPoweredByDynamsoft: true // Show branding
      };

      const resultViewConfig = {
        // The plugin will add onDone handler automatically
        showResult: true, // Show result screen
        enableResultVerification: true // Allow result editing
      };

      // Update plugin options to use computed config
      scannerPluginOptions = {
        mrz: props.licenseKey ? {
          licenseKey: props.licenseKey,
          mrzMode: scanConfig.value.mrzMode,
          scannerConfig: {
            scannerViewConfig,
            resultViewConfig
          }
        } : undefined,
        pdf417_enhanced: props.licenseKey ? {
          licenseKey: props.licenseKey,
          useDynamsoft: true,
          parseDL: true
        } : undefined
      };

      // === first iteration starts - working code ===

      // Store pluginOptions for later reuse
      // FIXME: parameterize mrzMode down the line
      // scannerPluginOptions = {
      //   mrz: props.licenseKey ? {
      //     licenseKey: props.licenseKey,
      //     mrzMode: 'camera', // for Dynamsoft Native UI -- Working smoothly
      //     // mrzMode: 'element', // for custom UI -- FIXME - not working
      //     scannerConfig: {
      //       scannerViewConfig,
      //       resultViewConfig
      //     }
      //     // TODO: Comeback - below parameters are not fully configured
      //     // timeout: 25000, // Plugin-level timeout
      //     // returnCroppedImage: false, // Faster processing
      //   } : undefined,
      //   pdf417_enhanced: props.licenseKey ? {
      //     licenseKey: props.licenseKey,
      //     useDynamsoft: true,
      //     parseDL: true
      //   } : undefined
      // };

      // === first iteration ends - working code ===

      // OpticalScanner Instance Initialization
      opticalScanner = new CoreScanner({
        plugins,
        pluginOptions: scannerPluginOptions
      });

      console.log('Scanner initialized, supported formats:',
        opticalScanner.getSupportedFormats());
    }

    function getPluginsForFormats(formats) {
      const pluginMap = {
        qr_code: qrCodePlugin,
        pdf417: pdf417Plugin,
        pdf417_enhanced: enhancedPdf417Plugin,
        mrz: mrzPlugin
      };

      return formats
        .filter(format => pluginMap[format])
        .map(format => pluginMap[format]);
    }

    // --- Camera Management ---
    async function startCamera({
      constraints, skipContinuousScanning = false} = {}) {

      console.log('startCamera called in OpticalScanner');

      if(stream) {
        stopCamera();
      }

      loading.value = true;
      cameraError.value = false;

      try {
        // FIXME -- DO NOT HARDCODE -- update it bedrock-web-optical-scanner lib
        // const defaultConstraints = cameraUtils.getDefaultConstraints();
        const defaultConstraints = {
          video: {
            facingMode: 'environment',
            width: {ideal: 1920, min: 1280},
            height: {ideal: 1080, min: 720},
            frameRate: {ideal: 30},
            focusMode: 'continuous',
            exposureMode: 'continuous'
          }
        };
        const finalConstraints = constraints || defaultConstraints;
        console.log('Startnig the camera with final constraints:',
          finalConstraints);

        stream = await cameraUtils.startCameraStream(finalConstraints);

        // Use existing video element from ScannerUI template
        // video.value = document.querySelector('#optical-scanner-video');
        video.value = scannerUIRef.value?.videoRef;
        if(!video.value) {
          throw new Error('Video element not found in DOM');
        }

        // Set video source on existing element
        video.value.srcObject = stream;

        // Wait for video to load
        await new Promise((resolve, reject) => {
          video.value.onloadedmetadata = () => resolve();
          video.value.onerror = () => reject(new Error('Failed to load video'));
          setTimeout(() => reject(new Error('Video load timeout')), 12000);
        });

        getCapabilities();
        await getCameraList();
        // Only start continuous scanning if not skipped
        if(!skipContinuousScanning) {
          startContinuousScanning();
        } else {
          console.log('Skipping continuous scanning for MRZ camera mode');
        }

      } catch(error) {
        console.error('Could not start camera:', error);
        cameraError.value = true;
        emit('error', {
          message: 'Could not access camera',
          code: 'CAMERA_ACCESS_DENIED'
        });
      } finally {
        loading.value = false;
      }
    }

    async function getCameraList() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        cameraList.value = devices.filter(device =>
          device.kind === 'videoinput'
        );
      } catch(error) {
        console.error('Unable to get camera list', error);
        cameraList.value = [];
      }
    }

    function stopCamera() {
      abortController.abort();
      abortController = new AbortController();

      if(stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }

      if(video.value) {
        video.value.srcObject = null;
      }
      scanning.value = false;
    }

    function getCapabilities() {
      if(!stream) {
        return;
      }

      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities();

      capabilities.zoom = !!caps.zoom;
      capabilities.torch = !!caps.torch;

      if(caps.zoom) {
        const {max = 8, min = 1, step = 1} = caps.zoom;
        Object.assign(cameraConstraints.zoom, {min, max, step});
      }
    }

    // --- Core Scanning ---
    async function performScan(scanOptions, timeoutMs = 15000) {
      console.log('=== SCAN OPTIONS ===');
      console.log('Requested formats:', scanOptions.formats);
      console.log('Plugin options:', scannerPluginOptions);
      console.log('License key provided:', !!props.licenseKey);
      console.log('=====================');

      // Format-specific timeout logic
      if(scanOptions.formats.includes('mrz')) {
        // Check if it's camera mode
        const isMrzCameraMode = scannerPluginOptions?.mrz?.mrzMode === 'camera';
        if(isMrzCameraMode) {
          timeoutMs = 0; // No timeout for camera mode
          console.log('Using NO timeout for MRZ camera mode');
        } else {
          timeoutMs = 30000; // Keep timeout for element mode
          console.log('Using MRZ timeout:', timeoutMs);
        }
      } else if(scanOptions.formats.includes('pdf417_enhanced')) {
        timeoutMs = 20000; // 20 seconds for enhanced PDF417
        console.log('Using enhanced PDF417 timeout:', timeoutMs);
      } else if(timeoutMs === 15000) {
        // 10 seconds for QR/basic PDF417 (only if using default)
        timeoutMs = 10000;
        console.log('Using standard timeout:', timeoutMs);
      }

      scanning.value = true;
      const {signal} = abortController;

      // Add minimum scan duration for better UX
      const minScanTime = 1500; // 1.5 seconds
      const scanStartTime = Date.now();

      let timeout;
      let scanSucceeded = false;

      try {
        const scanPromise =
          opticalScanner.scan(
            video.value,
            {...scanOptions, pluginOptions: scannerPluginOptions, signal}
          );
        // Only create timeout promise if timeoutMs > 0
        const promises = [scanPromise];
        if(timeoutMs > 0) {
          const timeoutPromise = new Promise((_, reject) => {
            timeout = setTimeout(() =>
              reject(new Error('SCAN_TIMEOUT')), timeoutMs);
          });
          promises.push(timeoutPromise);
        }

        const results = await Promise.race(promises);

        // Skip minimum time for MRZ formats
        const needsMinTime = !scanOptions.formats.includes('mrz');

        // Ensure minimum scan duration
        const elapsedTime = Date.now() - scanStartTime;
        if(needsMinTime && elapsedTime < minScanTime) {
          await new Promise(resolve =>
            setTimeout(resolve, minScanTime - elapsedTime));
        }

        console.log('Scan results (raw):', results);

        if(results && results.length > 0) {
          scanSucceeded = true; // Mark as succeeded before stopCamera()
          console.log('=== RAW MRZ DATA ===');
          console.log('Raw result:', results[0]);
          console.log('Raw MRZ fields:',
            results[0].data?.[0]?.data || results[0]);
          console.log('==================');
          const result = formatResult(results[0]);
          console.log('Formatted result:', result);

          // Stop camera when result found
          stopCamera();
          emit('result', result);
          return result;
        } else {
          console.warn('NO_RESULTS from scan');
          throw new Error('NO_RESULTS');
        }
      } catch(error) {
        console.error('Scan error:', error);
        // Don't log AbortError if scan already succeeded
        if(!(error.name === 'AbortError' && scanSucceeded)) {
          console.error('Scan error:', error);
        }

        // Handle errors, but ignore AbortError after successful scan
        if(error.name === 'AbortError' && scanSucceeded) {
          // This is cleanup after successful scan, not a real error
          return;
        }

        if(error.message === 'SCAN_TIMEOUT') {
          emit('error',
            {message: 'Scan timed out, try again', code: 'SCAN_TIMEOUT'});
        } else if(error.message === 'NO_RESULTS') {
          emit('error', {message: 'No results found', code: 'NO_RESULTS'});
        } else if(error.name !== 'AbortError') {
          emit('error', {message: 'Scanning failed', code: 'SCAN_ERROR'});
        }
      } finally {
        clearTimeout(timeout);
        scanning.value = false;
      }
    }

    let attempt = 0;
    async function startContinuousScanning() {
      if(!video.value || !opticalScanner) {
        console.log('Missing video or scanner:',
          {video: !!video.value, scanner: !!opticalScanner});
        return;
      }

      // Filter out MRZ from continuous scanning
      // const continuousFormats = props.formats.filter(f => f !== 'mrz');

      // // Only run continuous scanning if non-MRZ formats exist
      // if(continuousFormats.length === 0) {
      //   console.log('No continuous scan formats available');
      //   return;
      // }

      while(stream && video.value && opticalScanner) {
        attempt++;
        console.log('Scan attempt #', attempt, 'video size:',
          video.value?.videoWidth, 'x', video.value?.videoHeight);

        try {
          console.log('Perform Scan: Scan Mode - ', props.scanMode);
          // performScan will add the stored scannerPluginOptions
          await performScan({
            // formats: continuousFormats, // Exclude MRZ
            formats: opticalScanner.getSupportedFormats(), // All formats
            mode: props.scanMode
          });
        } catch(_) {
          // handled in performScan
        }
        // Small delay to prevent locking browser
        await new Promise(r => setTimeout(r, 2500));
      }
    }

    // FIXME - DID NOT WORKED AS EXPECTED
    // async function scanMRZ() {
    //   console.log('Starting on-demand MRZ scan');
    //   return performScan({
    //     formats: ['mrz'],
    //     mode: 'first'
    //   }, 30000); // 30-second timeout for MRZ
    // }

    // --- Format Helpers ---
    function formatResult(result) {
      console.log('=== RAW RESULT STRUCTURE ===');
      console.log('Format:', result.format);
      console.log('Full result object:', result);
      console.log('result.data:', result.data);
      console.log('=== END RAW RESULT ===');
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
      console.log('result.data[0]:', result.data?.[0]);
      console.log('result.data[0].data:', result.data?.[0]?.data);
      console.log('result.data[0].metadata:', result.data?.[0]?.metadata);
      console.log('result.data[0].validation:', result.data?.[0]?.validation);
      console.log('============================');

      const mrzData = result.data?.[0]?.data || {};
      const validation = result.data?.[0]?.data?.validation ||
        result.data?.[0]?.validation || {};
      const invalidFields = result.data?.[0]?.data?.invalidFields ||
        result.data?.[0]?.invalidFields || [];

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
      if(!files || files.length === 0 || !opticalScanner) {
        return;
      }

      scanning.value = true;

      try {
        for(const file of files) {
          const results = await opticalScanner.scan(file, {
            // formats: props.formats,
            formats: scanConfig.value.formats, // Use computed formats
            mode: props.scanMode
          });

          if(results && results.length > 0) {
            const result = results[0];
            // Convert to expected format for existing handleScan method
            const convertedResult = {
              type: FORMAT_TO_HTML5QRCODE_MAP[result.format] || result.format,
              text: result.text
            };
            emit('result', convertedResult);
            break;
          }
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
      if(!stream) {
        return;
      }

      cameraTorch.value = !cameraTorch.value;

      try {
        await cameraUtils.applyCameraConstraints(stream, {
          torch: cameraTorch.value
        });
      } catch(error) {
        console.error('Torch error:', error);
      }
    }

    async function onCameraChange(deviceId) {
      const constraints = {
        video: {
          deviceId: {exact: deviceId},
          width: {ideal: 1280},
          height: {ideal: 720}
        }
      };
      await startCamera({constraints});
    }

    async function onZoomChange(zoomLevel) {
      if(!stream) {
        return;
      }

      try {
        await cameraUtils.applyCameraConstraints(stream, {
          zoom: zoomLevel
        });
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
      // console.log('scanAny called, cameraOn:', cameraOn.value);
      console.log('scanAny called, scanType:',
        props.scanType, 'cameraOn:', cameraOn.value);

      // Use computed scanConfig instead of checking formats directly
      const isMrzCameraMode = props.scanType === 'mrz';

      // === first iteration starts - working code ===

      // Check for MRZ camera mode FIRST (before starting camera)
      // const isMrzCameraMode =
      //   scannerPluginOptions?.mrz?.mrzMode === 'camera' &&
      //   props.formats.includes('mrz');

      // === first iteration ends - working code ===

      // Start camera first if not already started
      if(!cameraOn.value) {
        console.log('scanAny: Camera not started, starting camera first...');
        // Pass isMrzCameraMode flag to prevent continuous scanning
        // await startCamera({skipContinuousScanning: isMrzCameraMode});
        await startCamera({
          skipContinuousScanning: !scanConfig.value.useContinuousScanning
        });
      }

      // Check for MRZ camera mode
      if(isMrzCameraMode) {
        console.log('Launching Dynamsoft camera UI for MRZ scanning...');
        return performScan({
          formats: ['mrz'],
          mode: 'first'
        }, 0); // Single scan with 0 timeout
      }
      // Logic for other qr_code or pdf417 barcode scanning
      console.log('Using continuous scanning for barcode types');
      return performScan({
        // formats: opticalScanner.getSupportedFormats(),
        formats: scanConfig.value.formats,
        mode: props.scanMode
      },
      timeoutMs);
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
      // scanMRZ
    };
  }
};
</script>
