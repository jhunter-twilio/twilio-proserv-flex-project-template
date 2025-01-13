import { getFeatureFlags, getFlexFeatureFlag } from '../../utils/configuration';
import LocalizationConfig from './types/ServiceConfiguration';

const { enabled = false, show_menu = true } = (getFeatureFlags()?.features?.localization as LocalizationConfig) || {};

const nativeLocalizationEnabled = getFlexFeatureFlag('localization-beta');

export const isFeatureEnabled = () => {
  return enabled && !isNativeLocalizationEnabled();
};

export const isMenuEnabled = () => {
  return show_menu;
};

export const isNativeLocalizationEnabled = () => {
  return nativeLocalizationEnabled;
};
