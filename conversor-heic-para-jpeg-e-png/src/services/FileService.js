const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const mkdir = promisify(fs.mkdir);

class FileService {
    async scanDirectory(folderPath, inputType = 'all') {
        if (!fs.existsSync(folderPath)) {
            throw new Error('Directory does not exist');
        }
        const files = await readdir(folderPath);
        return files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            if (inputType === 'heic') return ext === '.heic';
            if (inputType === 'cr2') return ext === '.cr2';
            return ext === '.heic' || ext === '.cr2';
        });
    }

    async ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            await mkdir(dirPath, { recursive: true });
        }
    }
}

module.exports = new FileService();
