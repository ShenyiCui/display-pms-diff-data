import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { routes } from '@/constants/routes';
import Home from '@pages/Home';
import Capability from '@/pages/Capability';
import DiffView from '@/pages/DiffView';

const BaseRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={routes.home} element={<Home />} />
        <Route path={routes.capability} element={<Capability />} />
        <Route path={routes.diffview} element={<DiffView />} />
      </Routes>
    </BrowserRouter>
  );
};

export default BaseRouter;
