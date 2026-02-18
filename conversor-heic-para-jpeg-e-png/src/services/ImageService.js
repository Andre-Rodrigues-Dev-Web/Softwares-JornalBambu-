const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const sharp = require('sharp');
const heicConvert = require('heic-convert');
const dcraw = require('dcraw');
const FileService = require('./FileService');

const readFile = promisify(fs.readFile);

class ImageService {
    async convertDirectory(folderPath, outputFormat, quality, onProgress) {
        const files = await FileService.scanDirectory(folderPath);
        const outputDir = path.join(folderPath, 'converted');

        await FileService.ensureDirectoryExists(outputDir);

        const results = [];
        let successCount = 0;

        for (const file of files) {
            const inputPath = path.join(folderPath, file);
            const outputFilename = path.basename(file, path.extname(file)) + '.' + outputFormat;
            const outputPath = path.join(outputDir, outputFilename);

            if (onProgress) onProgress({ type: 'start', file });

            try {
                await this.processSingleFile(inputPath, outputPath, outputFormat, quality);
                successCount++;
                results.push({ file, status: 'success' });
                if (onProgress) onProgress({ type: 'success', file });
            } catch (err) {
                console.error(`Error converting ${file}:`, err);
                results.push({ file, status: 'error', error: err.message });
                if (onProgress) onProgress({ type: 'error', file, error: err.message });
            }
        }

        return {
            total: files.length,
            converted: successCount,
            outputDir,
            results
        };
    }

    async processSingleFile(inputPath, outputPath, format, quality) {
        const inputBuffer = await readFile(inputPath);
        const ext = path.extname(inputPath).toLowerCase();

        let imageBuffer;

        if (ext === '.cr2') {
            // Convert CR2 to TIFF buffer using dcraw
            // The 'dcraw' npm package exports a function that takes a buffer and returns a buffer (TIFF)
            try {
                imageBuffer = dcraw(inputBuffer, { verbose: true, useTiff: true });
            } catch (e) {
                throw new Error('Failed to decode CR2: ' + e.message);
            }
        } else {
            // HEIC or other
            try {
                imageBuffer = await sharp(inputBuffer).toBuffer();
            } catch (e) {
                // Fallback for HEIC if sharp fails
                if (ext === '.heic') {
                    imageBuffer = await heicConvert({
                        buffer: inputBuffer,
                        format: 'PNG'
                    });
                } else {
                    throw e;
                }
            }
        }

        // Optimize with sharp
        let pipeline = sharp(imageBuffer);
        const metadata = await pipeline.metadata();

        // Watermark Logic
        const watermarkPath = path.join(process.cwd(), 'public', 'logo.png');
        if (fs.existsSync(watermarkPath)) {
            const watermarkWidth = Math.round(metadata.width * 0.2); // 20% of image width
            const watermarkBuffer = await sharp(watermarkPath)
                .resize({ width: watermarkWidth })
                .toBuffer();

            pipeline = pipeline.composite([{
                input: watermarkBuffer,
                gravity: 'southeast',
                blend: 'over'
            }]);
        }

        if (format === 'jpeg') {
            pipeline = pipeline.jpeg({
                quality: parseInt(quality) || 80,
                mozjpeg: true
            });
        } else if (format === 'png') {
            pipeline = pipeline.png({
                quality: parseInt(quality) || 80,
                compressionLevel: 8,
                adaptiveFiltering: true
            });
        }

        await pipeline.toFile(outputPath);
    }
}

module.exports = new ImageService();
