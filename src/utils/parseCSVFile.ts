import csv from 'csv-parser';
import fs from 'fs';

const parseCSVFile = async (filePath: string, deleteFile = true) => {
  const records = [];

  try {
    const parser = fs
      .createReadStream(filePath)
      .pipe(csv({ mapHeaders: ({ header }) => header.trim() }));
    for await (const row of parser) {
      records.push(row);
    }

    if (records.length === 0) {
      throw new Error('CSV is empty');
    }

    return records;
  } finally {
    if (deleteFile) {
      try {
        await fs.promises.unlink(filePath);
      } catch (unlinkError) {
        console.error('Failed to delete temp file:', unlinkError);
      }
    }
  }
};

export default parseCSVFile;
