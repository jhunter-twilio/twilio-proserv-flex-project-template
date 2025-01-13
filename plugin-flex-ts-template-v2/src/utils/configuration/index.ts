import * as Flex from '@twilio/flex-ui';
import merge from 'lodash/merge';
import semver from 'semver';

import { UIAttributes } from '../../types/manager/ServiceConfiguration';
import { CustomWorkerAttributes } from '../../types/task-router/Worker';

const manager = Flex.Manager.getInstance();
const { custom_data: globalSettings } = manager.configuration as UIAttributes;

let loadedFeaturesPopulated = false;
// Populated by the feature loader after each feature loads. Note: Do not access during initialization before all features have loaded, or the array will be incomplete!
const loadedFeatures: string[] = [];

/**
 * Allows you to query for enabled loaded features at runtime. When using this
 * function, be sure to call it only after all features have loaded.
 */
export const getLoadedFeatures = () => {
  if (!loadedFeaturesPopulated) {
    console.error('Caution! getLoadedFeatures() was called before all features were loaded, so none will be returned.');
    return [];
  }
  return loadedFeatures;
};

export const addLoadedFeature = (feature: string) => {
  loadedFeatures.push(feature);
};

export const setLoadedFeaturesPopulated = (populated: boolean) => {
  loadedFeaturesPopulated = populated;
};

export const defaultLanguage = 'en-US';

/**
 * Fetches the `custom_data` object from the hosted Flex configuration,
 * providing all of the global feature configuration and global common
 * configuration for the template.
 * If running locally, any values contained within `appConfig.js` will also be
 * returned, overriding the corresponding hosted Flex configuration values.
 */
export const getFeatureFlagsGlobal = () => {
  return globalSettings;
};

/**
 * Fetches the `config_overrides` object from the current worker's attributes.
 * This object contains any configuration values that were set on the worker
 * level, overriding the corresponding global configuration values.
 */
export const getFeatureFlagsUser = () => {
  const { config_overrides: workerSettings } = manager.workerClient?.attributes as CustomWorkerAttributes;
  return workerSettings;
};

const mergedSettings = merge(globalSettings, getFeatureFlagsUser());

/**
 * Returns the complete effective configuration. **This is the function you
 * should use in most cases when determining a configuration value.** For each
 * configuration value, the value returned will be as follows:
 * - If a override has been configured on the worker, that will be returned.
 * - If no worker override has been configured, and the plugin is running
 * locally, and the value is configured in `appConfig.js`, the value from
 * `appConfig.js` will be returned.
 * - Otherwise, the hosted Flex configuration value will be returned.
 */
export const getFeatureFlags = () => {
  return mergedSettings;
};

/**
 * Returns the currently configured language, using the same order of
 * precedence as `getFeatureFlags` if native localization is disabled.
 * If the configured value is `default`, the browser's language will be
 * returned. Otherwise, if no value is configured, `en-US` will be returned.
 */
export const getUserLanguage = () => {
  if (getFlexFeatureFlag('localization-beta') && manager.localization?.localeTag) {
    return manager.localization.localeTag;
  }

  let { language } = getFeatureFlags();

  if (manager.workerClient) {
    // get user-specified language if present, instead of global language
    const workerAttrs = manager.workerClient.attributes as CustomWorkerAttributes;
    if (workerAttrs.language) {
      language = workerAttrs.language;
    }
  }

  if (!language) {
    return defaultLanguage;
  }

  if (language === 'default') {
    return navigator.language;
  }

  return language;
};

/**
 * Returns the effective enablement state of the provided feature flag name.
 */
export const getFlexFeatureFlag = (feature: string): boolean => {
  const flagState = manager.store.getState().flex.featureFlags;
  const localFeatureEnabled = flagState.localOverrides[feature]?.enabled;

  if (localFeatureEnabled === undefined) {
    return flagState.features[feature]?.enabled === true;
  }

  return localFeatureEnabled === true;
};

/**
 * Returns whether or not the current Flex UI version intersects the provided
 * [semver range](https://github.com/npm/node-semver?tab=readme-ov-file#ranges).
 * Use this to conditionally perform logic based on the running Flex UI version.
 */
export const validateUiVersion = (validVersion: string): boolean => {
  return semver.intersects(Flex.VERSION, validVersion, { includePrerelease: true });
};
