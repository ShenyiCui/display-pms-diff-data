/* eslint-disable */

import React from 'react';
import { useLocation } from 'react-router-dom';
import ReactDiffViewer from 'react-diff-viewer-continued';

const DiffView: React.FC = () => {
  const location = useLocation();

  // Parse query parameters from the URL
  const queryParams = new URLSearchParams(location.search);
  const v1Param: string | null = queryParams.get('v1');
  const v2Param: string | null = queryParams.get('v2');

  // Function to decode and parse JSON
  const decodeAndParse = (param: string | null, paramName: string): string => {
    if (!param) {
      return `No ${paramName} parameter provided`;
    }
    try {
      const decoded: string = decodeURIComponent(param);
      const parsed = JSON.parse(decoded);
      return JSON.stringify(parsed, null, 4);
    } catch (e: unknown) {
      return `Invalid JSON in ${paramName} parameter`;
    }
  };

  const jsonV1: string = decodeAndParse(v1Param, 'v1');
  const jsonV2: string = decodeAndParse(v2Param, 'v2');

  return (
    <div className='fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50'>
      <div className='bg-white rounded-lg p-4 w-11/12 h-5/6 overflow-auto'>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-xl font-bold'>Diff Viewer</h2>
        </div>
        <ReactDiffViewer oldValue={jsonV1} newValue={jsonV2} />
      </div>
    </div>
  );
};

export default DiffView;
