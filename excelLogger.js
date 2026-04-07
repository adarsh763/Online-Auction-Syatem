const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const EXCEL_FILE = path.join(__dirname, '../../data/registered_users.xlsx');

/**
 * Logs a newly registered user's details into an Excel spreadsheet.
 * Creates the file with headers if it doesn't exist, otherwise appends a row.
 *
 * @param {object} userData - { name, email, password, registeredAt }
 */
const logUserToExcel = async (userData) => {
    try {
        // Ensure the data directory exists
        const dir = path.dirname(EXCEL_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const workbook = new ExcelJS.Workbook();
        let worksheet;

        if (fs.existsSync(EXCEL_FILE)) {
            // File exists — load it
            await workbook.xlsx.readFile(EXCEL_FILE);
            worksheet = workbook.getWorksheet('Users');
        }

        if (!worksheet) {
            // Create a new worksheet with styled headers
            worksheet = workbook.addWorksheet('Users');

            worksheet.columns = [
                { header: 'S.No', key: 'sno', width: 8 },
                { header: 'Name', key: 'name', width: 25 },
                { header: 'Email', key: 'email', width: 35 },
                { header: 'Password', key: 'password', width: 25 },
                { header: 'Registered At', key: 'registeredAt', width: 25 },
                { header: 'Verified', key: 'verified', width: 12 },
            ];

            // Style the header row
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF6C63FF' },
            };
            headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
            headerRow.height = 25;
        }

        // Calculate serial number
        const rowCount = worksheet.rowCount; // includes header
        const sno = rowCount; // row 1 = header, so row 2 = sno 1, etc.

        // Add the new user row
        const newRow = worksheet.addRow({
            sno: sno,
            name: userData.name,
            email: userData.email,
            password: userData.password,
            registeredAt: userData.registeredAt || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            verified: 'No',
        });

        // Alternate row color for readability
        if (sno % 2 === 0) {
            newRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF3F0FF' },
            };
        }

        // Save the workbook
        await workbook.xlsx.writeFile(EXCEL_FILE);
        console.log(`📋 User "${userData.name}" logged to Excel (Row ${sno + 1})`);
    } catch (error) {
        // Don't crash the app if Excel logging fails
        console.error('⚠️ Failed to log user to Excel:', error.message);
    }
};

/**
 * Updates the "Verified" column for a user after OTP verification.
 *
 * @param {string} email - The user's email to mark as verified.
 */
const markVerifiedInExcel = async (email) => {
    try {
        if (!fs.existsSync(EXCEL_FILE)) return;

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(EXCEL_FILE);
        const worksheet = workbook.getWorksheet('Users');
        if (!worksheet) return;

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // skip header
            if (row.getCell('email').value === email) {
                row.getCell('verified').value = 'Yes ✅';
            }
        });

        await workbook.xlsx.writeFile(EXCEL_FILE);
        console.log(`📋 User "${email}" marked as verified in Excel`);
    } catch (error) {
        console.error('⚠️ Failed to update Excel verification:', error.message);
    }
};

module.exports = { logUserToExcel, markVerifiedInExcel };
