<template>
  <div class="q-pa-md">
    <h2>Optical Scanner Demo</h2>

    <!-- Document Type Selection -->
    <div class="q-mb-md">
      <q-card class="q-pa-md">
        <q-card-section>
          <div class="text-h6">Scan Configuration</div>
        </q-card-section>
        
        <q-card-section>
          <q-option-group
            v-model="scanType"
            :options="scanTypeOptions"
            color="primary"
            class="q-mb-md" />

          <!-- Scan Mode Selection -->
          <q-select
            v-model="scanMode"
            :options="scanModeOptions"
            label="Scan Mode"
            outlined
            emit-value
            map-options
            class="q-mb-md"
            dropdown-icon="none" />
        </q-card-section>
      </q-card>
    </div>

    <!-- Architecture Info -->
    <div class="q-mb-md">
      <q-card class="bg-blue-1">
        <q-card-section>
          <div class="text-subtitle2 text-blue-8">Architecture Flow:</div>
          <div class="text-body2 text-blue-7">
            Vue (UI Only) → CameraScanner (Business Logic) → OpticalScanner (Core Engine) → Plugins (Format-Specific)
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Start Scanner Button -->
    <div class="q-mb-md text-center">
      <q-btn
        color="primary"
        size="lg"
        label="Start Scanner"
        @click="openScanner" />
    </div>

    <!-- Current Configuration Display -->
    <div class="q-mb-md">
      <q-card class="bg-grey-1">
        <q-card-section>
          <div class="text-subtitle2">Current Configuration:</div>
          <div class="text-body2">
            <strong>Scan Type:</strong> {{ scanType }}<br>
            <strong>Scan Mode:</strong> {{ scanMode }}<br>
            <strong>License Key:</strong> {{ licenseKey ? 'Configured' : 'Not configured' }}<br>
            <strong>Expected Behavior:</strong> {{ expectedBehavior }}
          </div>
        </q-card-section>
      </q-card>
    </div>


    <!-- Scanner Modal -->
    <q-dialog
      v-model="scannerOpen"
      maximized
      transition-show="slide-up"
      transition-hide="slide-down">
      <OpticalScanner
        v-if="scannerOpen"
        ref="scanner"
        :scan-type="scanType"
        :license-key="licenseKey"
        :tip-text="tipText"
        @result="onResult"
        @error="onError"
        @close="scannerOpen = false" />
    </q-dialog>

    <!-- Result Display -->
    <div
      v-if="scanResult"
      class="q-mt-md">
      <q-card>
        <q-card-section class="bg-green-1">
          <div class="text-h6 text-green-8">
            Scan Result
          </div>
        </q-card-section>

        <q-card-section>
          <!-- Architecture Success Message -->
          <q-banner class="bg-blue-1 text-blue-8 q-mb-md">
            <div class="text-body2">
              <strong>Architecture Test Passed!</strong><br>
              Vue → CameraScanner → OpticalScanner → Plugins delegation worked successfully
            </div>
          </q-banner>

          <!-- Scan Metadata -->
          <div class="q-mb-md">
            <strong>Scan Type:</strong> {{ scanResult.scanType || 'Unknown' }}<br>
            <strong>Format Detected:</strong> {{ scanResult.format || scanResult.type }}<br>
            <strong>Timestamp:</strong> {{ scanResult.timestamp || 'Not provided' }}<br>
            <strong>Success:</strong> {{ scanResult.success ? 'Yes' : 'No' }}
          </div>

          <!-- MRZ Results -->
          <div v-if="scanResult.type === 'MRZ'">
            <q-separator class="q-mb-md" />
            <div class="text-subtitle1 text-blue-8 q-mb-sm">MRZ Document Data:</div>
            
            <div
              v-if="scanResult.valid"
              class="text-green text-subtitle2 q-mb-sm">
              MRZ Validation: Valid
            </div>
            <div
              v-else
              class="text-red text-subtitle2 q-mb-sm">
              MRZ Validation: Invalid
            </div>
            
            <q-list dense>
              <q-item
                v-for="(value, key) in scanResult.fields"
                :key="key"
                class="q-py-xs">
                <q-item-section>
                  <strong>{{ formatFieldName(key) }}:</strong> {{ value || 'N/A' }}
                </q-item-section>
              </q-item>
            </q-list>

            <!-- Validation Details -->
            <div v-if="scanResult.validation" class="q-mt-md">
              <q-card class="bg-grey-1">
                <q-card-section class="bg-grey-3">
                  <div class="text-subtitle2">
                    Validation Details
                    <q-icon name="info" class="q-ml-sm" />
                  </div>
                </q-card-section>
                <q-card-section class="q-pa-none">
                  <div style="
                    max-height: 250px;
                    overflow: auto;
                    border-top: 1px solid rgba(0,0,0,0.1);
                  ">
                    <div style="padding: 16px;">
                      <div><strong>Overall Status:</strong> {{ scanResult.validation.overallStatus }}</div>
                      <div v-if="scanResult.validation.statistics">
                        <strong>Completeness:</strong> {{ scanResult.validation.statistics.overallCompleteness }}%
                      </div>
                      <div v-if="scanResult.invalidFields && scanResult.invalidFields.length > 0">
                        <strong>Invalid Fields:</strong> {{ scanResult.invalidFields.join(', ') }}
                      </div>
                    </div>
                  </div>
                </q-card-section>
              </q-card>
            </div>
          </div>

          <!-- Driver License Results -->
          <div v-else-if="scanResult.type === 'DL'">
            <q-separator class="q-mb-md" />
            <div class="text-subtitle1 text-purple-8 q-mb-sm">Driver License Data:</div>
            
            <q-list dense>
              <q-item
                v-for="(fieldData, key) in scanResult.fields"
                :key="key"
                class="q-py-xs">
                <q-item-section>
                  <strong>{{ key }}:</strong> 
                  {{ formatDriverLicenseField(fieldData) }}
                </q-item-section>
              </q-item>
            </q-list>
          </div>

          <!-- Standard Barcode Results -->
          <div v-else>
            <q-separator class="q-mb-md" />
            <div class="text-subtitle1 text-orange-8 q-mb-sm">Barcode Content:</div>
            <div class="bg-grey-1 q-pa-md rounded-borders">
              <pre style="white-space: pre-wrap; word-break: break-all;">{{ scanResult.text || 'No text content' }}</pre>
            </div>
          </div>

          <!-- Raw Data (Debug) -->
          <q-card class="bg-grey-2 q-mt-md">
            <q-card-section class="bg-grey-3">
              <div class="text-subtitle2">
                🛠️ Raw Scan Data (Debug)
                <q-icon name="code" class="q-ml-sm" />
              </div>
            </q-card-section>
            <q-card-section class="q-pa-none">
              <div style="
                max-height: 250px;
                overflow: auto;
                border-top: 1px solid rgba(0,0,0,0.1);
              ">
                <pre style="
                  white-space: pre-wrap; 
                  font-size: 12px;
                  word-break: break-all;
                  margin: 0;
                  padding: 16px;
                ">{{ JSON.stringify(scanResult, null, 2) }}</pre>
              </div>
            </q-card-section>
          </q-card>
        </q-card-section>
     
      </q-card>
    </div>

    <!-- Error Display -->
    <div
      v-if="scanError"
      class="q-mt-md">
      <q-card class="bg-red-1">
        <q-card-section>
          <div class="text-h6 text-red-8">
            Scan Error
          </div>
          <div class="text-red-8 q-mt-sm">
            <strong>Message:</strong> {{ scanError.message || scanError }}<br>
            <strong>Code:</strong> {{ scanError.code || 'Unknown' }}
          </div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script>
// V3
import OpticalScanner from '../../components/OpticalScanner.vue';
import {computed, ref} from 'vue';

export default {
  name: 'ScannerDemo',
  components: {OpticalScanner},
  setup() {
    // Add real license key
    // eslint-disable-next-line max-len
    const licenseKey = '';

    const scanner = ref(null);
    const scannerOpen = ref(false);
    const scanResult = ref(null);
    const scanError = ref(null);

    // Configuration options
    const scanType = ref('barcode'); // Default to barcode
    const scanMode = ref('first');
    const scanTypeOptions = [
      {label: 'Auto-Detect (All Formats)', value: 'auto'},
      {label: 'Passport / ID Card (MRZ)', value: 'mrz'},
      {label: 'QR Code / PDF417 Barcode', value: 'barcode'}
    ];
    const scanModeOptions = [
      {label: 'First Match (Recommended)', value: 'first'},
      {label: 'All Formats', value: 'all'},
      {label: 'Exhaustive Scan', value: 'exhaustive'}
    ];

    // Dynamic tip text based on scan type
    const tipText = computed(() => {
      if (scanType.value === 'mrz') {
        return 'Position passport or ID card MRZ area in the frame';
      } else {
        return 'Position QR code or barcode within the frame';
      }
    });

    // Expected behavior description
    const expectedBehavior = computed(() => {
      if (scanType.value === 'mrz') {
        if (licenseKey) {
          return 'Dynamsoft native camera UI with document detection';
        } else {
          return 'Will show license key error - MRZ requires valid license';
        }
      } else {
        return 'Video stream with Vue overlay guides for barcodes';
      }
    });

    function openScanner() {
      console.log('openScanner called with config:', {
        scanType: scanType.value,
        scanMode: scanMode.value,
        hasLicense: !!licenseKey
      });
      // Clear previous results
      scanResult.value = null;
      scanError.value = null;
      // Open scanner
      scannerOpen.value = true;
      // The refactored OpticalScanner will handle its own lifecycle
    }

    function onResult(result) {
      scanResult.value = result;
      scanError.value = null; // Clear any previous errors
      scannerOpen.value = false;
    }

    function onError(error) {
      scanError.value = error.message || 'Error occurred';
      scanResult.value = null;
    }

    // Helper functions for display
    function formatFieldName(fieldName) {
      // Convert camelCase to readable format
      return fieldName
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase());
    }

    function formatDriverLicenseField(fieldData) {
      if (typeof fieldData === 'string') {
        return fieldData;
      }
      
      if (fieldData && typeof fieldData === 'object') {
        if (fieldData.value) {
          return `${fieldData.value}${fieldData.description ? ` (${fieldData.description})` : ''}`;
        }
        return JSON.stringify(fieldData);
      }
      
      return fieldData || 'N/A';
    }

    return {
      scanner,
      scannerOpen,
      scanResult,
      scanError,
      scanType,
      scanMode,
      scanTypeOptions,
      scanModeOptions,
      tipText,
      expectedBehavior,
      licenseKey,
      openScanner,
      onResult,
      onError,
      formatFieldName,
      formatDriverLicenseField
    };
  }
};
</script>

<style scoped>
.q-card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

pre {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
}
</style>