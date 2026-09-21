import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

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
export async function adminList() {
  const token = localStorage.getItem("itm_admin_pw");
  const { data } = await api.get("/inquiries", { headers: { "X-Admin-Password": token } });
  return data;
}
export async function adminCreateListing(payload) {
  const token = localStorage.getItem("itm_admin_pw");
  const { data } = await api.post("/listings", payload, { headers: { "X-Admin-Password": token } });
  return data;
}
export async function adminUpdateListing(id, payload) {
  const token = localStorage.getItem("itm_admin_pw");
  const { data } = await api.put(`/listings/${id}`, payload, { headers: { "X-Admin-Password": token } });
  return data;
}
export async function adminDeleteListing(id) {
  const token = localStorage.getItem("itm_admin_pw");
  const { data } = await api.delete(`/listings/${id}`, { headers: { "X-Admin-Password": token } });
  return data;
}
