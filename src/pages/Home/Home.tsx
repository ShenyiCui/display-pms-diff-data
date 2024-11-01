/* eslint-disable */

import React, { useState, ChangeEvent } from 'react';
import { JsonView, defaultStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';

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
  req_function_name?: string;
  is_diff_found?: boolean;
  res_pmid?: string;
  query_element_key_info_req_v1?: QueryElementKeyInfoReqV1;
  query_element_key_info_req_v2?: QueryElementKeyInfoReqV2;
  issues?: Issue[];
  // Other fields can be added here if needed
}

interface Item {
  _index: string;
  _type: string;
  _id: string;
  _score: number;
  _source: Source;
}

// Function to generate a unique key based on res_pmid and sorted issues
function generateUniqueKey(item: Item): string {
  const resPmid = item._source.res_pmid || '';
  const issues = item._source.issues || [];

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

  // Generate a unique key combining resPmid and issuesString
  return `${resPmid}_${issuesString}`;
}

const Home: React.FC = () => {
  const [jsonData, setJsonData] = useState<Item[]>([]);

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

    const headers = ['S/N', 'PMID', 'PMS V1 Request', 'PMS V2 Request', 'V1 Res', 'V2 Res'];

    const rows = uniqueItems.map((item, i) => {
      // Exclude 'Base' from PMS V1 and V2 Requests
      const { Base: baseV1, ...reqV1WithoutBase } = item._source.query_element_key_info_req_v1 || {};
      const { Base: baseV2, ...reqV2WithoutBase } = item._source.query_element_key_info_req_v2 || {};

      // Prepare V1 Res and V2 Res data
      const issues = item._source.issues || [];

      const relevantIssues = issues
        .sort((a, b) => a.v2v3_field.localeCompare(b.v2v3_field))
        .filter(issue => issue.v2v3_field.startsWith('EleKeyInfoMap'))
        .filter(issue => issue.v2v3_field.includes('DisplayTag') || issue.v2v3_field.includes('PIAvailabilityCheckTag'));

      const v1ResData: { [key: string]: any } = {};
      const v2ResData: { [key: string]: any } = {};

      relevantIssues.forEach(issue => {
        const fields = issue.v2v3_field.split(',');
        if (fields.length >= 3 && fields[0] === 'EleKeyInfoMap') {
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

      // Stringify PMS V1 and V2 Requests
      const reqV1 = JSON.stringify(reqV1WithoutBase);
      const reqV2 = JSON.stringify(reqV2WithoutBase);

      return [(i + 1).toString(), reqV1WithoutBase.payment_method_id || '', reqV2, v1Res, v2Res];
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
            <th className='px-4 py-2 border bg-gray-200'>PMS V1 Request</th>
            <th className='px-4 py-2 border bg-gray-200'>PMS V2 Request</th>
            <th className='px-4 py-2 border bg-gray-200'>V1 Res</th>
            <th className='px-4 py-2 border bg-gray-200'>V2 Res</th>
          </tr>
        </thead>
        <tbody>
          {uniqueItems.map((item, index) => {
            let issues = item._source.issues || [];

            // Sort issues by v2v3_field for consistent processing
            issues = issues.sort((a, b) => a.v2v3_field.localeCompare(b.v2v3_field));

            const relevantIssues = issues
              .filter(issue => issue.v2v3_field.startsWith('EleKeyInfoMap'))
              .filter(issue => issue.v2v3_field.includes('DisplayTag') || issue.v2v3_field.includes('PIAvailabilityCheckTag'));

            const v1ResData: { [key: string]: any } = {};
            const v2ResData: { [key: string]: any } = {};

            relevantIssues.forEach(issue => {
              const fields = issue.v2v3_field.split(',');
              if (fields.length >= 3 && fields[0] === 'EleKeyInfoMap') {
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

            return (
              <tr key={index} className='odd:bg-white even:bg-gray-50'>
                <td className='px-4 py-2 border'>{(index + 1).toString()}</td>
                <td className='px-4 py-2 border'>{item._source.query_element_key_info_req_v1?.payment_method_id}</td>
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default Home;
