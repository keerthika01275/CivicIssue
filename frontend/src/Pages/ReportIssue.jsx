import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, MapPin, Camera, Send, X, AlertCircle, Loader2, CheckCircle, LocateFixed } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import NavBar from '../Components/common/NavBar';
import Footer from '../Components/common/Footer';
import { createComplaint } from '../services/complaintService';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const ReportIssue = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    title: '', type: '', priority: '', address: '', landmark: '', description: ''
  });

  const [position, setPosition] = useState([20.5937, 78.9629]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  const getAddress = async (lat, lng) => {
    setLoadingAddress(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=en`
      );
      const data = await response.json();
      setFormData(prev => ({ ...prev, address: data.display_name || `${lat}, ${lng}` }));
    } catch {
      setFormData(prev => ({ ...prev, address: `${lat}, ${lng}` }));
    }
    setLoadingAddress(false);
  };

  function MapController({ center }) {
    const map = useMap();
    React.useEffect(() => {
      if (center) map.flyTo(center, Math.max(map.getZoom(), 15), { duration: 1.2 });
    }, [center, map]);
    return null;
  }

  function LocationMarker() {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setPosition([lat, lng]);
        getAddress(lat, lng);
      },
    });
    return position ? <Marker position={position} /> : null;
  }

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setDetectingLocation(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        setPosition([lat, lng]);
        await getAddress(lat, lng);
        setDetectingLocation(false);
      },
      (err) => {
        setDetectingLocation(false);
        setError(
          err.code === 1
            ? 'Location access denied. Please allow location permission and try again.'
            : 'Unable to detect location. Please pin manually on the map.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      setSelectedImage(URL.createObjectURL(file));
    }
  };

  const uploadImageToCloudinary = async (file) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', 'cleanstreet/complaints');
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: formData }
    );
    if (!res.ok) throw new Error('Image upload failed');
    const data = await res.json();
    return data.secure_url;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) { setError('Issue title is required.'); return; }
    if (!formData.description.trim()) { setError('Please describe the issue.'); return; }
    if (!formData.address.trim()) { setError('Please pin a location on the map.'); return; }

    setSubmitting(true);
    setError('');
    try {
      // upload photo to Cloudinary (if any)
      let photoUrl = '';
      if (imageFile) {
        setSubmitStatus('uploading');
        photoUrl = await uploadImageToCloudinary(imageFile);
      }

      // save complaint with photo URL
      setSubmitStatus('saving');
      await createComplaint({
        title: formData.title,
        description: formData.description,
        address: formData.address,
        locationCoords: {
          type: 'Point',
          coordinates: [position[1], position[0]], // [lng, lat]
        },
        photo: photoUrl || undefined,
        type: formData.type || undefined,
        priority: formData.priority || undefined,
      });
      setSuccess(true);
      setTimeout(() => navigate('/complaints'), 1500);
    } catch (err) {
      setError(
        err.message === 'Image upload failed'
          ? 'Photo upload failed. Please try a smaller image or check your connection.'
          : (err.response?.data?.message || 'Failed to submit. Please try again.')
      );
    } finally {
      setSubmitting(false);
      setSubmitStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF6F0] to-[#E2F5F2] font-sans flex flex-col">

      {/* Success toast */}
      {success && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-teal-500 text-white px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>Report submitted successfully!</span>
        </div>
      )}

      <NavBar />

      <div className="flex-1 max-w-7xl mx-auto p-6 w-full">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left: Form */}
          <div className="bg-white/40 backdrop-blur-md rounded-3xl border border-white/60 shadow-sm p-8">
            <div className="flex items-center gap-2 mb-6 text-gray-800">
              <Info className="h-5 w-5 text-teal-500" />
              <h3 className="font-bold uppercase tracking-tight">Issue Details</h3>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm font-medium px-4 py-3 rounded-xl mb-5">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Issue Title *</label>
                <input name="title" type="text" value={formData.title} onChange={handleInputChange} placeholder="e.g., Overflowing bin on Park Ave" className="w-full px-4 py-3 border border-white/60 bg-white/60 rounded-xl focus:ring-2 focus:ring-teal-400 outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Issue Type</label>
                  <select name="type" value={formData.type} onChange={handleInputChange} className="w-full px-4 py-3 border border-white/60 bg-white/60 rounded-xl focus:ring-2 focus:ring-teal-400 outline-none">
                    <option value="">-- Select --</option>
                    <option value="Waste / Garbage">Waste / Garbage</option>
                    <option value="Pothole">Pothole</option>
                    <option value="Water Leakage">Water Leakage</option>
                    <option value="Road Damage">Road Damage</option>
                    <option value="Street Light Issue">Street Light Issue</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Priority</label>
                  <select name="priority" value={formData.priority} onChange={handleInputChange} className="w-full px-4 py-3 border border-white/60 bg-white/60 rounded-xl focus:ring-2 focus:ring-teal-400 outline-none">
                    <option value="">-- Select --</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest flex justify-between">
                  Location Address *
                  {(loadingAddress || detectingLocation) && <span className="text-teal-500 animate-pulse italic normal-case font-medium">{detectingLocation ? 'Detecting...' : 'Fetching address...'}</span>}
                </label>
                <div className="relative flex items-center">
                  <MapPin className="absolute left-3 h-4 w-4 text-teal-500 pointer-events-none" />
                  <input
                    name="address"
                    type="text"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Click map or detect location"
                    className="w-full pl-10 pr-36 py-3 border border-white/60 bg-white/50 rounded-xl focus:ring-2 focus:ring-teal-400 outline-none font-medium text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={detectingLocation || loadingAddress}
                    className="absolute right-2 flex items-center gap-1.5 px-3 py-1.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white text-[11px] font-bold rounded-lg transition-all active:scale-[0.97] whitespace-nowrap"
                  >
                    {detectingLocation
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Detecting</>
                      : <><LocateFixed className="h-3 w-3" /> Detect</>}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Nearby Landmark</label>
                <input name="landmark" type="text" value={formData.landmark} onChange={handleInputChange} placeholder="e.g., Near City Mall" className="w-full px-4 py-3 border border-white/60 bg-white/60 rounded-xl focus:ring-2 focus:ring-teal-400 outline-none" />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Detailed Description *</label>
                <textarea name="description" rows="3" value={formData.description} onChange={handleInputChange} placeholder="Describe the issue in detail..." className="w-full px-4 py-3 border border-white/60 bg-white/60 rounded-xl focus:ring-2 focus:ring-teal-400 outline-none resize-none"></textarea>
              </div>

              <div
                onClick={() => fileInputRef.current.click()}
                className="relative border-2 border-dashed border-white/60 rounded-2xl p-6 text-center hover:border-teal-400 transition-colors cursor-pointer group bg-white/30"
              >
                <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />
                {selectedImage ? (
                  <div className="relative inline-block">
                    <img src={selectedImage} alt="Preview" className="h-32 rounded-lg shadow-md" />
                    <button onClick={(e) => { e.stopPropagation(); setSelectedImage(null); setImageFile(null); }} className="absolute -top-2 -right-2 bg-[#F87171] text-white p-1 rounded-full"><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Camera className="h-8 w-8 text-gray-300 mb-2 group-hover:text-teal-500 transition-colors" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Attach Issue Photo</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#F87171] hover:bg-[#EF4444] disabled:opacity-60 text-white font-black py-4 rounded-2xl shadow-lg shadow-red-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                {submitting
                  ? submitStatus === 'uploading'
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading photo...</>
                    : <><Loader2 className="h-4 w-4 animate-spin" /> Saving report...</>
                  : <><Send className="h-4 w-4" /> SUBMIT REPORT</>}
              </button>
            </div>
          </div>

          {/* Right: Map */}
          <div className="flex flex-col gap-4">
            <div className="bg-white/40 backdrop-blur-md rounded-3xl border border-white/60 shadow-sm p-8 h-[650px] flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-5 w-5 text-teal-500" />
                <h3 className="font-bold uppercase tracking-tight text-gray-800">Pinpoint Location</h3>
              </div>

              <div className="flex-1 rounded-2xl overflow-hidden border border-white/60 z-0">
                <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapController center={position} />
                  <LocationMarker />
                </MapContainer>
              </div>
              <div className="mt-4 p-4 bg-teal-50/60 rounded-xl flex items-start gap-3 border border-teal-100">
                <AlertCircle className="h-5 w-5 text-teal-500 mt-0.5" />
                <p className="text-xs text-teal-800 leading-relaxed font-medium">
                  Use <strong>Detect My Location</strong> or click anywhere on the map to pin the issue. Address and coordinates are auto-filled.
                </p>
              </div>
            </div>
          </div>

        </form>
      </div>

      <Footer />
    </div>
  );
};

export default ReportIssue;
