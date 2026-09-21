import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
import Admin from "@/pages/Admin";
import Impressum from "@/pages/Impressum";
import Datenschutz from "@/pages/Datenschutz";
import { useTheme } from "@/lib/useTheme";
import "@/App.css";

function App() {
  useTheme(); // ensure body[data-theme] set

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/impressum" element={<Impressum />} />
          <Route path="/datenschutz" element={<Datenschutz />} />
        </Routes>
      </BrowserRouter>
      <Toaster theme="dark" position="top-right" toastOptions={{ style: { background: "#0A1428", color: "#fff", border: "1px solid rgba(201,169,110,.3)" } }} />
    </div>
  );
}

export default App;
