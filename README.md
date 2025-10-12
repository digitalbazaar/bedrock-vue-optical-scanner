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

### License Key Management

License keys are managed through bedrock config rather than component props:

**Why This Design?**

- **Separation of Concerns:** License keys are deployment/environment concerns, not component concerns
- **Future-Proof:** Makes it easy to swap scanning providers without changing component APIs
- **No Breaking Changes:** Can remove third-party dependencies without affecting component usage
- **Single Source of Truth:** Configure once in app config, use everywhere

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
- Simple prop-based configuration (scanType, scanMode, etc.)
- Event-based result handling with no business logic in Vue layer
- **Easy duplication**: Components designed for rapid porting to React/other frameworks

### Supported Formats

- **QR Codes**: Standard QR code scanning (open-source)
- **PDF417**: Standard PDF417 barcode format (open-source)
- **MRZ**: Machine Readable Zone for passports and ID documents (requires license)

**Advanced/Legacy:**

- **PDF417 Enhanced**: Advanced PDF417 with driver license parsing (accessible via `formats` prop
    which override scanType prop value.)
  - Used for backward compatibility with older implementations or if end client requests to use dynamsoft
    for PDF417 scan over open source PDF417 scan.
  - Requires Dynamsoft license if using Dynamsoft engine
  - Not exposed in public API by default

## Configuration

### License Key Setup (Required for MRZ Scanning)

MRZ scanning requires a Dynamsoft license key. Configure it in bedrock app's config:

**File:** By default, it is `bedrock-web-optical-scanner/lib/config.js`. However, for a differet app/use case it can be - `your-app/lib/config.js`.

```javascript
import {config} from '@bedrock/web';

config.opticalScanner = {
  thirdParty: {
    dynamsoft: {
      licenseKey: 'YOUR-DYNAMSOFT-LICENSE-KEY-HERE'
    }
  }
};

// Component reads automatically
const licenseKey = getDynamsoftLicense();  // From @bedrock/web-optical-scanner
```

**Note:** The component automatically reads the license from config and do not need to pass it as a prop.

## Components

### OpticalScanner

A thin wrapper component that delegates camera and scanning operations to CameraScanner from `@bedrock/web-optical-scanner`.

**Architecture**: This component provides Vue-specific UI and event handling while CameraScanner handles all scanning complexity internally.

#### Core Props (All Modes)

- **`scanType`** (required): `'mrz'`, `'barcode'`, or `'auto'`
  - `'mrz'`: Passport/ID card scanning
  - `'barcode'`: QR codes and PDF417 barcodes
  - `'auto'`: Auto-detect any supported format

- **`scanMode`**: `'first'` (default), `'all'`, or `'exhaustive'`
  - `'first'`: Return as soon as any format is detected
  - `'all'`: Return when all specified formats found
  - `'exhaustive'`: Let all plugins complete their attempts

- **`tipText`**: Instruction text shown to users

#### Barcode-Specific Props

**Note:** These props only apply to `'barcode'` and `'auto'` modes. `showQrBox` prop value is automatically ignored for `'mrz'` mode (which uses Dynamsoft's native UI).

- **`showQrBox`** (Boolean, default: `true`): Show yellow scanning overlay guide
- **`torchOn`** (Boolean, default: `false`): Enable camera flashlight on start

#### Advanced Props

- **`formats`** (Array|null, default: `null`): Override default formats for scanType
  - Example: `:formats="['pdf417_enhanced']"` for legacy driver license parsing
  - **Note:** This is for advanced use cases and legacy support only

**Props:**

- `scanType` (required): `'mrz'` or `'barcode'`
- `scanMode`: `'first'` (default), `'all'`, or `'exhaustive'`
- `tipText`: Instruction text for users
- `showQrBox`: Boolean to show/hide scanning frame overlay
- `torchOn`: Boolean to control camera flash

**Events:**

- `@result`: Emitted when scan is successful
- `@error`: Emitted when scan fails
- `@close`: Emitted when scanner is closed

### ScannerUI

Lower-level UI component that handles camera display and controls.

## Usage

### Basic Example - Barcode Scanning

```vue
<template>
  <div>
    <q-btn @click="openScanner">Scan Barcode</q-btn>
    
    <q-dialog v-model="scannerOpen" maximized>
      <OpticalScanner
        scan-type="barcode"
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

### Basic Example - MRZ Scanning (Passport/ID)

```vue
<template>
  <OpticalScanner
    scan-type="mrz"
    tip-text="Position passport MRZ area in frame"
    @result="onMrzResult"
    @error="onError"
  />
</template>

<script>
import {OpticalScanner} from '@bedrock/vue-optical-scanner';
// OpticalScanner uses CameraScanner delegation internally

export default {
  methods: {
    onMrzResult(result) {
      console.log('MRZ Data:', result.fields);
      // Access parsed fields: firstName, lastName, documentNumber, etc.
    }
  }
};
</script>
```

**Note:** MRZ scanning requires license key configuration (see Configuration section).

## Functional Demo App

ScannerDemo Component

The ScannerDemo component provides a complete example implementation showing:

- Document type selection (MRZ vs Barcode)
- Scanner controls and modal integration
- Result display for different scan types
- Error handling

Key Features Demonstrated:

- MRZ Scanning: Passport and ID document recognition with field validation
- Barcode Scanning: QR codes, and PDF417 for driver licenses
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

## Development Setup

### Prerequisites

- Node.js >= 20
- npm or yarn

### Getting Started

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

## Understanding Mode-Specific Props

**Question:** Why doesn't `showQrBox` work for MRZ mode?

**Answer:** Different scan types use different UI architectures:

| Scan Type | UI Architecture | Props Available |
|-----------|-----------------|-----------------|
| `barcode` | Vue-controlled video + overlays | `showQrBox`, `torchOn` |
| `mrz` | Dynamsoft native UI | None (Dynamsoft controls UI) |
| `auto` | Vue-controlled video + overlays | `showQrBox`, `torchOn` |

**Why the difference?**

- **Barcode mode:** Uses standard browser camera APIs...
- **MRZ mode:** Uses Dynamsoft's specialized document detection...
- **Auto mode:** Attempts all formats using browser APIs...

**Implementation Detail:** The component uses `effectiveShowQrBox` computed property...

## Troubleshooting | FAQ

### QR box doesn't show for MRZ scanning

**Expected behavior:** MRZ mode uses Dynamsoft's native UI, so Vue overlays (including QR box) are automatically disabled. This is correct behavior.
