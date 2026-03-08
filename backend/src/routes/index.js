const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Vote = require('../models/Vote');
const Comment = require('../models/Comment');
const auth = require('../middleware/auth');
const { isVolunteer } = require('../middleware/auth');

const router = express.Router();

const isValidEmail = (email = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPassword = (password = '') => typeof password === 'string' && password.length >= 6;
const allowedRoles = ['user', 'volunteer', 'admin'];

const createToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

// ─── Health check ─────────────────────────────────────────────
router.get('/', (req, res) => {
  res.json({ message: 'Clean Street API is running' });
});

// ─── Auth: Register ───────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, location, role, profilePhoto } = req.body || {};
    const errors = {};
    if (!name?.trim()) errors.name = 'Name is required';
    if (!email?.trim()) errors.email = 'Email is required';
    else if (!isValidEmail(email)) errors.email = 'Email is not valid';
    if (!password) errors.password = 'Password is required';
    else if (!isValidPassword(password)) errors.password = 'Password must be at least 6 characters';
    if (role && !allowedRoles.includes(role)) errors.role = 'Invalid role';

    if (Object.keys(errors).length > 0)
      return res.status(400).json({ success: false, message: 'Validation failed', errors });

    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing)
      return res.status(409).json({ success: false, message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      location: location?.trim(),
      role: allowedRoles.includes(role) ? role : 'user',
      profilePhoto: profilePhoto?.trim(),
    });

    const token = createToken(user);
    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, profilePhoto: user.profilePhoto || null },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Auth: Login ─────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const errors = {};
    if (!email?.trim()) errors.email = 'Email is required';
    else if (!isValidEmail(email)) errors.email = 'Email is not valid';
    if (!password) errors.password = 'Password is required';

    if (Object.keys(errors).length > 0)
      return res.status(400).json({ success: false, message: 'Validation failed', errors });

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = createToken(user);
    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, profilePhoto: user.profilePhoto || null },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Auth: Get current user ───────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name email role location profilePhoto');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, user });
  } catch (error) {
    console.error('Me endpoint error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Auth: Update profile ─────────────────────────────────────
router.patch('/me', auth, async (req, res) => {
  try {
    const { name, email, location, profilePhoto } = req.body || {};
    const updates = {};
    if (name?.trim()) updates.name = name.trim();
    if (email?.trim()) {
      if (!isValidEmail(email)) return res.status(400).json({ success: false, message: 'Invalid email' });
      // Check email not taken by someone else
      const existing = await User.findOne({ email: email.trim().toLowerCase(), _id: { $ne: req.user.id } });
      if (existing) return res.status(409).json({ success: false, message: 'Email already in use' });
      updates.email = email.trim().toLowerCase();
    }
    if (location !== undefined) updates.location = location?.trim();
    if (profilePhoto?.trim()) updates.profilePhoto = profilePhoto.trim();

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('name email role location profilePhoto');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Return updated token so frontend stays in sync
    const token = createToken(user);
    return res.json({ success: true, message: 'Profile updated', user, token });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Auth: Change password ────────────────────────────────────
router.patch('/me/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Both passwords are required' });
    if (!isValidPassword(newPassword))
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Complaints: Get all ─────────────────────────────────────
router.get('/complaints', auth, async (req, res) => {
  try {
    const complaints = await Complaint.find()
      .populate('user', 'name email')
      .populate('assignedTo', 'name email profilePhoto')
      .sort({ createdAt: -1 });

    // Attach vote counts + current user's vote for each complaint
    const complaintIds = complaints.map(c => c._id);
    const votes = await Vote.find({ complaint: { $in: complaintIds } });

    const countMap = {};
    const userVoteMap = {};
    votes.forEach(v => {
      const cid = v.complaint.toString();
      if (!countMap[cid]) countMap[cid] = { upvotes: 0, downvotes: 0 };
      if (v.voteType === 'upvote') countMap[cid].upvotes++;
      else countMap[cid].downvotes++;
      if (v.user.toString() === req.user.id) userVoteMap[cid] = v.voteType;
    });

    const enriched = complaints.map(c => ({
      ...c.toObject(),
      likes: countMap[c._id.toString()]?.upvotes || 0,
      dislikes: countMap[c._id.toString()]?.downvotes || 0,
      userVote: userVoteMap[c._id.toString()] || null,
    }));

    return res.json({ success: true, complaints: enriched });
  } catch (error) {
    console.error('Get complaints error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Complaints: Get mine ─────────────────────────────────────
router.get('/complaints/mine', auth, async (req, res) => {
  try {
    const complaints = await Complaint.find({ user: req.user.id })
      .populate('user', 'name email')
      .populate('assignedTo', 'name email profilePhoto')
      .sort({ createdAt: -1 });

    const complaintIds = complaints.map(c => c._id);
    const votes = await Vote.find({ complaint: { $in: complaintIds } });

    const countMap = {};
    votes.forEach(v => {
      const cid = v.complaint.toString();
      if (!countMap[cid]) countMap[cid] = { upvotes: 0, downvotes: 0 };
      if (v.voteType === 'upvote') countMap[cid].upvotes++;
      else countMap[cid].downvotes++;
    });

    const enriched = complaints.map(c => ({
      ...c.toObject(),
      likes: countMap[c._id.toString()]?.upvotes || 0,
      dislikes: countMap[c._id.toString()]?.downvotes || 0,
      // For own complaints, include user's own vote
      userVote: votes.find(v => v.complaint.toString() === c._id.toString() && v.user.toString() === req.user.id)?.voteType || null,
    }));

    return res.json({ success: true, complaints: enriched });
  } catch (error) {
    console.error('Get my complaints error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Complaints: Create ───────────────────────────────────────
router.post('/complaints', auth, async (req, res) => {
  try {
    const { title, description, address, locationCoords, photo, type, priority } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    if (!description?.trim()) return res.status(400).json({ success: false, message: 'Description is required' });

    const complaint = await Complaint.create({
      user: req.user.id,
      title: title.trim(),
      description: description.trim(),
      address: address?.trim(),
      photo: photo?.trim(),
      locationCoords: locationCoords || undefined,
      status: 'received',
      priority: priority,
      type: type,
    });

    return res.status(201).json({ success: true, message: 'Complaint created', complaint });
  } catch (error) {
    console.error('Create complaint error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Complaints: Get by ID ────────────────────────────────────
router.get('/complaints/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id).populate('user', 'name email');
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });
    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('Get complaint error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Complaints: Update status ────────────────────────────────
router.patch('/complaints/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body || {};
    const allowed = ['received', 'in_review', 'resolved'];
    if (!allowed.includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status' });

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });
    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('Update status error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;

// ─── Complaints: Delete ───────────────────────────────────────
router.delete('/complaints/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint)
      return res.status(404).json({ success: false, message: 'Complaint not found' });

    // only owner or admin can delete
    if (
      complaint.user.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await complaint.deleteOne();
    return res.json({ success: true, message: 'Complaint deleted' });
  } catch (error) {
    console.error('Delete complaint error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Complaints: Update (Edit) ────────────────────────────────
router.put('/complaints/:id', auth, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint)
      return res.status(404).json({ success: false, message: 'Complaint not found' });

    if (
      complaint.user.toString() !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { title, description, address, photo } = req.body;

    if (title) complaint.title = title.trim();
    if (description) complaint.description = description.trim();
    if (address) complaint.address = address.trim();
    if (photo) complaint.photo = photo.trim();

    await complaint.save();
    return res.json({ success: true, complaint });
  } catch (error) {
    console.error('Edit complaint error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Complaints: Vote (upvote / downvote with toggle) ─────────
router.post('/complaints/:id/vote', auth, async (req, res) => {
  try {
    const { voteType } = req.body || {};
    if (!['upvote', 'downvote'].includes(voteType))
      return res.status(400).json({ success: false, message: 'Invalid voteType' });

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    const existing = await Vote.findOne({ user: req.user.id, complaint: req.params.id });

    if (existing) {
      if (existing.voteType === voteType) {
        // Toggle off (remove vote)
        await existing.deleteOne();
      } else {
        // Switch vote type
        existing.voteType = voteType;
        await existing.save();
      }
    } else {
      await Vote.create({ user: req.user.id, complaint: req.params.id, voteType });
    }

    // Return updated counts
    const upvotes = await Vote.countDocuments({ complaint: req.params.id, voteType: 'upvote' });
    const downvotes = await Vote.countDocuments({ complaint: req.params.id, voteType: 'downvote' });
    const myVote = await Vote.findOne({ user: req.user.id, complaint: req.params.id });

    return res.json({ success: true, likes: upvotes, dislikes: downvotes, userVote: myVote?.voteType || null });
  } catch (error) {
    console.error('Vote error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Comments: Get all for a complaint ─────────────────────
router.get('/complaints/:id/comments', auth, async (req, res) => {
  try {
    const comments = await Comment.find({ complaint: req.params.id })
      .populate('user', 'name profilePhoto')
      .sort({ createdAt: 1 });
    return res.json({ success: true, comments });
  } catch (error) {
    console.error('Get comments error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Comments: Add a comment ────────────────────────────────
router.post('/complaints/:id/comments', auth, async (req, res) => {
  try {
    const { content } = req.body || {};
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'Comment cannot be empty' });

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });

    const comment = await Comment.create({
      user: req.user.id,
      complaint: req.params.id,
      content: content.trim(),
    });

    await comment.populate('user', 'name profilePhoto');
    return res.status(201).json({ success: true, comment });
  } catch (error) {
    console.error('Add comment error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Comments: Delete a comment ────────────────────────────
router.delete('/comments/:commentId', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    // Only the comment author or an admin can delete
    if (comment.user.toString() !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Not authorized' });

    await comment.deleteOne();
    return res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ════════════════════════════════════════════════════════════════
// ─── VOLUNTEER ROUTES ────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════

// ─── Volunteer: Get all complaints ────────────────────────────
// Optionally filter by ?status=received|in_review|resolved
router.get('/volunteer/complaints', auth, isVolunteer, async (req, res) => {
  try {
    console.log(`[Volunteer:GET /volunteer/complaints] volunteer=${req.user.email} status-filter="${req.query.status || 'none'}"`);

    const filter = {};
    const { status } = req.query;
    const allowedStatuses = ['received', 'in_review', 'resolved'];
    if (status && allowedStatuses.includes(status)) filter.status = status;

    const complaints = await Complaint.find(filter)
      .populate('user', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    // Attach vote counts
    const complaintIds = complaints.map(c => c._id);
    const votes = await Vote.find({ complaint: { $in: complaintIds } });

    const countMap = {};
    votes.forEach(v => {
      const cid = v.complaint.toString();
      if (!countMap[cid]) countMap[cid] = { upvotes: 0, downvotes: 0 };
      if (v.voteType === 'upvote') countMap[cid].upvotes++;
      else countMap[cid].downvotes++;
    });

    const enriched = complaints.map(c => ({
      ...c.toObject(),
      likes: countMap[c._id.toString()]?.upvotes || 0,
      dislikes: countMap[c._id.toString()]?.downvotes || 0,
    }));

    console.log(`[Volunteer:GET /volunteer/complaints] returning ${enriched.length} complaints`);
    return res.json({ success: true, complaints: enriched });
  } catch (error) {
    console.error('[Volunteer:GET /volunteer/complaints] error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Volunteer: Get nearby complaints ──────────────────────────
// Query: ?lat=<lat>&lng=<lng>&radius=<km, default 10>
router.get('/volunteer/complaints/nearby', auth, isVolunteer, async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query;
    console.log(`[Volunteer:GET /volunteer/complaints/nearby] volunteer=${req.user.email} lat=${lat} lng=${lng} radius=${radius}km`);

    if (!lat || !lng) {
      console.warn('[Volunteer:GET /volunteer/complaints/nearby] Missing lat or lng');
      return res.status(400).json({ success: false, message: 'lat and lng query params are required' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusInMeters = parseFloat(radius) * 1000;

    if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusInMeters)) {
      console.warn('[Volunteer:GET /volunteer/complaints/nearby] Invalid coords');
      return res.status(400).json({ success: false, message: 'Invalid lat, lng or radius values' });
    }

    const complaints = await Complaint.find({
      locationCoords: {
        $near: {
          $geometry: { type: 'Point', coordinates: [longitude, latitude] },
          $maxDistance: radiusInMeters,
        },
      },
    })
      .populate('user', 'name email')
      .populate('assignedTo', 'name email profilePhoto');

    console.log(`[Volunteer:GET /volunteer/complaints/nearby] found ${complaints.length} complaints within ${radius}km`);
    return res.json({ success: true, complaints });
  } catch (error) {
    console.error('[Volunteer:GET /volunteer/complaints/nearby] error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Volunteer: Accept a complaint ────────────────────────────
// Status: received → in_review, assignedTo = this volunteer
router.post('/complaints/:id/accept', auth, isVolunteer, async (req, res) => {
  try {
    console.log(`[Volunteer:POST /complaints/${req.params.id}/accept] volunteer=${req.user.email}`);

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      console.warn(`[Volunteer:Accept] Complaint ${req.params.id} not found`);
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    if (complaint.status !== 'received') {
      console.warn(`[Volunteer:Accept] Cannot accept — current status is "${complaint.status}"`);
      return res.status(400).json({
        success: false,
        message: `Complaint is not available to accept (current status: ${complaint.status})`,
      });
    }

    complaint.status = 'in_review';
    complaint.assignedTo = req.user.id;
    await complaint.save();
    await complaint.populate('assignedTo', 'name email profilePhoto');
    await complaint.populate('user', 'name email');

    console.log(`[Volunteer:Accept] ✅ Complaint "${complaint.title}" accepted by ${req.user.email} → status: in_review`);
    return res.json({ success: true, message: 'Complaint accepted and is now In Review', complaint });
  } catch (error) {
    console.error('[Volunteer:Accept] error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Volunteer: Reject / Unassign a complaint ────────────────
// Status: in_review → received, clears assignedTo
// Only the volunteer who accepted it can reject
router.post('/complaints/:id/reject', auth, isVolunteer, async (req, res) => {
  try {
    console.log(`[Volunteer:POST /complaints/${req.params.id}/reject] volunteer=${req.user.email}`);

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      console.warn(`[Volunteer:Reject] Complaint ${req.params.id} not found`);
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    if (complaint.status !== 'in_review') {
      console.warn(`[Volunteer:Reject] Cannot reject — current status is "${complaint.status}"`);
      return res.status(400).json({
        success: false,
        message: `Only in_review complaints can be rejected (current status: ${complaint.status})`,
      });
    }

    if (complaint.assignedTo?.toString() !== req.user.id) {
      console.warn(`[Volunteer:Reject] DENIED — volunteer ${req.user.email} did not accept this complaint`);
      return res.status(403).json({ success: false, message: 'You can only reject complaints you accepted' });
    }

    complaint.status = 'received';
    complaint.assignedTo = null;
    await complaint.save();
    await complaint.populate('user', 'name email');

    console.log(`[Volunteer:Reject] ✅ Complaint "${complaint.title}" rejected by ${req.user.email} → status: received`);
    return res.json({ success: true, message: 'Complaint rejected and returned to received', complaint });
  } catch (error) {
    console.error('[Volunteer:Reject] error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Volunteer: Resolve a complaint ──────────────────────────
// Status: in_review → resolved
// Only the volunteer who accepted it can resolve
router.patch('/complaints/:id/resolve', auth, isVolunteer, async (req, res) => {
  try {
    console.log(`[Volunteer:PATCH /complaints/${req.params.id}/resolve] volunteer=${req.user.email}`);

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      console.warn(`[Volunteer:Resolve] Complaint ${req.params.id} not found`);
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    if (complaint.status !== 'in_review') {
      console.warn(`[Volunteer:Resolve] Cannot resolve — current status is "${complaint.status}"`);
      return res.status(400).json({
        success: false,
        message: `Only in_review complaints can be resolved (current status: ${complaint.status})`,
      });
    }

    if (complaint.assignedTo?.toString() !== req.user.id) {
      console.warn(`[Volunteer:Resolve] DENIED — volunteer ${req.user.email} did not accept this complaint`);
      return res.status(403).json({ success: false, message: 'You can only resolve complaints you accepted' });
    }

    complaint.status = 'resolved';
    await complaint.save();
    await complaint.populate('assignedTo', 'name email profilePhoto');
    await complaint.populate('user', 'name email');

    console.log(`[Volunteer:Resolve] ✅ Complaint "${complaint.title}" resolved by ${req.user.email}`);
    return res.json({ success: true, message: 'Complaint marked as Resolved', complaint });
  } catch (error) {
    console.error('[Volunteer:Resolve] error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── Volunteer: My stats ──────────────────────────────────────
// Returns how many complaints this volunteer has accepted, resolved, and total
router.get('/volunteer/stats', auth, isVolunteer, async (req, res) => {
  try {
    console.log(`[Volunteer:GET /volunteer/stats] volunteer=${req.user.email}`);

    const [accepted, resolved] = await Promise.all([
      Complaint.countDocuments({ assignedTo: req.user.id, status: 'in_review' }),
      Complaint.countDocuments({ assignedTo: req.user.id, status: 'resolved' }),
    ]);

    const stats = { accepted, resolved, total: accepted + resolved };
    console.log(`[Volunteer:Stats] ${req.user.email} → accepted=${accepted} resolved=${resolved} total=${stats.total}`);
    return res.json({ success: true, stats });
  } catch (error) {
    console.error('[Volunteer:Stats] error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});