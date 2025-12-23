
import React, { useState } from 'react';
import { downloadTemplate } from '../utils/excelHelpers';

const APPS_SCRIPT_CODE = `/**
 * TEAMSYNC BRIDGE API v1.1
 * Handles 2-way sync with Auto-Schema Evolution
 */

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const getSheetData = (sheetName) => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    
    // Handle empty sheets
    if (sheet.getLastRow() < 1) return [];

    const rows = sheet.getDataRange().getValues();
    const headers = rows.shift(); // Remove headers
    return rows.map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
  };

  const data = {
    tasks: getSheetData("Tasks"),
    members: getSheetData("Team Members"),
    projects: getSheetData("Projects"),
    status: getSheetData("Status"),
    priority: getSheetData("Priority")
  };
  
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(payload.targetSheet);
  
  if (!sheet) return ContentService.createTextOutput("Error: Sheet not found");

  const action = payload.action;
  const data = payload.data;
  const idColumn = payload.idColumn || "ID";
  
  if (action === "upsert") {
    // 1. Get current headers
    let lastCol = sheet.getLastColumn();
    let headers = [];
    if (lastCol > 0) {
      headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    }
    
    // 2. Auto-Schema: Add missing columns if they exist in the incoming data
    const incomingKeys = Object.keys(data);
    const missingColumns = incomingKeys.filter(k => !headers.includes(k));
    
    if (missingColumns.length > 0) {
      // Append new headers to the first row
      sheet.getRange(1, headers.length + 1, 1, missingColumns.length).setValues([missingColumns]);
      // Refresh headers
      lastCol = sheet.getLastColumn();
      headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    }
    
    const idIndex = headers.indexOf(idColumn);
    if (idIndex === -1) return ContentService.createTextOutput("Error: ID Column not found");
    
    const allData = sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    // Find existing row (skip header)
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][idIndex] == data[idColumn]) {
        rowIndex = i + 1; // 1-based index
        break;
      }
    }
    
    const rowValues = headers.map(h => {
       return data[h] !== undefined ? data[h] : "";
    });

    if (rowIndex > 0) {
      // Update
      sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      // Insert
      sheet.appendRow(rowValues);
    }
  } else if (action === "delete") {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const idIndex = headers.indexOf(idColumn);
    const allData = sheet.getDataRange().getValues();
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][idIndex] == data.id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
  }

  return ContentService.createTextOutput("Success");
}`;

const SetupGuide: React.FC = () => {
  const [showScript, setShowScript] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');

  const handleCopyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopyFeedback('Copied!');
    setTimeout(() => setCopyFeedback(''), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-10 animate-fadeIn pb-20 overflow-y-auto custom-scrollbar h-full">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-black text-gray-800">Setup Guide</h2>
        <p className="text-gray-500 max-w-lg mx-auto">
          Connect TeamSync to Google Sheets to enable real-time collaboration for your 5-person team.
        </p>
      </div>

      {/* Step 1 */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex gap-6 items-start">
        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0">1</div>
        <div className="space-y-4 flex-1">
          <h3 className="text-lg font-bold text-gray-800">Get the Template</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            Download our pre-formatted Excel template. It contains all the required tabs.
          </p>
          <button 
            onClick={downloadTemplate}
            className="bg-gray-900 text-white px-5 py-3 rounded-xl text-sm font-bold hover:bg-black transition-all flex items-center gap-2"
          >
            <i className="fas fa-file-download"></i> Download .xlsx Template
          </button>
        </div>
      </div>

      {/* Step 2 */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex gap-6 items-start">
        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0">2</div>
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Import to Google Sheets</h3>
          <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2 ml-1">
            <li>Go to <a href="https://sheets.new" target="_blank" className="text-blue-500 hover:underline">sheets.new</a>.</li>
            <li>Click <strong>File &gt; Import &gt; Upload</strong> and select the file you just downloaded.</li>
            <li>Choose <strong>"Replace spreadsheet"</strong>.</li>
          </ol>
        </div>
      </div>

      {/* Step 3 */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex gap-6 items-start">
        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0">3</div>
        <div className="space-y-4 w-full">
          <h3 className="text-lg font-bold text-gray-800">Deploy Bridge API</h3>
          <p className="text-gray-600 text-sm">
            Copy the script below and deploy it as a Web App in Google Sheets.
          </p>
          
          <button 
            onClick={() => setShowScript(!showScript)}
            className="text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
          >
            {showScript ? 'Hide Script Code' : 'Show Script Code'}
          </button>

          {showScript && (
            <div className="relative mt-4 bg-gray-900 rounded-xl p-4 overflow-hidden">
               <button 
                onClick={handleCopyCode} 
                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold backdrop-blur-sm transition-all"
               >
                {copyFeedback || 'Copy to Clipboard'}
              </button>
              <pre className="font-mono text-[10px] leading-relaxed text-gray-300 whitespace-pre-wrap overflow-x-auto max-h-[400px] custom-scrollbar">
                {APPS_SCRIPT_CODE}
              </pre>
            </div>
          )}

          <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2 ml-1 pt-2">
            <li>In Sheets: <strong>Extensions &gt; Apps Script</strong>.</li>
            <li>Paste the code.</li>
            <li><strong>Deploy &gt; New Deployment</strong> &gt; Type: <strong>Web app</strong>.</li>
            <li>Execute as: <strong>Me</strong>, Access: <strong>Anyone</strong>.</li>
          </ol>
        </div>
      </div>

      {/* Step 4 */}
      <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex gap-6 items-start">
        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0">4</div>
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">Connect</h3>
          <p className="text-gray-600 text-sm">
            Paste the Web App URL into the TeamSync header.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SetupGuide;
