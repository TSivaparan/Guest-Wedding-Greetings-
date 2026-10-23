import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LangProvider } from "./i18n";
import GuestPage from "./pages/GuestPage";
import AdminPage from "./pages/AdminPage";

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<GuestPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<GuestPage />} />
        </Routes>
      </BrowserRouter>
    </LangProvider>
  );
}
