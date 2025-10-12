# bedrock-vue-optical-scanner ChangeLog

## 1.2.0 - 2025-mm-dd

### Changed

- **NOTE**: License key configuration moved from component props to `@bedrock/web/config`
  - Removed `licenseKey` prop from OpticalScanner component API
  - License keys now configured once in bedrock config, automatically read by components
  - Enables future removal of third-party dependencies without breaking changes
- Updated props documentation to clarify mode-specific behavior
  - `showQrBox` and `torchOn` props only apply to barcode/auto modes
  - MRZ mode uses Dynamsoft native UI (Vue overlays automatically disabled)

### Added

- Configuration section in README explaining bedrock config setup for license keys
- Troubleshooting section addressing common questions about mode-specific props
- Architecture documentation explaining license key management design rationale

### Improved

- Implemented `effectiveShowQrBox` computed property for mode-aware UI rendering
  - Automatically disables QR box overlay when MRZ mode is active
  - Makes mode-specific behavior explicit in code rather than implicit
- Enhanced PDF417 clarified as legacy feature accessible via `formats` prop override

## 1.1.0 - 2025-09-27

### Added

- **BREAKING**: Refactored Vue components to use CameraScanner delegation pattern
  - OpticalScanner.vue now uses CameraScanner from `bedrock-web-optical-scanner`
  - Thin wrapper architecture enables easy duplication in other frameworks

### Changed

- **NOTE**: Vue components are now thin wrappers focused purely on UI concerns
- ScannerUI.vue streamlined for pure framework integration
  - Clean separation between CameraScanner area and Vue overlay area
  - Removed scanning business logic to achieve framework-agnostic design
- Configuration simplified to scanType/scanMode props instead of complex plugin setup

### Improved

- All scanning complexity now delegated to `bedrock-web-optical-scanner` module
- Vue components leverage framework-specific features (Quasar UI, reactivity) without scanning logic
- Architecture enables rapid React/other framework development with minimal duplication
- Better separation of concerns between presentation layer and scanning engine

## 1.0.0 - 2025-09-14

### Added

- Vue.js components `OpticalScanner.vue` and `ScannerUI.vue` with reactive state management.
- Scan type selection interface allowing users to choose between barcode/QR scanning and MRZ document scanning.
- Timeout configuration system with format-specific timeouts (no timeout for MRZ camera mode, configurable timeouts for other formats).
