import axios from "axios";

// Same-origin by default (Vercel serves the API under /api). Override only for local dev.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });

// Admin writes carry this header; the backend rejects writes without it (CSRF guard).
const ADMIN_HEADERS = { "X-ITM-Admin": "1" };

export async function getListings(kind) {
  const { data } = await api.get("/listings", { params: kind ? { kind } : {} });
  return data;
}
export async function createInquiry(payload) {
  const { data } = await api.post("/inquiries", payload);
  return data;
}
export async function postValuation(payload) {
  const { data } = await api.post("/valuation", payload);
  return data;
}
export async function adminLogin(password) {
  const { data } = await api.post("/admin/login", { password });
  return data;
}
export async function adminLogout() {
  await api.post("/admin/logout");
}
export async function adminCheckSession() {
  try {
    await api.get("/admin/me");
    return true;
  } catch {
    return false;
  }
}
export async function adminList() {
  const { data } = await api.get("/inquiries");
  return data;
}
export async function adminCreateListing(payload) {
  const { data } = await api.post("/listings", payload, { headers: ADMIN_HEADERS });
  return data;
}
export async function adminUpdateListing(id, payload) {
  const { data } = await api.put(`/listings/${id}`, payload, { headers: ADMIN_HEADERS });
  return data;
}
export async function adminDeleteListing(id) {
  const { data } = await api.delete(`/listings/${id}`, { headers: ADMIN_HEADERS });
  return data;
}
