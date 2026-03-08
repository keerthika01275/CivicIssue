import api from './api';

// Get all complaints (optionally filter by status)
export const getComplaints = async () => {
    const res = await api.get('/complaints');
    return res.data;
};

// Get complaints submitted by the logged-in user
export const getMyComplaints = async () => {
    const res = await api.get('/complaints/mine');
    return res.data;
};

// Create a new complaint
export const createComplaint = async ({ title, description, address, locationCoords, photo, type, priority }) => {
    const res = await api.post('/complaints', { title, description, address, locationCoords, photo, type, priority });
    return res.data;
};

// Get a single complaint by ID
export const getComplaintById = async (id) => {
    const res = await api.get(`/complaints/${id}`);
    return res.data;
};

// Update complaint status (admin/volunteer use)
export const updateComplaintStatus = async (id, status) => {
    const res = await api.patch(`/complaints/${id}/status`, { status });
    return res.data;
};

// Delete complaint
export const deleteComplaint = async (id) => {
    const res = await api.delete(`/complaints/${id}`);
    return res.data;
};

// Edit complaint
export const updateComplaint = async (id, data) => {
    const res = await api.put(`/complaints/${id}`, data);
    return res.data;
};

// Vote on a complaint (upvote / downvote)
export const voteComplaint = async (id, voteType) => {
    const res = await api.post(`/complaints/${id}/vote`, { voteType });
    return res.data;
};

// Get comments for a complaint
export const getComments = async (complaintId) => {
    const res = await api.get(`/complaints/${complaintId}/comments`);
    return res.data;
};

// Post a new comment
export const postComment = async (complaintId, content) => {
    const res = await api.post(`/complaints/${complaintId}/comments`, { content });
    return res.data;
};

// Delete a comment
export const deleteComment = async (commentId) => {
    const res = await api.delete(`/comments/${commentId}`);
    return res.data;
};

/* ───────── Volunteer Actions ───────── */

// Accept complaint
export const acceptComplaint = (id) =>
  api.post(`/complaints/${id}/accept`);

// Reject complaint
export const rejectComplaint = (id) =>
  api.post(`/complaints/${id}/reject`);

// Resolve complaint
export const resolveComplaint = (id) =>
  api.patch(`/complaints/${id}/resolve`);

// Volunteer stats
export const getVolunteerStats = () =>
  api.get('/volunteer/stats');

// Nearby complaints
export const getNearbyComplaints = (lat, lng, radius = 10) =>
  api.get(`/volunteer/complaints/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);

//Get all complaints (for volunteers)
export const getAllComplaints = async () => {
  const res = await api.get('/complaints');
  return res.data;
};