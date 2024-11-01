import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { routes } from '@/constants/routes';
import Home from '@pages/Home';
import Capability from '@/pages/Capability';

const BaseRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={routes.home} element={<Home />} />
        <Route path={routes.capability} element={<Capability />} />
      </Routes>
    </BrowserRouter>
  );
};

export default BaseRouter;
