<template>
  <div class="q-pa-md">
    <!-- Add this scan type selection section -->
    <div class="q-mb-md">
      <div class="text-h6 q-mb-sm">
        Select Document Type
      </div>
      <q-option-group
        v-model="scanType"
        :options="scanTypeOptions"
        color="primary"
        inline />
    </div>
    <!-- Controls row, always visible -->

    <div class="row q-gutter-sm q-mb-md">
      <q-btn
        label="Start Scan"
        color="primary"
        @click="openScanner" />
      <q-btn
        label="Stop Scan"
        color="negative"
        @click="stopScanner" />
    </div>

    <!-- Scanner Modal -->
    <q-dialog
      v-model="scannerOpen"
      maximized
      persistent>
      <OpticalScanner
        v-if="scannerOpen"
        ref="scanner"
        :scan-mode="first"
        :scan-type="scanType"
        :license-key="licenseKey"
        tip-text="Position barcode or ID inside the frame"
        @result="onResult"
        @error="onError"
        @close="scannerOpen = false" />
    </q-dialog>

    <!-- Result Display -->
    <div
      v-if="scanResult"
      class="q-mt-md">
      <q-card>
        <q-card-section>
          <div class="text-h6">
            Scan Result
          </div>

          <!-- MRZ -->
          <div v-if="scanResult.type === 'MRZ'">
            <div
              v-if="scanResult.valid"
              class="text-green text-subtitle2">
              MRZ Valid
            </div>
            <div
              v-else
              class="text-red text-subtitle2">
              MRZ Invalid
            </div>
            <ul>
              <li
                v-for="(val, key) in scanResult.fields"
                :key="key">
                <strong>{{key}}:</strong> {{val}}
              </li>
            </ul>
          </div>

          <!-- Driver License -->
          <div v-else-if="scanResult.type === 'DL'">
            <ul>
              <li
                v-for="(val, key) in scanResult.fields"
                :key="key">
                <strong>{{key}}:</strong> {{val}}
              </li>
            </ul>
          </div>

          <!-- QR Code or PDF417 (plain text only) -->
          <div v-else>
            <p><strong>Type:</strong> {{scanResult.type}}</p>
            <p style="word-break: break-all; white-space: pre-wrap;">
              <strong>Data:</strong> {{scanResult.text}}
            </p>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Error Display -->
    <div
      v-if="scanError"
      class="q-mt-md text-red">
      <q-banner dense>
        {{scanError}}
      </q-banner>
    </div>
  </div>
</template>

<script>
import OpticalScanner from '../../components/OpticalScanner.vue';
import {ref} from 'vue';

export default {
  name: 'ScannerDemo',
  components: {OpticalScanner},
  setup() {
    const scanner = ref(null);
    const scannerOpen = ref(false);
    const scanResult = ref(null);
    const scanError = ref(null);

    // Add scan type selection
    const scanType = ref('barcode'); // Default to more common use case
    const scanTypeOptions = [
      {label: 'Passport / ID Card (MRZ)', value: 'mrz'},
      {label: 'QR Code / PDF417 Barcode', value: 'barcode'}
    ];

    // Add real license key
    // eslint-disable-next-line max-len
    const licenseKey = '';

    function openScanner() {
      console.log('openScanner called, scanType:', scanType.value);
      scanResult.value = null;
      scanError.value = null;
      scannerOpen.value = true;

      // Auto-start camera when modal opens (remove setTimeout)
      // Remove the scanAny() call here - let it happen naturally

      // Kick off scanAny after scanner is mounted
      setTimeout(async () => {
        console.log('setTimeout callback - scanner.value:', !!scanner.value);

        if(scanner.value) {
          try {
            console.log('About to call scanAny');
            // you can start camera explicitly
            // await scanner.value.startCamera();
            // then start scan
            await scanner.value.scanAny();
          } catch(err) {
            console.log('scanAny error:', err);
            scanError.value = err.message || 'Scan failed';
          }
        } else {
          console.log('scanner.value is null/undefined');
        }
      }, 2000);
    }

    function onResult(result) {
      scanResult.value = result;
      scanError.value = null; // Clear any previous errors
      scannerOpen.value = false;
    }

    function onError(error) {
      scanError.value = error.message || 'Error occurred';
    }

    function stopScanner() {
      if(scanner.value) {
        scanner.value.stopCamera();
      }
      // scannerOpen.value = false;
    }

    return {
      scanner,
      scannerOpen,
      scanResult,
      scanError,
      scanType,
      scanTypeOptions,
      licenseKey,
      openScanner,
      onResult,
      onError,
      stopScanner
    };
  }
};
</script>

<style>

/* Global styles - not scoped so they can affect Dynamsoft elements */
.mrz-scanner-main-container,
.mrz-scanner-scanner-view-container,
.dynamsoft-mrz-loading-screen {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 99999 !important;
  background: white !important;
}
</style>
