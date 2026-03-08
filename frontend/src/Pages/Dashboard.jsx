import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import NavBar from '../Components/common/NavBar';
import Footer from '../Components/common/Footer';
import { getCurrentUser } from '../services/authService';
import { getMyComplaints, getAllComplaints } from '../services/complaintService';

const Dashboard = () => {
  const navigate = useNavigate();

  const currentUser = getCurrentUser() || { name: 'User' };
  const role = currentUser?.role;

  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [allComplaints, setAllComplaints] = useState([]);

  useEffect(() => {
  const fetchData = async () => {
    setLoadingReports(true);
    try {
      if (role === 'volunteer') {
        const data = await getAllComplaints();
        setAllComplaints(data.complaints || []);
      } else {
        const data = await getMyComplaints();
        setReports(data.complaints || []);
      }
    } catch {
      setReports([]);
      setAllComplaints([]);
    } finally {
      setLoadingReports(false);
    }
  };

  fetchData();
}, [role]);

  const volunteerId = currentUser?._id || currentUser?.id;

const totalComplaints = allComplaints.length;

const assignedToMe = allComplaints.filter(
  c => c.assignedTo?._id === volunteerId || c.assignedTo === volunteerId
);

const resolvedByMe = assignedToMe.filter(
  c => c.status === 'resolved'
);

const pendingByMe = assignedToMe.filter(
  c => c.status !== 'resolved'
);

  const inProgress = reports.filter(r => r.status === 'in_review').length;
  const resolved = reports.filter(r => r.status === 'resolved').length;

  if (role === 'volunteer') {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF6F0] to-[#E2F5F2] font-sans text-gray-800 flex flex-col">
      <NavBar />

      <div className="flex-1 max-w-6xl w-full mx-auto p-8 pt-12">
        <header className="mb-12 text-left">
          <h1 className="text-4xl font-black tracking-tight text-gray-800">
            Welcome, {currentUser.name?.split(' ')[0]}
          </h1>
          <p className="text-gray-500 font-medium mt-1">
            Manage and resolve community complaints
          </p>
        </header>

       {/* VOLUNTEER STATS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">
         <StatCard label="Total Complaints" val={loadingReports ? '...' : allComplaints.length} />
<StatCard label="Assigned to Me" val={loadingReports ? '...' : assignedToMe.length} />
<StatCard label="Resolved by Me" val={loadingReports ? '...' : resolvedByMe.length} />
<StatCard label="Pending" val={loadingReports ? '...' : pendingByMe.length} />
        </div>

        {/* ASSIGNED COMPLAINTS */}
        <div className="bg-white/40 backdrop-blur-md rounded-3xl border border-white/60 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-white/60 flex items-center justify-between">
            <h2 className="font-black text-gray-800 text-lg">My Assigned Complaints</h2>
            <button
              onClick={() => navigate('/complaints')}
              className="bg-[#F87171] hover:bg-[#EF4444] text-white text-sm font-bold px-4 py-2 rounded-lg shadow-md"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-white/60">
           {assignedToMe.length === 0 ? (
  <p className="p-6 text-center text-gray-500">
    No complaints assigned yet
  </p>
) : (
  assignedToMe.map(c => (
    <div key={c._id} className="p-5 flex justify-between">
      <div>
        <p className="font-bold text-gray-800">{c.title}</p>
        <p className="text-xs text-gray-500">{c.address || 'No address'}</p>
      </div>
      <StatusBadge status={c.status} />
    </div>
  ))
)}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

  /* USER DASHBOARD */

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF6F0] to-[#E2F5F2] font-sans text-gray-800 flex flex-col">
      <NavBar />

      <div className="flex-1 max-w-6xl w-full mx-auto p-8 pt-12">
        <header className="mb-12 text-left">
          <h1 className="text-4xl font-black tracking-tight text-gray-800">
            Welcome, {currentUser.name?.split(' ')[0]}
          </h1>
          <p className="text-gray-500 font-medium mt-1">
            Ready to make your neighborhood better?
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <StatCard label="Total Reports" val={loadingReports ? '...' : reports.length} />
          <StatCard label="In Progress" val={loadingReports ? '...' : inProgress} />
          <StatCard label="Fixed Issues" val={loadingReports ? '...' : resolved} />
        </div>

        {!loadingReports && reports.length === 0 ? (
          <div className="bg-white/40 backdrop-blur-md rounded-[40px] p-16 shadow-sm border border-white/60 text-center">
            <div className="bg-white/50 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 transform rotate-3 transition-transform hover:rotate-0">
              <ClipboardList className="text-teal-300" size={48} />
            </div>
            <h3 className="text-3xl font-black text-gray-800 mb-4 tracking-tight">
              No activity reported yet
            </h3>
            <p className="text-gray-500 max-w-md mx-auto mb-10 text-lg leading-relaxed">
              Your neighborhood is looking clean! If you spot an issue, click below to let us know.
            </p>
            <button
              onClick={() => navigate('/report')}
              className="bg-[#F87171] hover:bg-[#EF4444] text-white px-12 py-5 rounded-2xl font-black transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-200 text-sm tracking-widest uppercase"
            >
              Create New Report +
            </button>
          </div>
        ) : (
          <div className="bg-white/40 backdrop-blur-md rounded-3xl border border-white/60 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-white/60 flex items-center justify-between">
              <h2 className="font-black text-gray-800 text-lg">Your Reports</h2>
              <button
                onClick={() => navigate('/report')}
                className="bg-[#F87171] hover:bg-[#EF4444] text-white text-sm font-bold px-4 py-2 rounded-lg shadow-md shadow-red-200 transition-all"
              >
                + New Report
              </button>
            </div>
            <div className="divide-y divide-white/60">
              {reports.map((report) => (
                <div key={report._id} className="p-5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-800">{report.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {report.address || 'No address'}
                    </p>
                  </div>
                  <StatusBadge status={report.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

const StatCard = ({ label, val }) => (
  <div className="bg-white/40 backdrop-blur-md p-10 rounded-[40px] shadow-sm border border-white/60 transition-all hover:border-teal-200 group">
    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 group-hover:text-teal-500 transition-colors">
      {label}
    </p>
    <p className="text-7xl font-black text-gray-800 leading-none">{val}</p>
  </div>
);

const StatusBadge = ({ status }) => {
  const styles = {
    received: 'bg-blue-50 text-blue-600',
    in_review: 'bg-yellow-50 text-yellow-600',
    resolved: 'bg-teal-50 text-teal-600',
  };
  const labels = {
    received: 'Received',
    in_review: 'In Review',
    resolved: 'Resolved',
  };
  return (
    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${styles[status] || 'bg-gray-50 text-gray-500'}`}>
      {labels[status] || status}
    </span>
  );
};

export default Dashboard;