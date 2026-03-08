import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, MapPin, Camera, Shield, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import NavBar from '../Components/common/NavBar';
import Footer from '../Components/common/Footer';
import { fetchMe, updateProfile, changePassword } from '../services/authService';

const Profile = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('personal');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '', email: '', location: '', role: '', profilePic: ''
  });

  const [securityData, setSecurityData] = useState({
    currentPassword: '', newPassword: '', confirmPassword: ''
  });
  const [showPass, setShowPass] = useState({ currentPassword: false, newPassword: false, confirmPassword: false });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await fetchMe();
        setFormData({
          name: user.name || '',
          email: user.email || '',
          location: user.location || '',
          role: user.role || 'user',
          profilePic: user.profilePhoto || '',
          profilePicUrl: user.profilePhoto || '',
        });
      } catch {
        showToast('Failed to load profile data.', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const handleImageClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Immediately preview the local image
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, profilePic: reader.result }));
    };
    reader.readAsDataURL(file);

    // Upload directly to Cloudinary (unsigned preset)
    try {
      setUploadingPic(true);
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
      const formPayload = new FormData();
      formPayload.append('file', file);
      formPayload.append('upload_preset', uploadPreset);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: formPayload }
      );
      const data = await res.json();
      if (!data.secure_url) throw new Error('Upload failed');
      setFormData(prev => ({ ...prev, profilePicUrl: data.secure_url, imageFile: null }));
    } catch {
      showToast('Image upload failed. Please try again.', 'error');
    } finally {
      setUploadingPic(false);
    }
  };

  const handlePersonalChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSecurityChange = (e) => {
    setSecurityData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (uploadingPic) return; // wait for upload to finish
    setSaving(true);
    setError('');

    try {
      const updatedUser = await updateProfile({
        name: formData.name,
        email: formData.email,
        location: formData.location,
        profilePhoto: formData.profilePicUrl || undefined,
      });
      // Refresh avatar preview from the saved URL
      if (updatedUser?.profilePhoto) {
        setFormData(prev => ({ ...prev, profilePic: updatedUser.profilePhoto, profilePicUrl: updatedUser.profilePhoto }));
      }
      showToast('Profile updated successfully!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (securityData.newPassword !== securityData.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await changePassword({
        currentPassword: securityData.currentPassword,
        newPassword: securityData.newPassword,
      });
      showToast('Password changed successfully!');
      setSecurityData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  const firstLetter = formData.name ? formData.name.charAt(0).toUpperCase() : '?';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FFF6F0] to-[#E2F5F2] flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-10 w-10 text-teal-500 animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF6F0] to-[#E2F5F2] font-sans flex flex-col relative">
      {toast.show && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold transition-all ${toast.type === 'success' ? 'bg-teal-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      <NavBar />

      <div className="flex-1 max-w-6xl mx-auto p-6 mt-8 pb-20 w-full">
        <div className="mb-8 text-center md:text-left">
          <h1 className="text-3xl font-bold text-gray-800">Account Settings</h1>
          <p className="text-gray-500">Manage your profile details and security.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4">
            <div className="bg-white/40 backdrop-blur-md rounded-3xl border border-white/60 shadow-sm p-8 flex flex-col items-center text-center">

              {/* Profile Image Section */}
              <div className="relative mb-6">
                <div className="w-32 h-32 border-4 border-teal-100 rounded-full flex items-center justify-center bg-white/50 text-teal-600 text-5xl font-black shadow-inner overflow-hidden">
                  {formData.profilePic ? (
                    <img src={formData.profilePic} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    firstLetter
                  )}
                  {uploadingPic && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
                      <Loader2 className="h-8 w-8 text-white animate-spin" />
                    </div>
                  )}
                </div>

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />

                {/* Trigger Button */}
                <button
                  onClick={handleImageClick}
                  className="absolute bottom-1 right-1 bg-white p-2 rounded-full shadow-lg border border-white/60 text-teal-600 hover:scale-110 transition-transform active:scale-90"
                >
                  <Camera className="h-5 w-5" />
                </button>
              </div>

              <h2 className="text-2xl font-bold text-gray-800 break-all">{formData.name}</h2>
              <p className="text-gray-500 text-sm mb-4 break-all">{formData.email}</p>
              <span className="bg-teal-50 text-teal-600 px-6 py-1 rounded-full text-xs font-bold uppercase tracking-widest">{formData.role}</span>
              {formData.location && (
                <div className="flex items-center gap-1 mt-3 text-xs text-gray-400">
                  <MapPin className="h-3 w-3" /> {formData.location}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-white/40 backdrop-blur-md rounded-3xl border border-white/60 shadow-sm overflow-hidden">
              <div className="flex border-b border-white/60">
                <button
                  onClick={() => { setActiveTab('personal'); setError(''); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold transition-all ${activeTab === 'personal' ? 'text-teal-600 border-b-2 border-teal-500 bg-teal-50/30' : 'text-gray-400'}`}
                >
                  <User className="h-4 w-4" /> Personal Details
                </button>
                <button
                  onClick={() => { setActiveTab('security'); setError(''); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold transition-all ${activeTab === 'security' ? 'text-teal-600 border-b-2 border-teal-500 bg-teal-50/30' : 'text-gray-400'}`}
                >
                  <Shield className="h-4 w-4" /> Security
                </button>
              </div>

              <div className="p-8">
                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm font-medium px-4 py-3 rounded-xl mb-6">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                  </div>
                )}

                {activeTab === 'personal' ? (
                  <form onSubmit={handleSaveProfile} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Full Name</label>
                        <input name="name" type="text" value={formData.name} onChange={handlePersonalChange} required className="w-full px-4 py-3 border border-white/60 bg-white/60 rounded-xl focus:ring-2 focus:ring-teal-400 outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Email Address</label>
                        <input name="email" type="email" value={formData.email} onChange={handlePersonalChange} required className="w-full px-4 py-3 border border-white/60 bg-white/60 rounded-xl focus:ring-2 focus:ring-teal-400 outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Location</label>
                        <input name="location" type="text" value={formData.location} onChange={handlePersonalChange} className="w-full px-4 py-3 border border-white/60 bg-white/60 rounded-xl focus:ring-2 focus:ring-teal-400 outline-none" placeholder="Your city / area" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-400">Role (Locked)</label>
                        <input disabled value={formData.role} className="w-full px-4 py-3 border border-white/40 bg-white/20 rounded-xl text-gray-400 cursor-not-allowed capitalize" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-6 border-t border-white/40">
                      <button type="button" onClick={() => navigate('/dashboard')} className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-white/50 transition-colors">Cancel</button>
                      <button type="submit" disabled={saving || uploadingPic} className="px-8 py-3 bg-[#F87171] hover:bg-[#EF4444] disabled:opacity-60 text-white rounded-xl font-bold shadow-lg shadow-red-200 transition-all active:scale-95 flex items-center gap-2">
                        {(saving || uploadingPic) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {uploadingPic ? 'Uploading...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleChangePassword} className="space-y-6">
                    {[
                      { field: 'currentPassword', label: 'Current Password' },
                      { field: 'newPassword', label: 'New Password' },
                      { field: 'confirmPassword', label: 'Confirm New Password' },
                    ].map(({ field, label }) => (
                      <div key={field} className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">{label}</label>
                        <div className="relative">
                          <input
                            name={field}
                            type={showPass[field] ? 'text' : 'password'}
                            value={securityData[field]}
                            onChange={handleSecurityChange}
                            placeholder="••••••••"
                            required
                            className="w-full pl-4 pr-12 py-3 border border-white/60 bg-white/60 rounded-xl focus:ring-2 focus:ring-teal-400 outline-none"
                          />
                          <button type="button" onClick={() => setShowPass(p => ({ ...p, [field]: !p[field] }))} className="absolute right-3 top-3 text-gray-400">
                            {showPass[field] ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-end gap-3 pt-6 border-t border-white/40">
                      <button type="button" onClick={() => navigate('/dashboard')} className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-white/50 transition-colors">Cancel</button>
                      <button type="submit" disabled={saving} className="px-8 py-3 bg-[#F87171] hover:bg-[#EF4444] disabled:opacity-60 text-white rounded-xl font-bold shadow-lg shadow-red-200 transition-all active:scale-95 flex items-center gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Update Password
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Profile;
