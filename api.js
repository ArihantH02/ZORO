// Use global io from CDN
const API_URL = 'http://localhost:3000/api';
export const socket = window.io ? window.io('http://localhost:3000') : null;

// Local state tracking for User Session
export const getLocalRoleState = () => {
  const data = localStorage.getItem('zoro_user');
  if (!data) return { role: 'Employee', dept: 'IT', empId: 'EMP-IT-001' };
  return JSON.parse(data);
};

export const setLocalRoleState = (role, dept, empId, companyName) => {
  localStorage.setItem('zoro_user', JSON.stringify({ role, dept, empId, companyName }));
};

// API Fetchers
export const fetchState = async (role, dept) => {
  const params = new URLSearchParams();
  if (role) params.append('role', role);
  if (dept) params.append('dept', dept);
  const res = await fetch(`${API_URL}/state?${params.toString()}`);
  return res.json();
};

export const createRequest = async (data) => {
  const res = await fetch(`${API_URL}/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
};

export const registerUser = async (data) => {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
};

export const loginUser = async (data) => {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
};

export const onboardCompany = async (data) => {
  const res = await fetch(`${API_URL}/auth/onboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
};

export const updateRequestStatus = async (id, status, role, amount = null) => {
  const payload = { status, role };
  if (amount) payload.amount = amount;
  
  const res = await fetch(`${API_URL}/requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (data.error) throw new Error(data.message);
  return data;
};

export const runAutoAllocation = async (role) => {
  const res = await fetch(`${API_URL}/allocate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role })
  });
  return res.json();
};

export const fetchComments = async (id) => {
  const res = await fetch(`${API_URL}/requests/${id}/comments`);
  return res.json();
};

export const addComment = async (id, role, comment) => {
  const res = await fetch(`${API_URL}/requests/${id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, comment })
  });
  return res.json();
};

export const fetchAuditLogs = async () => {
  const res = await fetch(`${API_URL}/audit`);
  return res.json();
};export const updateTotalBudget = async (amount) => {
  const res = await fetch(`${API_URL}/budget/total`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount })
  });
  return res.json();
};

export const createDepartment = async (name, priority, role, employees = []) => {
  const res = await fetch(`${API_URL}/departments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, priority, role, employees })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create department');
  return data;
};
