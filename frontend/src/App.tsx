import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Book } from './pages/Book';
import { Lookup } from './pages/Lookup';
import { Admin } from './pages/Admin';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/book" replace />} />
        <Route path="/book" element={<Book />} />
        <Route path="/lookup" element={<Lookup />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/book" replace />} />
      </Route>
    </Routes>
  );
}
