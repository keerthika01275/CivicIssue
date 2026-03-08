
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardX, MapPin, Clock, Plus, Loader2,
  ThumbsUp, ThumbsDown, Pencil, Trash2, X,
  Save, Send, MessageSquare, ChevronDown, Filter,
  Navigation
} from 'lucide-react';
import NavBar from '../Components/common/NavBar';
import Footer from '../Components/common/Footer';
import {
  getComplaints, getMyComplaints, deleteComplaint, updateComplaint,
  voteComplaint, getComments, postComment, deleteComment,
  acceptComplaint, rejectComplaint, resolveComplaint,
} from '../services/complaintService';
import { getCurrentUser } from '../services/authService';

/* ─── Constants ─────────────────────────────────────────────── */
const STATUS = {
  received: { bg: 'bg-blue-100', dot: 'bg-blue-400', text: 'text-blue-700', label: 'Received' },
  in_review: { bg: 'bg-amber-100', dot: 'bg-amber-400', text: 'text-amber-700', label: 'In Review' },
  resolved: { bg: 'bg-emerald-100', dot: 'bg-emerald-400', text: 'text-emerald-700', label: 'Resolved' },
};

const PRIORITY_COLORS = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-green-100 text-green-700',
};

const GRADIENTS = [
  'from-rose-300/60 to-orange-300/60',
  'from-teal-300/60 to-cyan-300/60',
  'from-violet-300/60 to-indigo-300/60',
  'from-amber-300/60 to-yellow-200/60',
  'from-green-300/60 to-emerald-300/60',
];

const TYPE_ICONS = {
  'Waste / Garbage': '🗑️',
  'Road Damage': '🚧',
  'Water Leakage': '💧',
  'Street Light Issue': '💡',
  'Pothole': '⚠️',
  'Others': '📌',
};

// Distance threshold for "Near Me" in Kilometers
const PROXIMITY_THRESHOLD = 5;

/* ─── Tiny helpers ───────────────────────────────────────────── */
const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

// Haversine formula to calculate distance between two lat/lng points
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const Avatar = ({ name = '', size = 8, colors = 'bg-gradient-to-br from-teal-400 to-cyan-500' }) => (
  <div className={`w-${size} h-${size} rounded-full ${colors} flex items-center justify-center text-white font-black shrink-0`}
    style={{ fontSize: size < 8 ? '9px' : '11px' }}>
    {initials(name)}
  </div>
);

const ViewComplaints = () => {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const role = currentUser?.role; // 'user' | 'volunteer' | 'admin'
  const commentEndRef = useRef(null);

  /* ── state ── */
  const [tab, setTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // --- Filter states ---
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const [allComplaints, setAllComplaints] = useState([]);
  const [myComplaints, setMyComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  // Near Me Logic States
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);

  // edit
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);

  // comments
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);

  /* ── Load complaints ── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [a, m] = await Promise.all([getComplaints(), getMyComplaints()]);
        setAllComplaints(a.complaints || []);
        setMyComplaints(m.complaints || []);
      } catch { setError('Failed to load. Please refresh.'); }
      finally { setLoading(false); }
    })();
  }, []);

  /* ── Load comments when complaint selected ── */
  useEffect(() => {
    if (!selected) { setComments([]); setCommentText(''); return; }
    setCommentsLoading(true);
    getComments(selected._id)
      .then(r => setComments(r.comments || []))
      .catch(() => { })
      .finally(() => setCommentsLoading(false));
  }, [selected?._id]);

  /* ── Auto-scroll to latest comment ── */
  useEffect(() => {
    commentEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  /* ── Geolocation Helper ── */
  const handleNearMeTab = () => {
    setTab('near');
    if (!userLocation) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocating(false);
        },
        () => {
          setError('Location access denied. Cannot show nearby complaints.');
          setLocating(false);
          setTab('all');
        }
      );
    }
  };

  /* ── Filter Logic ── */
  const base = tab === 'mine' ? myComplaints : allComplaints;
  
  const filtered = base.filter(c => {
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    const matchesPriority = priorityFilter === 'all' || c.priority === priorityFilter;
    
    // Proximity Filter for Volunteers
    let matchesProximity = true;
    if (tab === 'near' && userLocation) {
      const cLat = c.locationCoords?.coordinates?.[1];
      const cLng = c.locationCoords?.coordinates?.[0];
      if (cLat && cLng) {
        const dist = calculateDistance(userLocation.lat, userLocation.lng, cLat, cLng);
        matchesProximity = dist <= PROXIMITY_THRESHOLD;
      } else {
        matchesProximity = false;
      }
    }

    return matchesStatus && matchesType && matchesPriority && matchesProximity;
  });

  /* ── Helpers ── */
  const isOwner = (c) => currentUser && (
    c.user?._id === currentUser.id ||
    c.user?.toString() === currentUser.id ||
    c.user === currentUser.id
  );

  const updateComplaintState = (id, updates) => {
    setAllComplaints(prev =>
      prev.map(c => c._id === id ? { ...c, ...updates } : c)
    );
    setMyComplaints(prev =>
      prev.map(c => c._id === id ? { ...c, ...updates } : c)
    );
    if (selected?._id === id) {
      setSelected(prev => ({ ...prev, ...updates }));
    }
  };

  /* ── Vote ── */
  const handleVote = async (complaintId, action) => {
    const vt = action === 'like' ? 'upvote' : 'downvote';
    const optimistic = (list) => list.map(c => {
      if (c._id !== complaintId) return c;
      let likes = c.likes || 0, dislikes = c.dislikes || 0, userVote = c.userVote;
      if (action === 'like') {
        if (userVote === 'upvote') { likes--; userVote = null; }
        else { likes++; if (userVote === 'downvote') dislikes--; userVote = 'upvote'; }
      } else {
        if (userVote === 'downvote') { dislikes--; userVote = null; }
        else { dislikes++; if (userVote === 'upvote') likes--; userVote = 'downvote'; }
      }
      return { ...c, likes, dislikes, userVote };
    });
    setAllComplaints(p => optimistic(p));
    setMyComplaints(p => optimistic(p));
    if (selected?._id === complaintId) setSelected(p => optimistic([p])[0]);
    try {
      const r = await voteComplaint(complaintId, vt);
      const sync = (list) => list.map(c =>
        c._id === complaintId ? { ...c, likes: r.likes, dislikes: r.dislikes, userVote: r.userVote } : c
      );
      setAllComplaints(p => sync(p)); setMyComplaints(p => sync(p));
      if (selected?._id === complaintId) setSelected(p => ({ ...p, likes: r.likes, dislikes: r.dislikes, userVote: r.userVote }));
    } catch { }
  };

  /* ── Delete ── */
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this complaint? This cannot be undone.')) return;
    try {
      await deleteComplaint(id);
      setAllComplaints(p => p.filter(c => c._id !== id));
      setMyComplaints(p => p.filter(c => c._id !== id));
      setSelected(null);
    } catch { alert('Failed to delete. Please try again.'); }
  };

  /* ── Edit ── */
  const openEdit = (c) => {
    setEditData({ title: c.title || '', description: c.description || '', type: c.type || '', priority: c.priority || 'Medium', address: c.address || '' });
    setIsEditing(true);
  };
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateComplaint(selected._id, editData);
      const upd = { ...selected, ...editData };
      setAllComplaints(p => p.map(c => c._id === upd._id ? upd : c));
      setMyComplaints(p => p.map(c => c._id === upd._id ? upd : c));
      setSelected(upd); setIsEditing(false);
    } catch { alert('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  const handlePost = async () => {
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      const r = await postComment(selected._id, commentText.trim());
      setComments(p => [...p, r.comment]);
      setCommentText('');
    } catch { alert('Failed to post comment.'); }
    finally { setPosting(false); }
  };
  const handleDeleteComment = async (id) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await deleteComment(id);
      setComments(p => p.filter(c => c._id !== id));
    } catch { alert('Failed to delete comment.'); }
  };

  const lat = selected?.locationCoords?.coordinates?.[1];
  const lng = selected?.locationCoords?.coordinates?.[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8f4ff] via-[#fef6f0] to-[#e6f7f4] font-sans flex flex-col">
      <NavBar />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-10 pb-16">

        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Complaints</h1>
            <p className="text-gray-400 mt-1 text-sm">
              {loading ? 'Loading…' : `${allComplaints.length} issue${allComplaints.length !== 1 ? 's' : ''} reported by the community`}
            </p>
          </div>
          {role !== 'volunteer' && (
  <button
    onClick={() => navigate('/report')}
    className="flex items-center gap-2 bg-[#F87171] hover:bg-[#EF4444] text-white font-bold px-4 py-2 rounded-lg shadow-md shadow-red-200 transition-all text-sm"
  >
    <Plus className="h-4 w-4" /> Report Issue
  </button>
)}
        </div>

        {/* ── Tab switcher ── */}
        <div className="flex gap-1 mb-6 p-1 bg-white/60 backdrop-blur-sm rounded-2xl border border-white shadow-sm w-fit">
          {[
  { key: 'all', label: 'All Complaints', count: allComplaints.length },

  
  ...(role !== 'volunteer'
    ? [{ key: 'mine', label: 'Your Complaints', count: myComplaints.length }]
    : []),

  
  ...(role === 'volunteer'
    ? [{ key: 'near', label: 'Near Me', icon: <Navigation className="w-3.5 h-3.5" /> }]
    : [])
].map(t => (
            <button
              key={t.key}
              onClick={() => { 
                if (t.key === 'near') {
                  handleNearMeTab();
                } else {
                  setTab(t.key);
                }
                setStatusFilter('all'); 
                setTypeFilter('all'); 
                setPriorityFilter('all'); 
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === t.key
                ? 'bg-teal-500 text-white shadow-md shadow-teal-200/60'
                : 'text-gray-500 hover:text-teal-600 hover:bg-teal-50'
                }`}
            >
              {t.icon && t.icon}
              {t.key === 'near' && locating ? 'Locating...' : t.label}
              {t.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${tab === t.key ? 'bg-white/25 text-white' : 'bg-teal-100 text-teal-700'
                  }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Category & Priority Filters ── */}
        <div className="flex flex-wrap items-center gap-3 mb-8 p-4 bg-white/50 backdrop-blur-md rounded-2xl border border-white/80 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400 mr-2 shrink-0">
            <Filter className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Filter By</span>
          </div>
          
          <div className="relative">
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none bg-white border border-gray-100 text-gray-700 text-xs font-bold px-4 py-2 pr-8 rounded-xl outline-none focus:ring-2 focus:ring-teal-400 transition-all cursor-pointer shadow-sm"
            >
              <option value="all">All Categories</option>
              {Object.keys(TYPE_ICONS).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select 
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="appearance-none bg-white border border-gray-100 text-gray-700 text-xs font-bold px-4 py-2 pr-8 rounded-xl outline-none focus:ring-2 focus:ring-teal-400 transition-all cursor-pointer shadow-sm"
            >
              <option value="all">All Priorities</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
    <select 
    value={statusFilter}
    onChange={(e) => setStatusFilter(e.target.value)}
    className="appearance-none bg-white border border-gray-100 text-gray-700 text-xs font-bold px-4 py-2 pr-8 rounded-xl outline-none focus:ring-2 focus:ring-teal-400 transition-all cursor-pointer shadow-sm"
  >
    <option value="all">All Status</option>
    <option value="received">Received</option>
    <option value="in_review">In Review</option>
    <option value="resolved">Resolved</option>
  </select>
  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
</div>

          {(typeFilter !== 'all' || priorityFilter !== 'all' || statusFilter !== 'all') && (
            <button 
              onClick={() => { setTypeFilter('all'); setPriorityFilter('all'); setStatusFilter('all'); }}
              className="text-[10px] font-black text-rose-500 uppercase hover:text-rose-600 transition-colors ml-auto px-2"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* ── Content area ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-16 h-16 rounded-3xl bg-teal-50 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
            </div>
            <p className="text-gray-400 text-sm font-medium">Loading complaints…</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-600 font-medium text-sm px-6 py-4 rounded-2xl">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center text-center py-24 px-8">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center mb-6 shadow-inner">
              <ClipboardX className="h-12 w-12 text-teal-400" />
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">No complaints found</h3>
            <p className="text-gray-400 mb-8 max-w-sm text-sm leading-relaxed">
              {tab === 'near' ? `There are no reported issues within ${PROXIMITY_THRESHOLD}km of your location.` : 
               typeFilter !== 'all' || priorityFilter !== 'all' || statusFilter !== 'all' 
                ? "We couldn't find any complaints matching your active filters." 
                : tab === 'mine' ? "You haven't reported anything yet." : "No complaints have been reported yet."}
            </p>
            {(typeFilter !== 'all' || priorityFilter !== 'all' || statusFilter !== 'all' || tab === 'near') ? (
               <button
               onClick={() => { setTab('all'); setTypeFilter('all'); setPriorityFilter('all'); setStatusFilter('all'); }}
               className="bg-teal-500 text-white font-bold px-8 py-3 rounded-2xl shadow-lg transition-all hover:scale-[1.02]"
             >
               Clear Filters & View All
             </button>
            ) : (
              <button
                onClick={() => navigate('/report')}
                className="bg-gradient-to-r from-rose-500 to-orange-400 hover:opacity-90 text-white font-bold px-8 py-3 rounded-2xl shadow-lg shadow-rose-200 transition-all hover:scale-[1.02]"
              >
                Report an Issue
              </button>
            )}
          </div>
        ) : (
          /* ── Card grid ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((c, idx) => {
              const s = STATUS[c.status] || { bg: 'bg-gray-100', dot: 'bg-gray-400', text: 'text-gray-600', label: c.status };
              const grad = GRADIENTS[idx % GRADIENTS.length];
              const isLiked = c.userVote === 'upvote';
              const isDisliked = c.userVote === 'downvote';
              const mine = tab === 'mine';

              return (
                <div
                  key={c._id}
                  onClick={() => { setSelected(c); setIsEditing(false); }}
                  className="group bg-white rounded-[22px] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-200 overflow-hidden cursor-pointer flex flex-col"
                >
                  <div className="relative h-44 overflow-hidden shrink-0 bg-gray-50">
                    {c.photo ? (
                      <img src={c.photo} alt={c.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${grad} flex flex-col items-center justify-center gap-2`}>
                        <span className="text-4xl opacity-60">{TYPE_ICONS[c.type] || '📍'}</span>
                      </div>
                    )}

                    <div className={`absolute top-3 left-3 flex items-center gap-1.5 ${s.bg} ${s.text} text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`} />
                      {s.label}
                    </div>

                    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full pl-0.5 pr-2.5 py-0.5 shadow-sm">
                      <Avatar name={c.user?.name} size={5} />
                      <span className="text-[10px] font-bold text-gray-700 max-w-[72px] truncate">
                        {c.user?.name || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-black text-gray-900 text-[15px] line-clamp-1 leading-snug flex-1">{c.title}</h3>
                      {c.priority && (
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${PRIORITY_COLORS[c.priority] || 'bg-gray-100 text-gray-500'}`}>
                          {c.priority}
                        </span>
                      )}
                    </div>

                    {c.description && (
                      <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-3">{c.description}</p>
                    )}

                    <div className="flex items-center gap-4 mb-3">
                      <button
                        onClick={e => { e.stopPropagation(); handleVote(c._id, 'like'); }}
                        className={`flex items-center gap-1.5 transition-all active:scale-90 ${isLiked ? 'text-teal-600' : 'text-gray-400 hover:text-teal-500'}`}
                      >
                        <div className={`p-1.5 rounded-full transition-all ${isLiked ? 'bg-teal-50' : 'hover:bg-teal-50'}`}>
                          <ThumbsUp className={`w-4 h-4 ${isLiked ? 'fill-teal-500 text-teal-500' : ''}`} />
                        </div>
                        <span className="text-xs font-black">{c.likes || 0}</span>
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleVote(c._id, 'dislike'); }}
                        className={`flex items-center gap-1.5 transition-all active:scale-90 ${isDisliked ? 'text-rose-500' : 'text-gray-400 hover:text-rose-400'}`}
                      >
                        <div className={`p-1.5 rounded-full transition-all ${isDisliked ? 'bg-rose-50' : 'hover:bg-rose-50'}`}>
                          <ThumbsDown className={`w-4 h-4 ${isDisliked ? 'fill-rose-500 text-rose-500' : ''}`} />
                        </div>
                        <span className="text-xs font-black">{c.dislikes || 0}</span>
                      </button>
                    </div>

                    <div className="mt-auto flex items-center justify-between text-[11px] text-gray-400 pt-3 border-t border-gray-100">
                      {c.address ? (
                        <span className="flex items-center gap-1 truncate max-w-[60%]">
                          <MapPin className="h-3 w-3 shrink-0 text-teal-400" />
                          <span className="truncate">{c.address}</span>
                        </span>
                      ) : <span />}
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3" />
                        {fmtDate(c.createdAt)}
                      </span>
                    </div>

                    {mine && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={e => { e.stopPropagation(); setSelected(c); openEdit(c); }}
                          className="flex items-center gap-1.5 text-amber-600 hover:text-white hover:bg-amber-500 border border-amber-200 hover:border-amber-500 font-bold text-xs px-3 py-1.5 rounded-xl transition-all"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(c._id); }}
                          className="flex items-center gap-1.5 text-red-500 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 font-bold text-xs px-3 py-1.5 rounded-xl transition-all"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    )}

                    {role === 'volunteer' && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                        {c.status === 'received' && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              acceptComplaint(c._id).then(() => {
                                updateComplaintState(c._id, { status: 'in_review', assignedTo: currentUser.id });
                              });
                            }}
                            className="text-teal-600 hover:text-white hover:bg-teal-500 border border-teal-200 hover:border-teal-500 font-bold text-xs px-3 py-1.5 rounded-xl transition-all"
                          >
                            Accept
                          </button>
                        )}
                        {c.status === 'in_review' && (c.assignedTo === currentUser?.id || c.assignedTo?._id === currentUser?.id) && (
                          <>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                resolveComplaint(c._id).then(() => {
                                  updateComplaintState(c._id, { status: 'resolved' });
                                });
                              }}
                              className="text-emerald-600 hover:text-white hover:bg-emerald-500 border border-emerald-200 hover:border-emerald-500 font-bold text-xs px-3 py-1.5 rounded-xl transition-all"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                rejectComplaint(c._id).then(() => {
                                  updateComplaintState(c._id, { status: 'received', assignedTo: null });
                                });
                              }}
                              className="text-rose-600 hover:text-white hover:bg-rose-500 border border-rose-200 hover:border-rose-500 font-bold text-xs px-3 py-1.5 rounded-xl transition-all"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => { setSelected(null); setIsEditing(false); }}
        >
          <div
            className="bg-white w-full sm:w-[95%] sm:max-w-4xl rounded-t-[28px] sm:rounded-[28px] shadow-2xl max-h-[95vh] overflow-y-auto flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3 min-w-0">
                {(() => {
                  const s = STATUS[selected.status] || { bg: 'bg-gray-100', dot: 'bg-gray-400', text: 'text-gray-600', label: selected.status };
                  return (
                    <span className={`flex items-center gap-1.5 ${s.bg} ${s.text} text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shrink-0`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  );
                })()}
                <h2 className="text-lg font-black text-gray-900 truncate">{selected.title}</h2>
              </div>

              <div className="flex items-center gap-2 ml-4 shrink-0">
                {isOwner(selected) && !isEditing && (
                  <>
                    <button
                      onClick={() => openEdit(selected)}
                      className="flex items-center gap-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl font-bold text-xs transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(selected._id)}
                      className="flex items-center gap-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl font-bold text-xs transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </>
                )}
                
                {role === 'volunteer' && (
                  <>
                    {selected.status === 'received' && (
                      <button
                        onClick={() => acceptComplaint(selected._id).then(() => {
                          updateComplaintState(selected._id, { status: 'in_review', assignedTo: currentUser.id });
                        })}
                        className="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1.5 rounded-xl font-bold text-xs"
                      >
                        Accept
                      </button>
                    )}
                    {selected.status === 'in_review' && (selected.assignedTo === currentUser?.id || selected.assignedTo?._id === currentUser?.id) && (
                      <>
                        <button
                          onClick={() => resolveComplaint(selected._id).then(() => {
                            updateComplaintState(selected._id, { status: 'resolved' });
                          })}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-xl font-bold text-xs"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => rejectComplaint(selected._id).then(() => {
                            updateComplaintState(selected._id, { status: 'received', assignedTo: null });
                          })}
                          className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-xl font-bold text-xs"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </>
                )}
                <button
                  onClick={() => { setSelected(null); setIsEditing(false); }}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
              <div className="rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 aspect-[4/3]">
                {selected.photo ? (
                  <img src={selected.photo} alt={selected.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-300">
                    <span className="text-6xl">{TYPE_ICONS[selected.type] || '📍'}</span>
                    <span className="text-xs font-medium">No photo</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Title</label>
                  {isEditing ? (
                    <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-bold text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                      value={editData.title} onChange={e => setEditData(p => ({ ...p, title: e.target.value }))} />
                  ) : (
                    <p className="text-base font-black text-gray-900">{selected.title}</p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Description</label>
                  {isEditing ? (
                    <textarea rows={3} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent resize-none"
                      value={editData.description} onChange={e => setEditData(p => ({ ...p, description: e.target.value }))} />
                  ) : (
                    <p className="text-sm text-gray-600 leading-relaxed">{selected.description || '—'}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Type</label>
                    {isEditing ? (
                      <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                        value={editData.type} onChange={e => setEditData(p => ({ ...p, type: e.target.value }))}>
                        {Object.keys(TYPE_ICONS).map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-gray-700">{TYPE_ICONS[selected.type]} {selected.type || '—'}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Priority</label>
                    {isEditing ? (
                      <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                        value={editData.priority} onChange={e => setEditData(p => ({ ...p, priority: e.target.value }))}>
                        {['Low', 'Medium', 'High'].map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <span className={`inline-block text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${PRIORITY_COLORS[selected.priority] || 'bg-gray-100 text-gray-500'}`}>
                        {selected.priority || 'N/A'}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Address</label>
                  {isEditing ? (
                    <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                      value={editData.address} onChange={e => setEditData(p => ({ ...p, address: e.target.value }))} />
                  ) : (
                    <p className="text-sm text-gray-700 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                      {selected.address || 'Not specified'}
                    </p>
                  )}
                </div>
                {/* Reported on */}
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Reported On</label>
                  <p className="text-sm text-gray-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                    {fmtDate(selected.createdAt)} at {fmtTime(selected.createdAt)}
                  </p>
                </div>
                {/* Assigned volunteer */}
                {(selected.status === 'in_review' || selected.status === 'resolved') && selected.assignedTo && (
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Assigned To</label>
                    <div className="flex items-center gap-3">
                      {selected.assignedTo?.profilePhoto ? (
                        <img
                          src={selected.assignedTo.profilePhoto}
                          alt={selected.assignedTo.name}
                          className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-amber-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 ring-2 ring-amber-200">
                          <span className="text-white font-black text-sm">
                            {initials(selected.assignedTo?.name || 'V')}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-black text-gray-800">
                          {selected.assignedTo?.name ||
                            (selected.assignedTo === currentUser?.id ? currentUser?.name : 'A Volunteer')}
                        </p>
                        {selected.assignedTo?.email && (
                          <p className="text-xs text-gray-400">{selected.assignedTo.email}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-5 pt-1">
                  <button
                    onClick={() => handleVote(selected._id, 'like')}
                    className={`flex items-center gap-2 transition-all active:scale-90 rounded-xl px-3 py-2 ${selected.userVote === 'upvote'
                      ? 'bg-teal-50 text-teal-600'
                      : 'text-gray-400 hover:bg-teal-50 hover:text-teal-500'
                      }`}
                  >
                    <ThumbsUp className={`w-4 h-4 ${selected.userVote === 'upvote' ? 'fill-teal-500' : ''}`} />
                    <span className="text-sm font-black">{selected.likes || 0}</span>
                  </button>
                  <button
                    onClick={() => handleVote(selected._id, 'dislike')}
                    className={`flex items-center gap-2 transition-all active:scale-90 rounded-xl px-3 py-2 ${selected.userVote === 'downvote'
                      ? 'bg-rose-50 text-rose-500'
                      : 'text-gray-400 hover:bg-rose-50 hover:text-rose-500'
                      }`}
                  >
                    <ThumbsDown className={`w-4 h-4 ${selected.userVote === 'downvote' ? 'fill-rose-500' : ''}`} />
                    <span className="text-sm font-black">{selected.dislikes || 0}</span>
                  </button>
                </div>

                {isEditing && (
                  <div className="flex gap-3 pt-1">
                    <button onClick={handleSave} disabled={saving}
                      className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-60">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button onClick={() => setIsEditing(false)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-5 py-2.5 rounded-xl font-bold text-sm transition-all">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mx-6 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-teal-500" />
                <h3 className="font-black text-gray-900 text-sm">Location</h3>
              </div>
              <div className="rounded-2xl overflow-hidden border border-gray-100 h-52 bg-gray-50">
                {lat && lng ? (
                  <iframe
                    key={selected._id}
                    title="map"
                    className="w-full h-full"
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?marker=${lat},${lng}&zoom=16`}
                  />
                ) : selected.address ? (
                  <iframe
                    key={selected._id + '_addr'}
                    title="map"
                    className="w-full h-full"
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?query=${encodeURIComponent(selected.address)}&zoom=14`}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300">
                    <MapPin className="w-10 h-10" />
                    <span className="text-xs font-medium">No location data available</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mx-6 mb-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-teal-500" />
                </div>
                <h3 className="font-black text-gray-900 text-sm">Discussion</h3>
                <span className="text-[10px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {comments.length}
                </span>
              </div>

              <div className="space-y-4 mb-5 max-h-72 overflow-y-auto scroll-smooth pr-1">
                {commentsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-gray-400 gap-2">
                    <span className="text-3xl">💬</span>
                    <p className="text-xs font-medium">No comments yet — start the discussion!</p>
                  </div>
                ) : (
                  comments.map(cm => {
                    const mine = currentUser && cm.user?._id === currentUser.id;
                    return (
                      <div key={cm._id} className={`flex gap-3 ${mine ? 'flex-row-reverse' : ''} group`}>
                        <Avatar name={cm.user?.name} size={8}
                          colors={mine ? 'bg-gradient-to-br from-teal-400 to-cyan-500' : 'bg-gradient-to-br from-violet-400 to-indigo-500'} />
                        <div className={`flex-1 min-w-0 ${mine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          <div className={`max-w-[85%] ${mine
                            ? 'bg-gradient-to-br from-teal-500 to-cyan-500 text-white rounded-2xl rounded-tr-sm'
                            : 'bg-gray-50 text-gray-800 rounded-2xl rounded-tl-sm border border-gray-100'
                            } px-4 py-2.5`}>
                            {!mine && (
                              <p className="text-[10px] font-black mb-1 text-gray-400">{cm.user?.name || 'Unknown'}</p>
                            )}
                            <p className="text-sm leading-relaxed">{cm.content}</p>
                          </div>
                          <div className={`flex items-center gap-2 px-1 ${mine ? 'flex-row-reverse' : ''}`}>
                            <span className="text-[10px] text-gray-400">{fmtDate(cm.createdAt)}</span>
                            {mine && (
                              <button
                                onClick={() => handleDeleteComment(cm._id)}
                                className="text-[10px] text-red-400 hover:text-red-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={commentEndRef} />
              </div>

              <div className="flex gap-3 items-end">
                <Avatar name={currentUser?.name} size={8} />
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100 transition-all">
                  <textarea
                    rows={2}
                    placeholder="Add a comment…"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePost(); }
                    }}
                    className="w-full bg-transparent px-4 pt-3 pb-1 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none"
                  />
                  <div className="flex justify-between items-center px-3 pb-2.5 pt-1">
                    <span className="text-[10px] text-gray-400">Enter ↵ to send · Shift+Enter for new line</span>
                    <button
                      onClick={handlePost}
                      disabled={posting || !commentText.trim()}
                      className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-1.5 rounded-xl transition-all"
                    >
                      {posting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      {posting ? 'Posting…' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default ViewComplaints;