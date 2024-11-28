/* eslint-disable */

import React, { useState, ChangeEvent } from 'react';
import { JsonView, defaultStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import ReactDiffViewer from 'react-diff-viewer-continued';
import pako from 'pako';

interface BaseInfo {
  LogID?: string;
  Caller?: string;
  Addr?: string;
  Client?: string;
}

interface QueryElementKeyInfoReqV1 {
  payment_method_id?: string;
  country_code?: string;
  params?: any;
  info_type?: any;
  pms_version?: number;
  is_channel_rule_returned?: any;
  Base?: BaseInfo;
}

interface ElementParams {
  AccountType?: number;
  ExtraParams?: any;
}

interface QueryElementKeyInfoReqV2 {
  payment_method?: string;
  country_code?: string;
  fund_flow?: number;
  element_params?: ElementParams;
  payment_method_id?: string;
  element_info_type?: number;
  query_type?: any;
  Base?: BaseInfo;
}

interface Issue {
  diff_reason: string;
  v2v3_field: string;
  v2_value: string | null;
  v3_value: string | null;
}

interface Source {
  log_id?: string;
  created_at?: string;
  req_function_name?: string;
  is_diff_found?: boolean;
  res_pmid?: string;
  query_element_key_info_req_v1?: QueryElementKeyInfoReqV1;
  query_element_key_info_req_v2?: QueryElementKeyInfoReqV2;
  issues?: Issue[];
  diff_issues?: string; // Added diff_issues field
  // Other fields can be added here if needed
}
interface Item {
  _index: string;
  _type: string;
  _id: string;
  _score: number;
  _source: Source;
}

// Function to extract EKG_V1 and EKG_V2 from diff_issues
function extractEKGV1V2(diffIssues: string): { ekgV1: string; ekgV2: string } {
  if (!diffIssues) {
    return { ekgV1: '', ekgV2: '' };
  }
  const [ekgV1, ekgV2] = diffIssues.split('/');
  return {
    ekgV1: ekgV1 || '',
    ekgV2: ekgV2 || '',
  };
}

// Function to generate a unique key based on res_pmid, EKG_V1, EKG_V2, and sorted issues
function generateUniqueKey(item: Item): string {
  const resPmid = item._source.res_pmid || '';
  const issues = item._source.issues || [];
  const diffIssues = item._source.diff_issues || '';
  const { ekgV1, ekgV2 } = extractEKGV1V2(diffIssues);

  // Deep copy and sort the issues array by v2v3_field
  const sortedIssues = issues
    .map(issue => ({ ...issue })) // Create a shallow copy of each issue
    .sort((a, b) => {
      if (a.v2v3_field < b.v2v3_field) return -1;
      if (a.v2v3_field > b.v2v3_field) return 1;
      return 0;
    });

  // Stringify the sorted issues array
  const issuesString = JSON.stringify(sortedIssues);

  // Generate a unique key combining resPmid, EKG_V1, EKG_V2, and issuesString
  return `${resPmid}_${ekgV1}_${ekgV2}_${issuesString}`;
}

function base64EncodeUint8Array(uint8Array: Uint8Array): string {
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

function compressAndEncode(data: string): string {
  const compressedData = pako.deflate(data);
  const base64Encoded = base64EncodeUint8Array(compressedData);
  // URL safe base64 encoding
  return base64Encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const Home: React.FC = () => {
  const [jsonData, setJsonData] = useState<Item[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalData, setModalData] = useState<{ v1: any; v2: any }>({ v1: null, v2: null });

  // Function to handle opening the modal with diff data
  const openModal = (v1: any, v2: any) => {
    setModalData({ v1, v2 });
    setShowModal(true);
  };

  // Function to handle closing the modal
  const closeModal = () => {
    setShowModal(false);
    setModalData({ v1: null, v2: null });
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          const result = e.target?.result;
          if (typeof result === 'string') {
            const parsedData = JSON.parse(result) as Item[];
            setJsonData(parsedData);
          } else {
            console.error('Unexpected result type:', typeof result);
          }
        } catch (error) {
          console.error('Error parsing JSON:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  // Process jsonData to group items by unique key and keep the first occurrence
  const uniqueItemsMap = new Map<string, Item>();

  jsonData.forEach(item => {
    if (item._source.is_diff_found) {
      const uniqueKey = generateUniqueKey(item);
      if (!uniqueItemsMap.has(uniqueKey)) {
        uniqueItemsMap.set(uniqueKey, item);
      }
    }
  });

  const uniqueItems = Array.from(uniqueItemsMap.values());

  // Function to export the table data as CSV
  const exportToCSV = () => {
    if (uniqueItems.length === 0) {
      alert('No data available to export.');
      return;
    }

    const headers = [
      'S/N',
      'PMID',
      'EKG V1',
      'EKG V2',
      'Log ID',
      'Created At',
      'PMS V1 Request',
      'PMS V2 Request',
      'V1 Res',
      'V2 Res',
      'Difference Visualiser',
    ];

    const rows = uniqueItems.map((item, i) => {
      const { ekgV1, ekgV2 } = extractEKGV1V2(item._source.diff_issues || '');

      const { Base: baseV1, ...reqV1WithoutBase } = item._source.query_element_key_info_req_v1 || {};
      const { Base: baseV2, ...reqV2WithoutBase } = item._source.query_element_key_info_req_v2 || {};
      const pmid = item._source.res_pmid || '';
      const logId = item._source.log_id || '';
      const createdAt = item._source.created_at ? new Date(item._source.created_at).toISOString() : '';

      // Prepare V1 Res and V2 Res data
      const issues = item._source.issues || [];

      const relevantIssues = issues
        .sort((a, b) => a.v2v3_field.localeCompare(b.v2v3_field))
        .filter(issue => issue.v2v3_field.startsWith('EleKeyInfoMap') || issue.v2v3_field.startsWith('EleMap'))
        .filter(issue => issue.v2v3_field.includes('DisplayTag') || issue.v2v3_field.includes('PIAvailabilityCheckTag'));

      const v1ResData: { [key: string]: any } = {};
      const v2ResData: { [key: string]: any } = {};

      relevantIssues.forEach(issue => {
        const fields = issue.v2v3_field.split(',');
        if (fields.length >= 3 && (fields[0] === 'EleKeyInfoMap' || fields[0] === 'EleMap')) {
          const key = fields[1];
          const subKey = fields[2];

          if (!v1ResData[key]) {
            v1ResData[key] = {};
          }
          if (!v2ResData[key]) {
            v2ResData[key] = {};
          }

          v1ResData[key][subKey] = issue.v2_value;
          v2ResData[key][subKey] = issue.v3_value;
        }
      });

      const v1Res = JSON.stringify(v1ResData);
      const v2Res = JSON.stringify(v2ResData);

      // Generate the difference visualizer link
      const encodedV1Res = compressAndEncode(v1Res);
      const encodedV2Res = compressAndEncode(v2Res);
      const link = `https://pms-diff-display.netlify.app/diffview?v1=${encodedV1Res}&v2=${encodedV2Res}`;

      const reqV1 = JSON.stringify(reqV1WithoutBase);
      const reqV2 = JSON.stringify(reqV2WithoutBase);

      return [(i + 1).toString(), pmid, ekgV1, ekgV2, logId, createdAt, reqV1, reqV2, v1Res, v2Res, link];
    });

    // Construct CSV content
    let csvContent = '';
    csvContent += headers.join(',') + '\r\n';
    rows.forEach((row, i) => {
      const escapedRow = row.map(field => `"${field.replace(/"/g, '""')}"`).join(',');
      csvContent += escapedRow + '\r\n';
    });

    // Create a Blob from the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // Create a link to download the Blob
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'table_data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className='container p-4'>
      <h1 className='text-2xl font-bold mb-4'>QueryElement/KeyInfo Diff Visualiser</h1>
      <div className='flex items-center mb-4'>
        <input type='file' accept='.json' onChange={handleFileUpload} className='mr-4' />
        <button onClick={exportToCSV} className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'>
          Export as CSV
        </button>
      </div>
      <table className='table-auto w-full border-collapse'>
        <thead>
          <tr>
            <th className='px-4 py-2 border bg-gray-200'>S/N</th>
            <th className='px-4 py-2 border bg-gray-200'>PMID</th>
            <th className='px-4 py-2 border bg-gray-200'>EKG V1</th>
            <th className='px-4 py-2 border bg-gray-200'>EKG V2</th>
            <th className='px-4 py-2 border bg-gray-200'>Log ID</th>
            <th className='px-4 py-2 border bg-gray-200'>Created At</th>
            <th className='px-4 py-2 border bg-gray-200'>PMS V1 Request</th>
            <th className='px-4 py-2 border bg-gray-200'>PMS V2 Request</th>
            <th className='px-4 py-2 border bg-gray-200'>V1 Res</th>
            <th className='px-4 py-2 border bg-gray-200'>V2 Res</th>
            <th className='px-4 py-2 border bg-gray-200'>Difference Visualiser</th>
            <th className='px-4 py-2 border bg-gray-200'>Diff</th>
          </tr>
        </thead>
        <tbody>
          {uniqueItems.map((item, index) => {
            const { ekgV1, ekgV2 } = extractEKGV1V2(item._source.diff_issues || '');
            const logId = item._source.log_id || '';
            const createdAt = item._source.created_at ? new Date(item._source.created_at).toISOString() : '';

            let issues = item._source.issues || [];

            // Sort issues by v2v3_field for consistent processing
            issues = issues.sort((a, b) => a.v2v3_field.localeCompare(b.v2v3_field));

            const relevantIssues = issues
              .filter(issue => issue.v2v3_field.startsWith('EleKeyInfoMap') || issue.v2v3_field.startsWith('EleMap'))
              .filter(issue => issue.v2v3_field.includes('DisplayTag') || issue.v2v3_field.includes('PIAvailabilityCheckTag'));

            const v1ResData: { [key: string]: any } = {};
            const v2ResData: { [key: string]: any } = {};

            relevantIssues.forEach(issue => {
              const fields = issue.v2v3_field.split(',');
              if (fields.length >= 3 && (fields[0] === 'EleKeyInfoMap' || fields[0] === 'EleMap')) {
                const key = fields[1];
                const subKey = fields[2];

                if (!v1ResData[key]) {
                  v1ResData[key] = {};
                }
                if (!v2ResData[key]) {
                  v2ResData[key] = {};
                }

                v1ResData[key][subKey] = issue.v2_value;
                v2ResData[key][subKey] = issue.v3_value;
              }
            });

            // Exclude 'Base' from PMS V1 Request
            const { Base: baseV1, ...reqV1WithoutBase } = item._source.query_element_key_info_req_v1 || {};

            // Exclude 'Base' from PMS V2 Request
            const { Base: baseV2, ...reqV2WithoutBase } = item._source.query_element_key_info_req_v2 || {};

            // Generate the difference visualizer link
            const encodedV1Res = compressAndEncode(JSON.stringify(v1ResData));
            const encodedV2Res = compressAndEncode(JSON.stringify(v2ResData));
            const link = `https://pms-diff-display.netlify.app/diffview?v1=${encodedV1Res}&v2=${encodedV2Res}`;

            return (
              <tr key={index} className='odd:bg-white even:bg-gray-50'>
                <td className='px-4 py-2 border'>{(index + 1).toString()}</td>
                <td className='px-4 py-2 border'>{item._source.res_pmid}</td>
                <td className='px-4 py-2 border'>{ekgV1}</td>
                <td className='px-4 py-2 border'>{ekgV2}</td>
                <td className='px-4 py-2 border'>{logId}</td>
                <td className='px-4 py-2 border'>{createdAt}</td>
                <td className='px-4 py-2 border'>
                  <div className='max-h-64 overflow-y-auto'>
                    {item._source.query_element_key_info_req_v1 && <JsonView data={reqV1WithoutBase} style={defaultStyles} />}
                  </div>
                </td>
                <td className='px-4 py-2 border'>
                  <div className='max-h-64 overflow-y-auto'>
                    {item._source.query_element_key_info_req_v2 && <JsonView data={reqV2WithoutBase} style={defaultStyles} />}
                  </div>
                </td>
                <td className='px-4 py-2 border'>
                  {Object.keys(v1ResData).length > 0 && <JsonView data={v1ResData} style={defaultStyles} />}
                </td>
                <td className='px-4 py-2 border'>
                  {Object.keys(v2ResData).length > 0 && <JsonView data={v2ResData} style={defaultStyles} />}
                </td>
                <td className='px-4 py-2 border'>
                  <a href={link} target='_blank' rel='noopener noreferrer' className='text-blue-500 hover:underline'>
                    View Diff
                  </a>
                </td>
                <td className='px-4 py-2 border text-center'>
                  <button
                    onClick={() => openModal(v1ResData, v2ResData)}
                    className='px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600'
                  >
                    Expand Diff
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Modal for showing expanded diff */}
      {showModal && (
        <div className='fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50'>
          <div className='bg-white rounded-lg p-4 w-11/12 h-5/6 overflow-auto'>
            <div className='flex justify-between items-center mb-4'>
              <h2 className='text-xl font-bold'>Diff Viewer</h2>
              <button onClick={closeModal} className='text-gray-500 hover:text-gray-700'>
                Close
              </button>
            </div>
            <ReactDiffViewer oldValue={JSON.stringify(modalData.v1, null, 4)} newValue={JSON.stringify(modalData.v2, null, 4)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
