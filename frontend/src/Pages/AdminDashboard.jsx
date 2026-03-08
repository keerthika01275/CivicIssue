import React, { useEffect, useState } from "react";
import NavBar from "../Components/common/NavBar";
import Footer from "../Components/common/Footer";
import { getAllComplaints } from "../services/complaintService";
import { getAllUsers } from "../services/authService";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid
} from "recharts";

const COLORS = ["#14B8A6", "#F59E0B", "#EF4444", "#6366F1", "#8B5CF6"];

const AdminDashboard = () => {

const [users,setUsers] = useState([]);
const [complaints,setComplaints] = useState([]);
const [loading,setLoading] = useState(true);

useEffect(()=>{
fetchData();
},[])

const fetchData = async () =>{
 try{

 const userData = await getAllUsers();
 const complaintData = await getAllComplaints();

 setUsers(userData?.users || userData || []);
 setComplaints(complaintData?.complaints || complaintData || []);

 }catch(e){
 console.log(e)
 }finally{
 setLoading(false)
 }
}

/* ----------------------- STATUS DATA ---------------------- */

const pending = complaints.filter(c=>c.status === "received");
const inReview = complaints.filter(c=>c.status === "in_review");
const resolved = complaints.filter(c=>c.status === "resolved");

const statusData = [
 {name:"Pending", value:pending.length},
 {name:"In Review", value:inReview.length},
 {name:"Resolved", value:resolved.length}
];

/* ----------------------- USER ROLE DATA ---------------------- */

const roleCounts = users.reduce((acc,user)=>{
 acc[user.role] = (acc[user.role] || 0) + 1;
 return acc;
},{})

const roleData = Object.keys(roleCounts).map(role=>({
 name:role,
 value:roleCounts[role]
}))

/* ----------------------- COMPLAINT TYPE DATA ---------------------- */

const typeCounts = complaints.reduce((acc,c)=>{
 const type = c.type || "Other";
 acc[type] = (acc[type] || 0) + 1;
 return acc;
},{})

const typeData = Object.keys(typeCounts).map(type=>({
 name:type,
 value:typeCounts[type]
}))

/* ----------------------- TOP 5 TYPES ---------------------- */

const topTypes = Object.entries(typeCounts)
.sort((a,b)=>b[1]-a[1])
.slice(0,5)
.map(([type,count])=>({
 name:type,
 value:count
}))

/* ----------------------- LAST 7 DAYS COMPLAINTS ---------------------- */

const last7DaysData = Array.from({length:7}).map((_,i)=>{
 const date = new Date();
 date.setDate(date.getDate() - (6-i));
 const day = date.toLocaleDateString("en-US",{weekday:"short"});

 const count = complaints.filter(c=>{
 const d = new Date(c.createdAt);
 return d.toDateString() === date.toDateString();
 }).length;

 return {day,count}
})

/* ----------------------- LAST 30 DAYS USER REGISTRATION ---------------------- */

const last30DaysUsers = Array.from({length:30}).map((_,i)=>{
 const date = new Date();
 date.setDate(date.getDate() - (29-i));

 const count = users.filter(u=>{
 const d = new Date(u.createdAt);
 return d.toDateString() === date.toDateString();
 }).length;

 return {
 day:date.getDate(),
 count
 }
})

/* ----------------------- MONTHLY COMPLAINT TREND ---------------------- */

const monthCounts = {};

complaints.forEach(c=>{
 const month = new Date(c.createdAt).toLocaleString("default",{month:"short"});
 monthCounts[month] = (monthCounts[month] || 0) + 1;
})

const monthlyData = Object.keys(monthCounts).map(m=>({
 month:m,
 value:monthCounts[m]
}))

return(

<div className="min-h-screen bg-gradient-to-b from-[#FFF6F0] to-[#E2F5F2] flex flex-col">

<NavBar/>

<div className="flex-1 max-w-7xl mx-auto w-full p-8">

<h1 className="text-4xl font-black mb-10">
Admin Dashboard
</h1>

{/* STAT CARDS */}

<div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">

<StatCard label="Total Users" val={loading ? "..." : users.length}/>
<StatCard label="Total Complaints" val={loading ? "..." : complaints.length}/>
<StatCard label="Pending Complaints" val={loading ? "..." : pending.length}/>
<StatCard label="Resolved Complaints" val={loading ? "..." : resolved.length}/>

</div>

{/* ---------------- ANALYTICS SECTION ---------------- */}

<div className="grid md:grid-cols-2 gap-10 mb-16">

{/* Complaint Status */}

<ChartCard title="Complaint Status Distribution">
<ResponsiveContainer width="100%" height={300}>
<PieChart>
<Pie data={statusData} dataKey="value" outerRadius={100} label>
{statusData.map((entry,index)=>(
<Cell key={index} fill={COLORS[index % COLORS.length]}/>
))}
</Pie>
<Tooltip/>
</PieChart>
</ResponsiveContainer>
</ChartCard>

{/* Complaint Types */}

<ChartCard title="Complaint Types">
<ResponsiveContainer width="100%" height={300}>
<PieChart>
<Pie data={typeData} dataKey="value" outerRadius={100} label>
{typeData.map((entry,index)=>(
<Cell key={index} fill={COLORS[index % COLORS.length]}/>
))}
</Pie>
<Tooltip/>
</PieChart>
</ResponsiveContainer>
</ChartCard>

{/* User Roles */}

<ChartCard title="User Roles">
<ResponsiveContainer width="100%" height={300}>
<PieChart>
<Pie data={roleData} dataKey="value" outerRadius={100} label>
{roleData.map((entry,index)=>(
<Cell key={index} fill={COLORS[index % COLORS.length]}/>
))}
</Pie>
<Tooltip/>
</PieChart>
</ResponsiveContainer>
</ChartCard>

{/* Top Complaint Types */}

<ChartCard title="Top 5 Complaint Types">
<ResponsiveContainer width="100%" height={300}>
<BarChart layout="vertical" data={topTypes}>
<XAxis type="number"/>
<YAxis type="category" dataKey="name"/>
<Tooltip/>
<Bar dataKey="value" fill="#14B8A6"/>
</BarChart>
</ResponsiveContainer>
</ChartCard>

{/* Complaints Last 7 Days */}

<ChartCard title="Complaints (Last 7 Days)">
<ResponsiveContainer width="100%" height={300}>
<LineChart data={last7DaysData}>
<CartesianGrid strokeDasharray="3 3"/>
<XAxis dataKey="day"/>
<YAxis/>
<Tooltip/>
<Line type="monotone" dataKey="count" stroke="#14B8A6"/>
</LineChart>
</ResponsiveContainer>
</ChartCard>

{/* User Registrations */}

<ChartCard title="User Registrations (Last 30 Days)">
<ResponsiveContainer width="100%" height={300}>
<LineChart data={last30DaysUsers}>
<CartesianGrid strokeDasharray="3 3"/>
<XAxis dataKey="day"/>
<YAxis/>
<Tooltip/>
<Line type="monotone" dataKey="count" stroke="#6366F1"/>
</LineChart>
</ResponsiveContainer>
</ChartCard>

{/* Monthly Complaint Trends */}

<ChartCard title="Monthly Complaint Trends">
<ResponsiveContainer width="100%" height={300}>
<BarChart data={monthlyData}>
<XAxis dataKey="month"/>
<YAxis/>
<Tooltip/>
<Bar dataKey="value" fill="#F59E0B"/>
</BarChart>
</ResponsiveContainer>
</ChartCard>

</div>

</div>

<Footer/>

</div>

)

}

/* ---------------- STAT CARD ---------------- */

const StatCard = ({label,val}) => (

<div className="bg-white p-10 rounded-3xl shadow">

<p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
{label}
</p>

<p className="text-5xl font-black">
{val}
</p>

</div>

)

/* ---------------- CHART CARD ---------------- */

const ChartCard = ({title,children}) =>(

<div className="bg-white rounded-3xl shadow p-8">

<h2 className="text-xl font-bold mb-6">
{title}
</h2>

{children}

</div>

)

export default AdminDashboard;