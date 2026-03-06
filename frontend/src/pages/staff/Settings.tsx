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
  const [activeTab, setActiveTab] = useState<'business' | 'payment'>('business');

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
    { id: 'business', name: 'Business & General', icon: BuildingStorefrontIcon },
    { id: 'payment', name: 'Payment Settings', icon: CurrencyDollarIcon },
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

        {/* Payment Settings */}
        {activeTab === 'payment' && (
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
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
