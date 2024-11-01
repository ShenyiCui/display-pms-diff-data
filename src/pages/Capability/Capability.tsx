import React, { useState, ChangeEvent } from 'react';
import { JsonView, defaultStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import ReactJsonViewCompare from 'react-json-view-compare';

interface BaseInfo {
  LogID?: string;
  Caller?: string;
  Addr?: string;
  Client?: string;
}

interface QueryCapabilityReqV1 {
  capability_req_map?: {
    [key: string]: {
      payment_method_id?: string;
      capability_key_list?: string[];
      merchant_id?: string;
      country_code?: string;
      currency?: string;
      unique_key?: string;
    };
  };
  Base?: BaseInfo;
}

interface PaymentMethodInfo {
  payment_method: string;
  fund_flow: number;
  payment_method_id: string;
}

interface QueryCapabilityReqV2 {
  payment_method_info?: PaymentMethodInfo[];
  capability_keys?: string[];
  capability_params?: {
    merchant_id?: string;
    country_code?: string;
    currency?: string;
  };
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
  query_capability_req_v1?: QueryCapabilityReqV1;
  query_capability_req_v2?: QueryCapabilityReqV2;
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

// Define the structure for the table rows
interface TableRow {
  serialNumber: number;
  capabilityKey: string;
  pmid: string;
  v1: any;
  v2: any;
}

const Capability: React.FC = () => {
  const [jsonData, setJsonData] = useState<Item[]>([]);
  const [tableData, setTableData] = useState<TableRow[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalData, setModalData] = useState<{ v1: any; v2: any }>({ v1: null, v2: null });

  // Handle file upload and parse JSON data
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
            processData(parsedData);
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

  // Function to process JSON data and populate tableData
  const processData = (data: Item[]) => {
    const rows: TableRow[] = [];
    let serialNumber = 1;

    data.forEach(item => {
      if (item._source.is_diff_found && item._source.issues) {
        item._source.issues.forEach(issue => {
          const fields = issue.v2v3_field.split(',');
          if (fields.length >= 4 && fields[0] === 'CapabilityRespMap') {
            const capabilityKey = fields[3];
            const pmid = fields[1];

            // Parse v1 and v2 values
            const v1Value = tryParseJSON(issue.v2_value);
            const v2Value = tryParseJSON(issue.v3_value);

            // Check if there's an existing row with the same capabilityKey, pmid, and values
            const existingRow = rows.find(
              row =>
                row.capabilityKey === capabilityKey &&
                row.pmid === pmid &&
                JSON.stringify(row.v1) === JSON.stringify(v1Value) &&
                JSON.stringify(row.v2) === JSON.stringify(v2Value),
            );

            if (!existingRow) {
              // If not, add a new row
              rows.push({
                serialNumber: serialNumber++,
                capabilityKey,
                pmid,
                v1: v1Value,
                v2: v2Value,
              });
            }
          }
        });
      }
    });

    setTableData(rows);
  };

  const tryParseJSON = (str: string | null): any | string | null => {
    if (typeof str !== 'string') return str;
    try {
      return JSON.parse(str);
    } catch (e) {
      return str;
    }
  };

  // Function to export table data as CSV
  const exportToCSV = () => {
    if (tableData.length === 0) {
      alert('No data available to export.');
      return;
    }

    const headers = ['S/N', 'CapabilityKey', 'PMID', 'V1', 'V2'];

    const rows = tableData.map(row => [row.serialNumber, row.capabilityKey, row.pmid, JSON.stringify(row.v1), JSON.stringify(row.v2)]);

    // Construct CSV content
    let csvContent = '';
    csvContent += headers.join(',') + '\r\n';
    rows.forEach(row => {
      const escapedRow = row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
      csvContent += escapedRow + '\r\n';
    });

    // Create a Blob from the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // Create a link to download the Blob
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'capability_data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  return (
    <div className='container p-4'>
      <h1 className='text-2xl font-bold mb-4'>Capability Data Viewer</h1>
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
            <th className='px-4 py-2 border bg-gray-200'>CapabilityKey</th>
            <th className='px-4 py-2 border bg-gray-200'>PMID</th>
            <th className='px-4 py-2 border bg-gray-200'>V1</th>
            <th className='px-4 py-2 border bg-gray-200'>V2</th>
            <th className='px-4 py-2 border bg-gray-200'>Diff</th>
          </tr>
        </thead>
        <tbody>
          {tableData.map((row, index) => (
            <tr key={index} className='odd:bg-white even:bg-gray-50'>
              <td className='px-4 py-2 border text-center'>{row.serialNumber}</td>
              <td className='px-4 py-2 border'>{row.capabilityKey}</td>
              <td className='px-4 py-2 border'>{row.pmid}</td>
              <td className='px-4 py-2 border'>
                <div className='max-h-64 overflow-y-auto'>
                  <JsonView data={row.v1} style={defaultStyles} />
                </div>
              </td>
              <td className='px-4 py-2 border'>
                <div className='max-h-64 overflow-y-auto'>
                  <JsonView data={row.v2} style={defaultStyles} />
                </div>
              </td>
              <td className='px-4 py-2 border text-center'>
                <button onClick={() => openModal(row.v1, row.v2)} className='px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600'>
                  Expand Diff
                </button>
              </td>
            </tr>
          ))}
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
            <ReactJsonViewCompare oldData={modalData.v1} newData={modalData.v2} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Capability;
