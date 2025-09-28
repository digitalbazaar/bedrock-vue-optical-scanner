# @bedrock/vue-optical-scanner

A Vue.js component library for optical scanning that provides reusable UI components
for barcode, QR code, MRZ (Machine Readable Zone), and other optical code scanning.
This library follows a plugin-based architecture and separates scanning logic from
UI components.

## Architecture

This library is part of a two-tier architecture for optical scanning:

### Core Libraries

- **@bedrock/web-optical-scanner**: Low-level scanning engine with plugin architecture
  - **CameraScanner**: High-level abstraction for camera management and continuous scanning
  - **OpticalScanner**: Core scanning engine with plugin system
- **@bedrock/vue-optical-scanner**: Vue-specific UI components (this library)

### Architecture Benefits

#### Separation of Concerns

- **Vue Layer**: Handles only UI presentation, Quasar integration, and Vue-specific reactivity
- **Web Module**: Manages all scanning logic, camera control, and business rules
- **Clean Delegation**: Vue components pass containers to CameraScanner and handle results via events

#### Framework Agnostic Design

- All scanning improvements happen in one place (web module)
- Vue components can be rapidly duplicated for React, Angular, etc.
- Framework wrappers focus only on what frameworks do best (UI, reactivity, styling)

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

#### Vue UI Components (Thin Wrappers)

This library provides:

- **Thin wrapper components** that delegate all scanning complexity to CameraScanner
- Vue-specific UI components focused purely on presentation and framework integration
- Camera display containers that CameraScanner manages internally
- Simple prop-based configuration (scanType, scanMode, licenseKey)
- Event-based result handling with no business logic in Vue layer
- **Easy duplication**: Components designed for rapid porting to React/other frameworks

### Supported Formats

- **QR Codes**: Standard QR code scanning
- **PDF417**: Standard PDF417 barcode format
- **Enhanced PDF417**: Advanced PDF417 with additional processing for driver licenses
- **MRZ**: Machine Readable Zone for passports and ID documents

## Components

### OpticalScanner

A thin wrapper component that delegates camera and scanning operations to CameraScanner from `@bedrock/web-optical-scanner`.

**Architecture**: This component provides Vue-specific UI and event handling while CameraScanner handles all scanning complexity internally.

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
import {OpticalScanner} from '@bedrock/vue-optical-scanner';
// OpticalScanner uses CameraScanner delegation internally

export default {
  components: {OpticalScanner},
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
