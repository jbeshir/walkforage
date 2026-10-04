// Custom Expo config plugin that limits Android Auto Backup to the game save
//
// The save is one JSON blob in AsyncStorage. @react-native-async-storage/async-storage v2 keeps
// it in the SQLite database `RKStorage` (ReactDatabaseSupplier.DATABASE_NAME, opened through
// SQLiteOpenHelper, so it lives in the app's `databases/` directory). The Room-based "next
// storage" (database `AsyncStorage`) is only used when the gradle property
// AsyncStorage_useNextStorage is true, which this project does not set.
//
// Why the rules are needed: without them, Auto Backup includes every file the app owns,
// including the ~48 MB tiles.db that ExpoTileLoader copies into `files/SQLite/`. Cloud backups
// are capped at 25 MB per app; over the quota, Android calls BackupAgent.onQuotaExceeded() and
// stores nothing, so today no backup is ever taken. tiles.db is excluded rather than backed up
// because it is re-copied from the APK asset on first run.
//
// Android reads `fullBackupContent` (<full-backup-content>) on Android 11 (API 30) and lower,
// and `dataExtractionRules` (<data-extraction-rules>) on Android 12 (API 31) and higher, where
// it also governs device-to-device transfer. Both list only the AsyncStorage database files, so
// everything else in every domain is left out.
//
// Note: the Expo prebuild template and the installed plugins set neither attribute; Expo's own
// withAllowBackup sets `android:allowBackup` from `android.allowBackup` in app.config.js.

const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const ASYNC_STORAGE_DATABASE = 'RKStorage';
// SQLite writes the rollback journal or, in WAL mode, the write-ahead log and shared memory
// index next to the database; both must travel with it for the restored copy to be complete.
const DATABASE_FILES = ['', '-journal', '-wal', '-shm'].map(
  (suffix) => `${ASYNC_STORAGE_DATABASE}${suffix}`
);

const BACKUP_RULES = 'game_state_backup_rules';
const DATA_EXTRACTION_RULES = 'game_state_data_extraction_rules';

function includeLines(indent) {
  return DATABASE_FILES.map((file) => `${indent}<include domain="database" path="${file}" />`);
}

// <full-backup-content> for Android 11 (API 30) and lower
function buildBackupRulesXml() {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<full-backup-content>',
    ...includeLines('  '),
    '</full-backup-content>',
    '',
  ].join('\n');
}

// <data-extraction-rules> for Android 12 (API 31) and higher
function buildDataExtractionRulesXml() {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<data-extraction-rules>',
    '  <cloud-backup>',
    ...includeLines('    '),
    '  </cloud-backup>',
    '  <device-transfer>',
    ...includeLines('    '),
    '  </device-transfer>',
    '</data-extraction-rules>',
    '',
  ].join('\n');
}

function setBackupRules(androidManifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  application.$['android:fullBackupContent'] = `@xml/${BACKUP_RULES}`;
  application.$['android:dataExtractionRules'] = `@xml/${DATA_EXTRACTION_RULES}`;
  return androidManifest;
}

const withBackupRulesManifest = (config) => {
  return withAndroidManifest(config, (config) => {
    config.modResults = setBackupRules(config.modResults);
    return config;
  });
};

const withBackupRulesXml = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const xmlDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      await fs.promises.mkdir(xmlDir, { recursive: true });
      await fs.promises.writeFile(path.join(xmlDir, `${BACKUP_RULES}.xml`), buildBackupRulesXml());
      await fs.promises.writeFile(
        path.join(xmlDir, `${DATA_EXTRACTION_RULES}.xml`),
        buildDataExtractionRulesXml()
      );
      return config;
    },
  ]);
};

module.exports = function withGameStateBackup(config) {
  return withBackupRulesXml(withBackupRulesManifest(config));
};
module.exports.buildBackupRulesXml = buildBackupRulesXml;
module.exports.buildDataExtractionRulesXml = buildDataExtractionRulesXml;
module.exports.setBackupRules = setBackupRules;
