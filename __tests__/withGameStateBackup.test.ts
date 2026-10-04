/** @jest-environment node */
// The Auto Backup config plugin: its XML rules and manifest change, its registration in
// app.config.js, an introspected prebuild of the whole app config (every installed plugin, the
// Expo template manifest), and a real mod run that writes the rule files into a scratch project.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { getConfig } from 'expo/config';
import { AndroidConfig, compileModsAsync } from 'expo/config-plugins';
import withGameStateBackup, {
  buildBackupRulesXml,
  buildDataExtractionRulesXml,
  setBackupRules,
} from '../plugins/withGameStateBackup';

const REPO_ROOT = path.resolve(__dirname, '..');

const EXPECTED_RULES = ['RKStorage', 'RKStorage-journal', 'RKStorage-wal', 'RKStorage-shm'].map(
  (file) => `include database ${file}`
);

const BACKUP_ATTRIBUTES = {
  'android:fullBackupContent': '@xml/game_state_backup_rules',
  'android:dataExtractionRules': '@xml/game_state_data_extraction_rules',
};

/** Every `<include>`/`<exclude>` in `xml` as "tag domain path". */
function rules(xml: string): string[] {
  return [...xml.matchAll(/<(include|exclude)\b([^>]*)\/>/g)].map(([, tag, attrs]) => {
    const domain = /domain="([^"]*)"/.exec(attrs)?.[1];
    const file = /path="([^"]*)"/.exec(attrs)?.[1];
    return `${tag} ${domain} ${file}`;
  });
}

/** The app config as prebuild sees it, with every plugin in app.config.js applied. */
function appConfig() {
  return getConfig(REPO_ROOT, { skipSDKVersionRequirement: true, isModdedConfig: true }).exp;
}

/** Scratch projects created by the current test, removed after it. */
const scratchRoots: string[] = [];

/** Writes a manifest shaped like the Expo template's into a fresh scratch project. */
async function scratchProject(): Promise<{ projectRoot: string; manifestPath: string }> {
  const projectRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'backup-plugin-'));
  scratchRoots.push(projectRoot);
  const manifestPath = path.join(projectRoot, 'android/app/src/main/AndroidManifest.xml');
  await fs.promises.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.promises.writeFile(
    manifestPath,
    `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application android:name=".MainApplication" android:allowBackup="false">
    <activity android:name=".MainActivity" android:exported="true" />
  </application>
</manifest>
`
  );
  return { projectRoot, manifestPath };
}

describe('withGameStateBackup', () => {
  afterEach(() => {
    for (const root of scratchRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it('backs up only the AsyncStorage database and its journal files on Android 11 and lower', () => {
    const xml = buildBackupRulesXml();

    expect(xml).toMatch(/^<\?xml version="1.0" encoding="utf-8"\?>\n<full-backup-content>\n/);
    expect(xml.trimEnd()).toMatch(/<\/full-backup-content>$/);
    expect(rules(xml)).toEqual(EXPECTED_RULES);
  });

  it('backs up and transfers only the AsyncStorage database files on Android 12 and higher', () => {
    const xml = buildDataExtractionRulesXml();
    const section = (name: string) =>
      new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml)?.[1] ?? '';

    expect(xml).toMatch(/^<\?xml version="1.0" encoding="utf-8"\?>\n<data-extraction-rules>\n/);
    expect(xml.trimEnd()).toMatch(/<\/data-extraction-rules>$/);
    expect(rules(section('cloud-backup'))).toEqual(EXPECTED_RULES);
    expect(rules(section('device-transfer'))).toEqual(EXPECTED_RULES);
    expect(rules(xml)).toEqual([...EXPECTED_RULES, ...EXPECTED_RULES]);
  });

  it('points the application at both rule files', async () => {
    const { manifestPath } = await scratchProject();
    const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(setBackupRules(manifest));

    expect(application.$).toEqual({
      'android:name': '.MainApplication',
      'android:allowBackup': 'false',
      ...BACKUP_ATTRIBUTES,
    });
  });

  it('is registered in app.config.js with backups allowed', () => {
    const config = appConfig();

    expect(config.plugins).toContain('./plugins/withGameStateBackup');
    expect(config.android?.allowBackup).toBe(true);
  });

  it('survives every other plugin in an introspected prebuild of the app config', async () => {
    // getConfig applies the app's plugins but not Expo's built-in ones; prebuild adds
    // withAllowBackup, which turns the template's allowBackup="false" into the configured value.
    const config = AndroidConfig.AllowBackup.withAllowBackup(appConfig());

    const result = await compileModsAsync(config, {
      projectRoot: REPO_ROOT,
      platforms: ['android'],
      introspect: true,
    });

    const manifest = result._internal?.modResults.android.manifest;
    expect(AndroidConfig.Manifest.getMainApplicationOrThrow(manifest).$).toMatchObject({
      'android:allowBackup': 'true',
      ...BACKUP_ATTRIBUTES,
    });
  });

  it('writes the rule files and manifest attributes when prebuild runs its mods', async () => {
    const { projectRoot, manifestPath } = await scratchProject();
    const config = withGameStateBackup({
      ...getConfig(REPO_ROOT, { skipSDKVersionRequirement: true, skipPlugins: true }).exp,
      _internal: { projectRoot },
    });

    await compileModsAsync(config, { projectRoot, platforms: ['android'] });

    const xmlDir = path.join(projectRoot, 'android/app/src/main/res/xml');
    expect(fs.readdirSync(xmlDir).sort()).toEqual([
      'game_state_backup_rules.xml',
      'game_state_data_extraction_rules.xml',
    ]);
    expect(fs.readFileSync(path.join(xmlDir, 'game_state_backup_rules.xml'), 'utf8')).toBe(
      buildBackupRulesXml()
    );
    expect(fs.readFileSync(path.join(xmlDir, 'game_state_data_extraction_rules.xml'), 'utf8')).toBe(
      buildDataExtractionRulesXml()
    );
    const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
    expect(AndroidConfig.Manifest.getMainApplicationOrThrow(manifest).$).toMatchObject(
      BACKUP_ATTRIBUTES
    );
  });
});
