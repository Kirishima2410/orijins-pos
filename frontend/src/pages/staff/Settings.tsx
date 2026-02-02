import React, { useState, useEffect } from 'react';
import { settingsAPI } from '../../utils/api';
import { Settings as SettingsType } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import {
  Cog6ToothIcon,
  BuildingStorefrontIcon,
  CurrencyDollarIcon,
  ClockIcon,
  BellIcon,
  PhotoIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'business' | 'pos' | 'notifications'>('general');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getAll();
      setSettings(response.data);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    try {
      setSaving(true);

      // Extract just the values to send to the API
      const settingsToSave = Object.entries(settings).reduce((acc, [key, setting]) => {
        acc[key] = setting.value;
        return acc;
      }, {} as Record<string, any>);

      await settingsAPI.updateMultiple({ settings: settingsToSave });
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleResetSettings = async () => {
    if (window.confirm('Are you sure you want to reset all settings to default? This action cannot be undone.')) {
      try {
        setSaving(true);
        await settingsAPI.reset();
        await loadSettings();
        toast.success('Settings reset to default');
      } catch (error) {
        console.error('Error resetting settings:', error);
        toast.error('Failed to reset settings');
      } finally {
        setSaving(false);
      }
    }
  };

  const updateSetting = (key: keyof SettingsType, value: any) => {
    if (!settings) return;

    setSettings({
      ...settings,
      [key]: {
        ...settings[key],
        value,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Failed to load settings</p>
        <button onClick={loadSettings} className="btn btn-primary mt-4">
          Try Again
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'general', name: 'General', icon: Cog6ToothIcon },
    { id: 'business', name: 'Business Info', icon: BuildingStorefrontIcon },
    { id: 'pos', name: 'POS Settings', icon: CurrencyDollarIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-gray-600">
            Configure system settings and preferences
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleResetSettings}
            className="btn btn-outline"
            disabled={saving}
          >
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Reset to Default
          </button>
          <button
            onClick={handleSaveSettings}
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? (
              <div className="flex items-center">
                <div className="loading-dots">
                  <div></div>
                  <div></div>
                  <div></div>
                </div>
                <span className="ml-2">Saving...</span>
              </div>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">System Settings</h3>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <label className="label">Currency</label>
                  <input
                    type="text"
                    value={settings.currency.value}
                    onChange={(e) => updateSetting('currency', e.target.value)}
                    className="input"
                    placeholder="PHP"
                  />
                </div>

                <div>
                  <label className="label">Currency Symbol</label>
                  <input
                    type="text"
                    value={settings.currency_symbol.value}
                    onChange={(e) => updateSetting('currency_symbol', e.target.value)}
                    className="input"
                    placeholder="₱"
                  />
                </div>

                <div>
                  <label className="label">Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={settings.tax_rate.value * 100}
                    onChange={(e) => updateSetting('tax_rate', parseFloat(e.target.value) / 100)}
                    className="input"
                    placeholder="12"
                  />
                </div>

                <div>
                  <label className="label">Session Timeout (seconds)</label>
                  <input
                    type="number"
                    min="300"
                    max="86400"
                    value={settings.session_timeout.value}
                    onChange={(e) => updateSetting('session_timeout', parseInt(e.target.value))}
                    className="input"
                    placeholder="3600"
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Order Settings</h3>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <label className="label">Order Number Prefix</label>
                  <input
                    type="text"
                    value={settings.order_number_prefix.value}
                    onChange={(e) => updateSetting('order_number_prefix', e.target.value)}
                    className="input"
                    placeholder="ORD"
                  />
                </div>

                <div>
                  <label className="label">Receipt Footer</label>
                  <textarea
                    value={settings.receipt_footer.value}
                    onChange={(e) => updateSetting('receipt_footer', e.target.value)}
                    className="input"
                    rows={3}
                    placeholder="Thank you for your business!"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Business Information */}
        {activeTab === 'business' && (
          <div className="space-y-6">
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Business Information</h3>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <label className="label">Shop Name</label>
                  <input
                    type="text"
                    value={settings.shop_name.value}
                    onChange={(e) => updateSetting('shop_name', e.target.value)}
                    className="input"
                    placeholder="Coffee Shop POS"
                  />
                </div>

                <div>
                  <label className="label">Shop Address</label>
                  <textarea
                    value={settings.shop_address.value}
                    onChange={(e) => updateSetting('shop_address', e.target.value)}
                    className="input"
                    rows={3}
                    placeholder="123 Main Street, City, Country"
                  />
                </div>

                <div>
                  <label className="label">Phone Number</label>
                  <input
                    type="text"
                    value={settings.shop_phone.value}
                    onChange={(e) => updateSetting('shop_phone', e.target.value)}
                    className="input"
                    placeholder="+1-234-567-8900"
                  />
                </div>

                <div>
                  <label className="label">Email Address</label>
                  <input
                    type="email"
                    value={settings.shop_email.value}
                    onChange={(e) => updateSetting('shop_email', e.target.value)}
                    className="input"
                    placeholder="info@coffeeshop.com"
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Business Hours</h3>
              </div>
              <div className="card-body space-y-4">
                {Object.entries(settings.business_hours.value).map(([day, hours]) => (
                  <div key={day} className="flex items-center justify-between">
                    <label className="label capitalize">{day}</label>
                    <input
                      type="text"
                      value={hours}
                      onChange={(e) => {
                        const newHours = { ...settings.business_hours.value };
                        newHours[day] = e.target.value;
                        updateSetting('business_hours', newHours);
                      }}
                      className="input w-32"
                      placeholder="9:00-17:00"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* POS Settings */}
        {activeTab === 'pos' && (
          <div className="space-y-6">
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">GCash Settings</h3>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <label className="label">GCash Phone Number</label>
                  <input
                    type="text"
                    value={settings.gcash_number.value}
                    onChange={(e) => updateSetting('gcash_number', e.target.value)}
                    className="input"
                    placeholder="+63-XXX-XXX-XXXX"
                  />
                </div>

                <div>
                  <label className="label">GCash QR Code</label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600">
                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none">
                          <span>Upload QR Code</span>
                          <input type="file" className="sr-only" />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Inventory Settings</h3>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <label className="label">Default Low Stock Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.low_stock_threshold.value}
                    onChange={(e) => updateSetting('low_stock_threshold', parseInt(e.target.value))}
                    className="input"
                    placeholder="5"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notifications */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Notification Settings</h3>
              </div>
              <div className="card-body space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="label">Enable Notifications</label>
                    <p className="text-sm text-gray-600">Receive system notifications</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enable_notifications.value}
                      onChange={(e) => updateSetting('enable_notifications', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">System Information</h3>
              </div>
              <div className="card-body space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <ExclamationTriangleIcon className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">
                        Settings Information
                      </h3>
                      <div className="mt-2 text-sm text-blue-700">
                        <p>
                          Changes to these settings will affect the entire system.
                          Make sure to test any changes in a safe environment before applying to production.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">Current User</p>
                    <p className="text-gray-600">{user?.username} ({user?.role})</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Last Updated</p>
                    <p className="text-gray-600">Just now</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
