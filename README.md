# @bedrock/vue-optical-scanner

A Vue.js component library for optical scanning that provides reusable UI components
for barcode, QR code, MRZ (Machine Readable Zone), and other optical code scanning.
This library follows a plugin-based architecture and separates scanning logic from
UI components.

## Architecture

This library is part of a two-tier architecture for optical scanning:

### Core Libraries

- **@bedrock/web-optical-scanner**: Low-level scanning engine with plugin architecture
- **@bedrock/vue-optical-scanner**: Vue-specific UI components (this library)

### Architecture Principles

#### Plugin-Based Scanning Engine

The underlying `@bedrock/web-optical-scanner` provides:

- Async API that accepts elements/images and options, returns scan results
- Multiple scan modes:
  - `first`: Resolves as soon as any specified format is detected
  - `all`: Resolves when all specified formats have results
  - `exhaustive`: Resolves after all plugins have completed their efforts
- Extensible plugin system for adding new scanning formats
- Future-ready for web worker threading (API designed to support this)

#### Vue UI Components

This library provides:

- Reusable Vue components for optical scanning interfaces
- Camera handling utilities and helpers
- Simple APIs with input props and async event outputs
- Modular components that can be used independently or together

### Supported Formats

- **QR Codes**: Standard QR code scanning
- **PDF417**: Standard PDF417 barcode format
- **Enhanced PDF417**: Advanced PDF417 with additional processing for driver licenses
- **MRZ**: Machine Readable Zone for passports and ID documents

## Components

### OpticalScanner

The main scanning component that orchestrates camera access and scanning operations.

**Props:**

- `scanType` (required): `'mrz'` or `'barcode'`
- `scanMode`: `'first'` (default), `'all'`, or `'exhaustive'`
- `tipText`: Instruction text for users
- `showQrBox`: Boolean to show/hide scanning frame overlay
- `torchOn`: Boolean to control camera flash
- `licenseKey`: Dynamsoft License key for enhanced scanning features

**Events:**

- `@result`: Emitted when scan is successful
- `@error`: Emitted when scan fails
- `@close`: Emitted when scanner is closed

### ScannerUI

Lower-level UI component that handles camera display and controls.

## Usage

### Basic Usage

```vue
<template>
  <div>
    <q-btn @click="openScanner">Start Scan</q-btn>
    
    <q-dialog v-model="scannerOpen" maximized>
      <OpticalScanner
        scan-type="barcode"
        scan-mode="first"
        @result="onResult"
        @error="onError"
        @close="scannerOpen = false"
      />
    </q-dialog>
  </div>
</template>

<script>
import { OpticalScanner } from '@bedrock/vue-optical-scanner';

export default {
  components: { OpticalScanner },
  data() {
    return {
      scannerOpen: false
    };
  },
  methods: {
    onResult(result) {
      console.log('Scan result:', result);
      this.scannerOpen = false;
    },
    onError(error) {
      console.error('Scan error:', error);
    }
  }
};
</script>
```

ScannerDemo Component
The ScannerDemo component provides a complete example implementation showing:

- Document type selection (MRZ vs Barcode)
- Scanner controls and modal integration
- Result display for different scan types
- Error handling

Key Features Demonstrated:

- MRZ Scanning: Passport and ID document recognition with field validation
- Barcode Scanning: QR codes, PDF417, and enhanced PDF417 for driver licenses
- Result Processing: Type-specific result handling and display
- Camera Management: Start/stop controls with proper lifecycle management

Usage in Demo:

```vue
<template>
  <!-- Document type selection -->
  <q-option-group v-model="scanType" :options="scanTypeOptions" />
  
  <!-- Scanner integration -->
  <OpticalScanner
    :scan-type="scanType"
    :scan-mode="scanMode"
    @result="onResult"
    @error="onError"
  />
</template>
```

Installation

```bash
npm install @bedrock/vue-optical-scanner
```

Peer Dependencies

```bash
npm install vue@^3.4.21 @bedrock/quasar@^10.0.0 @bedrock/web-fontawesome@^2.0.0
```

Development Setup
Prerequisites

- Node.js >= 20
- npm or yarn

Getting Started

1. Clone and install dependencies:

```bash
git clone URL
cd vue-optical-scanner
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Access the demo: Navigate to `http://localhost:5173` to see the ScannerDemo component in action.

Development Scripts

```bash
# Start development server with hot reload
npm run dev

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```
