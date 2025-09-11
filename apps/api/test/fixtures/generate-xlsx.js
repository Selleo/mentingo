const XLSX = require('xlsx');
const path = require('path');

// Create workbook and worksheet
const workbook = XLSX.utils.book_new();

// Valid users data
const validUsersData = [
  ['name', 'surname', 'email', 'role'],
  ['John', 'Doe', 'john.doe@example.com', 'STUDENT'],
  ['Jane', 'Smith', 'jane.smith@example.com', 'CONTENT_CREATOR'],
  ['Bob', 'Johnson', 'bob.johnson@example.com', 'ADMIN'],
  ['Alice', 'Williams', 'alice.williams@example.com', 'STUDENT'],
  ['Charlie', 'Brown', 'charlie.brown@example.com', 'CONTENT_CREATOR']
];

// Create worksheet from data
const validUsersWorksheet = XLSX.utils.aoa_to_sheet(validUsersData);
XLSX.utils.book_append_sheet(workbook, validUsersWorksheet, 'Users');

// Write XLSX file
const outputPath = path.join(__dirname, 'users-valid.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log(`Generated XLSX file: ${outputPath}`);