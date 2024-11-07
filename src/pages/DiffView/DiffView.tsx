/* eslint-disable */

import React from 'react';
import { useLocation } from 'react-router-dom';
import ReactDiffViewer from 'react-diff-viewer-continued';
import pako from 'pako';

const DiffView: React.FC = () => {
  const location = useLocation();

  // Parse query parameters from the URL
  const queryParams = new URLSearchParams(location.search);
  const v1Param: string | null = queryParams.get('v1');
  const v2Param: string | null = queryParams.get('v2');

  // Function to decode, decompress, and parse JSON
  const decodeAndDecompress = (param: string | null, paramName: string): string => {
    if (!param) {
      return `No ${paramName} parameter provided`;
    }
    try {
      // Adjust Base64 URL-safe encoding
      let base64 = param.replace(/-/g, '+').replace(/_/g, '/');
      // Pad with '=' to make length a multiple of 4
      while (base64.length % 4) {
        base64 += '=';
      }

      // Base64 decode
      const binaryString = atob(base64);

      // Convert binary string to Uint8Array
      const binaryLen = binaryString.length;
      const bytes = new Uint8Array(binaryLen);
      for (let i = 0; i < binaryLen; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decompress using pako
      const decompressed = pako.inflate(bytes, { to: 'string' });

      // Parse JSON
      const parsed = JSON.parse(decompressed);
      return JSON.stringify(parsed, null, 4);
    } catch (e: unknown) {
      console.error(`Error decoding ${paramName}:`, e);
      return `Invalid compressed data or JSON in ${paramName} parameter`;
    }
  };

  const jsonV1: string = decodeAndDecompress(v1Param, 'v1');
  const jsonV2: string = decodeAndDecompress(v2Param, 'v2');

  return (
    <div className='fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50'>
      <div className='bg-white rounded-lg p-4 w-11/12 h-5/6 overflow-auto'>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-xl font-bold'>Diff Viewer</h2>
          {/* Add your closeModal functionality here if needed */}
        </div>
        <ReactDiffViewer oldValue={jsonV1} newValue={jsonV2} />
      </div>
    </div>
  );
};

export default DiffView;
