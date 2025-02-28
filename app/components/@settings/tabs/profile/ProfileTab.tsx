import { useState, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import { profileStore, updateProfile } from '~/lib/stores/profile';
import { toast } from 'react-toastify';
import { debounce } from '~/utils/debounce';

// Import profile styles
import '~/styles/components/profile.scss';

export default function ProfileTab() {
  const profile = useStore(profileStore);
  const [isUploading, setIsUploading] = useState(false);

  // Create debounced update functions
  const debouncedUpdate = useCallback(
    debounce((field: 'username' | 'bio', value: string) => {
      updateProfile({ [field]: value });
      toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} updated`);
    }, 1000),
    [],
  );

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setIsUploading(true);

      // Convert the file to base64
      const reader = new FileReader();

      reader.onloadend = () => {
        const base64String = reader.result as string;
        updateProfile({ avatar: base64String });
        setIsUploading(false);
        toast.success('Profile picture updated');
      };

      reader.onerror = () => {
        console.error('Error reading file:', reader.error);
        setIsUploading(false);
        toast.error('Failed to update profile picture');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setIsUploading(false);
      toast.error('Failed to update profile picture');
    }
  };

  const handleProfileUpdate = (field: 'username' | 'bio', value: string) => {
    // Update the store immediately for UI responsiveness
    updateProfile({ [field]: value });

    // Debounce the toast notification
    debouncedUpdate(field, value);
  };

  return (
    <div className="profile-container">
      <div className="profile-section">
        {/* Personal Information Section */}
        <div>
          {/* Avatar Upload */}
          <div className="avatar-container">
            <div className="avatar-wrapper">
              {profile.avatar ? (
                <img src={profile.avatar} alt="Profile" className="avatar-image" />
              ) : (
                <div className="i-ph:robot-fill avatar-placeholder" />
              )}

              <label
                className={classNames('avatar-upload-label', {
                  uploading: isUploading,
                })}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={isUploading}
                />
                {isUploading ? (
                  <div className="i-ph:spinner-gap spinner-icon" />
                ) : (
                  <div className="i-ph:camera-plus upload-icon" />
                )}
              </label>
            </div>

            <div className="avatar-info">
              <label className="avatar-label">Profile Picture</label>
              <p className="avatar-description">Upload a profile picture or avatar</p>
            </div>
          </div>

          {/* Username Input */}
          <div className="form-field">
            <label className="field-label">Username</label>
            <div className="input-group">
              <div className="input-icon">
                <div className="i-ph:user-circle-fill" />
              </div>
              <input
                type="text"
                value={profile.username}
                onChange={(e) => handleProfileUpdate('username', e.target.value)}
                className="text-input"
                placeholder="Enter your username"
              />
            </div>
          </div>

          {/* Bio Input */}
          <div className="form-field">
            <label className="field-label">Bio</label>
            <div className="input-group">
              <div className="input-icon">
                <div className="i-ph:text-aa" />
              </div>
              <textarea
                value={profile.bio}
                onChange={(e) => handleProfileUpdate('bio', e.target.value)}
                className="text-area"
                placeholder="Tell us about yourself"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
