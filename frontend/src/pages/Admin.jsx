import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { adminLogin, adminLogout, adminCheckSession, adminList, adminCreateListing, adminUpdateListing, adminDeleteListing, getListings } from "@/lib/api";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";

const EMPTY = {
  kind: "rental", title: "", address: "", zip: "", city: "",
  net_rent: "", utilities: "", available_from: "", status: "available",
  rooms: "", area: "", year: "", pdf_url: "", image_url: "", description: "",
};

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [listings, setListings] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState("listings");

  useEffect(() => {
    localStorage.removeItem("itm_admin_pw"); // purge legacy plaintext password
    adminCheckSession().then(setAuthed);
  }, []);

  useEffect(() => { if (authed) refresh(); }, [authed]);

  const refresh = async () => {
    try {
      const [ls, inq] = await Promise.all([getListings(), adminList()]);
      setListings(ls);
      setInquiries(inq);
    } catch (e) {
      if (e?.response?.status === 401) {
        setAuthed(false);
        toast.error("Sitzung abgelaufen.");
      }
    }
  };

  const doLogin = async (e) => {
    e.preventDefault();
    try {
      await adminLogin(password);
      setPassword("");
      setAuthed(true);
      toast.success("Angemeldet.");
    } catch (e) {
      toast.error(e?.response?.status === 429 ? "Zu viele Versuche. Bitte später erneut." : "Falsches Passwort.");
    }
  };

  const save = async () => {
    const payload = { ...editing };
    ["net_rent", "utilities", "rooms", "area", "year"].forEach(k => {
      if (payload[k] === "" || payload[k] == null) delete payload[k];
      else payload[k] = Number(payload[k]);
    });
    try {
      if (editing.id) {
        await adminUpdateListing(editing.id, payload);
        toast.success("Objekt aktualisiert.");
      } else {
        await adminCreateListing(payload);
        toast.success("Objekt erstellt.");
      }
      setEditing(null);
      refresh();
    } catch (e) { toast.error("Speichern fehlgeschlagen."); }
  };

  const remove = async (id) => {
    if (!window.confirm("Wirklich löschen?")) return;
    try {
      await adminDeleteListing(id);
      toast.success("Gelöscht.");
      refresh();
    } catch (e) { toast.error("Löschen fehlgeschlagen."); }
  };

  const logout = async () => { await adminLogout().catch(() => {}); setAuthed(false); };

  if (!authed) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-4">
        <form onSubmit={doLogin} className="glass-strong rounded-2xl p-8 w-full max-w-md" data-testid="admin-login-form">
          <Link to="/" className="text-[10px] uppercase tracking-[0.28em] text-gold-light hover:text-gold flex items-center gap-2 mb-6">
            <ArrowLeft size={14}/> Zurück
          </Link>
          <div className="text-[10px] uppercase tracking-[0.28em] text-gold mb-2">Admin</div>
          <h1 className="font-serif text-3xl font-light tracking-tight text-white">Anmeldung</h1>
          <p className="mt-2 text-sm text-white/60">Passwort für die Verwaltung der Mietobjekte.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Passwort"
            data-testid="admin-password"
            className="mt-6 w-full bg-transparent border-b border-gold/30 focus:border-gold py-3 text-white outline-none"
          />
          <button className="mt-8 w-full h-11 rounded-full btn-gold text-[12px] uppercase tracking-[0.14em]" data-testid="admin-login-submit">
            Anmelden
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy text-white">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/" className="text-[10px] uppercase tracking-[0.28em] text-gold-light hover:text-gold flex items-center gap-2">
              <ArrowLeft size={14}/> Zur Website
            </Link>
            <h1 className="mt-3 font-serif text-3xl md:text-4xl font-light tracking-tight">Verwaltung</h1>
          </div>
          <button onClick={logout} className="h-9 px-4 rounded-full btn-ghost text-[11px] uppercase tracking-[0.14em]" data-testid="admin-logout">Abmelden</button>
        </div>

        <div className="flex items-center gap-2 mb-6">
          {[["listings", "Objekte"], ["inquiries", "Anfragen"]].map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)}
              data-testid={`admin-tab-${id}`}
              className={`h-9 px-4 rounded-full text-[11px] uppercase tracking-[0.14em] border transition-colors ${tab === id ? "bg-gold text-navy border-gold" : "border-gold/25 text-white/70 hover:border-gold/60"}`}>
              {l} {id === "inquiries" && `(${inquiries.length})`}
            </button>
          ))}
        </div>

        {tab === "listings" && (
          <>
            <div className="flex justify-end mb-4">
              <button onClick={() => setEditing({ ...EMPTY })} className="h-10 px-5 rounded-full btn-gold text-[11px] uppercase tracking-[0.14em] flex items-center gap-2" data-testid="admin-new-listing">
                <Plus size={14}/> Neues Objekt
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {listings.map(l => (
                <div key={l.id} className="glass rounded-2xl p-5" data-testid={`admin-listing-${l.id}`}>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-gold-light/80">{l.kind === "rental" ? "Miete" : "Referenz"} · {l.status}</div>
                  <div className="font-serif text-lg font-light tracking-tight mt-1">{l.title}</div>
                  <div className="text-xs text-white/60 mt-1">{l.address} · {l.zip} {l.city}</div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setEditing(l)} className="h-8 px-3 rounded-full btn-ghost text-[11px]">Bearbeiten</button>
                    <button onClick={() => remove(l.id)} className="h-8 px-3 rounded-full border border-red-400/40 text-red-300 text-[11px] hover:bg-red-500/10 flex items-center gap-1"><Trash2 size={12}/> Löschen</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "inquiries" && (
          <div className="space-y-3">
            {inquiries.length === 0 && <div className="glass rounded-2xl p-5 text-white/60 text-sm">Noch keine Anfragen.</div>}
            {inquiries.map(i => (
              <div key={i.id} className="glass rounded-2xl p-5" data-testid={`admin-inquiry-${i.id}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.28em] text-gold">{i.topic || "Kontakt"} · {new Date(i.created_at).toLocaleString("de-CH")}</div>
                    <div className="font-serif text-lg font-light mt-1">{i.name} <span className="text-white/50 text-sm">· {i.email}</span></div>
                  </div>
                </div>
                {i.message && <div className="mt-2 text-sm text-white/75 whitespace-pre-wrap">{i.message}</div>}
                <div className="mt-2 text-xs text-white/50">
                  {i.company && <>Firma: {i.company} · </>}
                  {i.phone && <>Tel: {i.phone} · </>}
                  {i.zip_city && <>{i.zip_city} · </>}
                  {i.listing_id && <>Objekt: {i.listing_id}</>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-navy/70 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="glass-strong rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-testid="admin-edit-modal">
            <div className="text-[10px] uppercase tracking-[0.28em] text-gold mb-2">{editing.id ? "Bearbeiten" : "Neu"}</div>
            <h2 className="font-serif text-2xl font-light tracking-tight text-white">Objekt</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
              <Sel label="Art" value={editing.kind} onChange={v => setEditing({ ...editing, kind: v })} opts={[["rental","Miete"],["reference","Referenz"]]}/>
              <Sel label="Status" value={editing.status} onChange={v => setEditing({ ...editing, status: v })} opts={[["available","Verfügbar"],["reserved","Reserviert"],["rented","Vermietet"],["reference","Referenz"]]}/>
              <Inp label="Titel *" value={editing.title} onChange={v => setEditing({ ...editing, title: v })} full/>
              <Inp label="Adresse *" value={editing.address} onChange={v => setEditing({ ...editing, address: v })} full/>
              <Inp label="PLZ" value={editing.zip} onChange={v => setEditing({ ...editing, zip: v })}/>
              <Inp label="Ort" value={editing.city} onChange={v => setEditing({ ...editing, city: v })}/>
              <Inp label="Netto CHF" type="number" value={editing.net_rent ?? ""} onChange={v => setEditing({ ...editing, net_rent: v })}/>
              <Inp label="NK akonto CHF" type="number" value={editing.utilities ?? ""} onChange={v => setEditing({ ...editing, utilities: v })}/>
              <Inp label="Verfügbar ab (YYYY-MM-DD)" value={editing.available_from ?? ""} onChange={v => setEditing({ ...editing, available_from: v })}/>
              <Inp label="Zimmer" type="number" value={editing.rooms ?? ""} onChange={v => setEditing({ ...editing, rooms: v })}/>
              <Inp label="Fläche m²" type="number" value={editing.area ?? ""} onChange={v => setEditing({ ...editing, area: v })}/>
              <Inp label="Baujahr" type="number" value={editing.year ?? ""} onChange={v => setEditing({ ...editing, year: v })}/>
              <Inp label="PDF URL" value={editing.pdf_url ?? ""} onChange={v => setEditing({ ...editing, pdf_url: v })} full/>
              <Inp label="Bild URL (z.B. /media/dachwohnung.png)" value={editing.image_url ?? ""} onChange={v => setEditing({ ...editing, image_url: v })} full/>
              <div className="md:col-span-2">
                <div className="text-[10px] uppercase tracking-[0.24em] text-gold-light/80 mb-1">Beschreibung</div>
                <textarea rows={3} value={editing.description ?? ""} onChange={e => setEditing({ ...editing, description: e.target.value })} className="w-full bg-transparent border-b border-gold/30 focus:border-gold py-2 text-white outline-none resize-none"/>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => setEditing(null)} className="h-10 px-5 rounded-full btn-ghost text-[11px] uppercase tracking-[0.14em]">Abbrechen</button>
              <button onClick={save} data-testid="admin-save" className="h-10 px-5 rounded-full btn-gold text-[11px] uppercase tracking-[0.14em] flex items-center gap-2"><Save size={14}/> Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Inp({ label, value, onChange, type = "text", full }) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <div className="text-[10px] uppercase tracking-[0.24em] text-gold-light/80 mb-1">{label}</div>
      <input type={type} value={value ?? ""} onChange={e => onChange(e.target.value)} className="w-full bg-transparent border-b border-gold/30 focus:border-gold py-2 text-white outline-none"/>
    </label>
  );
}
function Sel({ label, value, onChange, opts }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-[0.24em] text-gold-light/80 mb-1">{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-navy border-b border-gold/30 focus:border-gold py-2 text-white outline-none">
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
