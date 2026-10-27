import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Contracts } from './pages/Contracts';
import { ContractDetail } from './pages/ContractDetail';
import { Deadlines } from './pages/Deadlines';
import { Search } from './pages/Search';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="contrats" element={<Contracts />} />
          <Route path="contrats/:id" element={<ContractDetail />} />
          <Route path="echeances" element={<Deadlines />} />
          <Route path="recherche" element={<Search />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
